import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { jobsService } from '@/services/jobs'
import { companyService } from '@/services/company'
import { candidatesService, applicationsService, auditService } from '@/services/candidates'
import type {
  Job,
  Company,
  ApplicationSource,
  CandidateAvailability,
  SeniorityLevel,
} from '@/types/ats'
import {
  Building2,
  MapPin,
  Briefcase,
  CheckCircle2,
  ArrowLeft,
  UploadCloud,
  FileText,
  ShieldCheck,
  Send,
  AlertCircle,
  DollarSign,
  Share2,
  Users,
  Loader2,
  PenLine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { ResumeReviewForm } from '@/components/ResumeReviewForm'
import { ApplicationProgress } from '@/components/ApplicationProgress'
import { LoadingState } from '@/components/LoadingState'
import type { ProgressStep } from '@/components/ApplicationProgress'
import {
  validateResumeFile,
  extractResumeData,
  normalizeStructured,
  hasExtractedContent,
} from '@/services/resumeReader'
import type { ResumeReaderStatus, StructuredResume } from '@/types/ats'

export const JobApplicationPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [job, setJob] = useState<Job | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successSubmitted, setSuccessSubmitted] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [location, setLocation] = useState('')
  const [seniority, setSeniority] = useState<SeniorityLevel>('mid')
  const [skills, setSkills] = useState('')
  const [availability, setAvailability] = useState<CandidateAvailability>('immediate')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [lgpdConsent, setLgpdConsent] = useState(false)

  // Fluxo do leitor de currículo com IA: idle → reading → review → confirmado
  const [readerStatus, setReaderStatus] = useState<ResumeReaderStatus>('idle')
  const [readerError, setReaderError] = useState<string | null>(null)
  const [structuredData, setStructuredData] = useState<StructuredResume | null>(null)
  const [wasExtracted, setWasExtracted] = useState(false)

  // Pré-preenchimento a partir do Banco de Talentos (flag para mostrar aviso ao candidato)
  const [prefilled, setPrefilled] = useState(false)

  // Flag que indica que o candidato tentou enviar sem concluir tudo (destaca erros no progresso)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // Detecção do canal / origem (Query param ?origem= ou ?utm_source= ou referer)
  const [source, setSource] = useState<ApplicationSource>('direct_link')

  // Etapas do progresso da candidatura: 1. Dados, 2. Currículo, 3. Envio
  const APPLICATION_STEPS: ProgressStep[] = [
    { key: 'dados', label: 'Seus dados' },
    { key: 'curriculo', label: 'Currículo' },
    { key: 'envio', label: 'Confirmação LGPD' },
  ]

  // Etapa atual do formulário, calculada a partir do que o candidato já preencheu
  const getCurrentStep = () => {
    if (!name.trim() || !email.trim()) return 0
    if (!resumeFile) return 1
    return 2
  }
  const currentStep = getCurrentStep()

  // Campos obrigatórios ainda incompletos, para destacar no indicador de progresso
  const errorSteps: number[] = []
  if (submitAttempted && (!name.trim() || !email.trim())) errorSteps.push(0)
  if (submitAttempted && !resumeFile) errorSteps.push(1)
  if (submitAttempted && !lgpdConsent) errorSteps.push(2)

  useEffect(() => {
    // Detectar origem da candidatura
    const rawOrigin =
      searchParams.get('origem') || searchParams.get('utm_source') || searchParams.get('source')
    if (rawOrigin) {
      const lower = rawOrigin.toLowerCase()
      if (lower.includes('google')) setSource('google_for_jobs')
      else if (lower.includes('whatsapp')) setSource('whatsapp')
      else if (lower.includes('indica') || lower.includes('referral')) setSource('referral')
      else if (lower.includes('linkedin')) setSource('linkedin')
      else setSource('direct_link')
    } else {
      // Checar document.referrer
      const ref = document.referrer.toLowerCase()
      if (ref.includes('google')) setSource('google_for_jobs')
      else if (ref.includes('whatsapp')) setSource('whatsapp')
      else if (ref.includes('linkedin')) setSource('linkedin')
      else setSource('direct_link')
    }
  }, [searchParams])

  useEffect(() => {
    async function loadJobAndCompany() {
      if (!slug) return
      try {
        setLoading(true)
        const [jobData, comp] = await Promise.all([
          jobsService.getJobBySlug(slug),
          companyService.getCompany(),
        ])
        setJob(jobData)
        setCompany(comp)
      } catch (err) {
        console.error('Erro ao carregar detalhes da vaga:', err)
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    loadJobAndCompany()
  }, [slug])

  // Checar se o e-mail já existe no banco de talentos para autocompletar dados
  const handleEmailBlur = async () => {
    if (!email || !email.includes('@')) return
    try {
      const existing = await candidatesService.findByEmail(email)
      if (existing) {
        let changed = false
        if (!name && existing.name) {
          setName(existing.name)
          changed = true
        }
        if (!phone && existing.phone) {
          setPhone(existing.phone)
          changed = true
        }
        if (!cpf && existing.cpf) {
          setCpf(existing.cpf)
          changed = true
        }
        if (!linkedin && existing.linkedin) {
          setLinkedin(existing.linkedin)
          changed = true
        }
        if (!location && existing.location) {
          setLocation(existing.location)
          changed = true
        }
        if (!skills && existing.skills) {
          setSkills(existing.skills)
          changed = true
        }
        // Senioridade e disponibilidade sempre refletem o cadastro conhecido
        if (existing.seniority) setSeniority(existing.seniority)
        if (existing.availability) setAvailability(existing.availability)

        if (changed) {
          setPrefilled(true)
          toast({
            title: 'Bem-vindo(a) de volta!',
            description:
              'Encontramos seu cadastro no Banco de Talentos e preenchemos alguns campos. Confira e edite o que precisar.',
          })
        }
      }
    } catch (_) {
      // Silencioso se não encontrar — segue fluxo normal
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validação local: tipo real (magic number), extensão e tamanho (10 MB)
    const validationError = await validateResumeFile(file)
    if (validationError) {
      toast({ title: 'Arquivo inválido', description: validationError, variant: 'destructive' })
      setReaderError(validationError)
      setReaderStatus('failed')
      e.target.value = ''
      return
    }

    setResumeFile(file)
    setReaderError(null)
    setStructuredData(null)
    setReaderStatus('reading')

    // Leitura automática por IA (PDF ou .docx). Em caso de falha o fluxo segue manual.
    const result = await extractResumeData(file)
    if (!result.ok) {
      setReaderError(result.error)
      setReaderStatus('failed')
      return
    }

    const normalized = normalizeStructured(result.data)
    setStructuredData(normalized)
    if (!hasExtractedContent(normalized)) {
      setReaderError(
        'A leitura automática não encontrou dados neste arquivo. Verifique se é um currículo com texto selecionável ou preencha manualmente.',
      )
      setReaderStatus('failed')
      return
    }

    setWasExtracted(true)
    setReviewConfirmed(false)

    // Pré-preenche os campos do formulário com o que a IA extraiu
    if (normalized.name && !name) setName(normalized.name)
    if (normalized.email && !email) setEmail(normalized.email)
    if (normalized.phone && !phone) setPhone(normalized.phone)
    if (normalized.linkedin && !linkedin) setLinkedin(normalized.linkedin)
    if (normalized.location && !location) setLocation(normalized.location)
    if (normalized.skills.length > 0 && !skills) setSkills(normalized.skills.join(', '))

    setReaderStatus('review')
  }

  // Confirmação da revisão: fecha a edição e mantém os dados para envio junto à candidatura
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const handleConfirmStructured = () => {
    setReviewConfirmed(true)
    toast({
      title: 'Currículo revisado!',
      description: 'Os dados extraídos serão salvos junto com sua candidatura.',
    })
  }

  // Descarta a leitura e abre o modelo padrão vazio para preenchimento manual
  const handleManualStart = () => {
    setStructuredData({
      name: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      summary: '',
      skills: [],
      experiences: [],
      education: [],
      languages: [],
      courses: [],
    })
    setReaderStatus('review')
    setReaderError(null)
    setWasExtracted(false)
  }

  const getFriendlyNetworkError = (err: unknown): string => {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.'
    }
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as { status?: number }).status
      if (status === 400)
        return 'Alguns dados enviados são inválidos. Confira os campos e tente novamente.'
      if (status === 413) return 'Seu arquivo é muito grande. O tamanho máximo permitido é 10 MB.'
      if (status === 429)
        return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.'
      if (status && status >= 500)
        return 'Nosso servidor está temporariamente indisponível. Tente novamente em alguns minutos.'
    }
    return 'Não foi possível registrar a candidatura. Verifique os dados e tente novamente.'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!job) return
    setSubmitAttempted(true)

    if (!name.trim() || !email.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha nome completo e e-mail para continuar.',
        variant: 'destructive',
      })
      return
    }

    if (!email.includes('@') || !email.includes('.')) {
      toast({
        title: 'E-mail inválido',
        description: 'Digite um e-mail válido, como nome@exemplo.com.br.',
        variant: 'destructive',
      })
      return
    }

    if (!resumeFile) {
      toast({
        title: 'Currículo obrigatório',
        description:
          'Anexe seu currículo em PDF ou Word para que o time de recrutamento possa avaliar seu perfil.',
        variant: 'destructive',
      })
      return
    }

    if (!lgpdConsent) {
      toast({
        title: 'Consentimento obrigatório',
        description:
          'Você precisa autorizar o tratamento de dados conforme a LGPD para enviar sua candidatura.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)

      // 1. Verificar se o candidato já existe no Banco de Talentos
      let candidate = await candidatesService.findByEmail(email)
      const consentTimestamp = new Date().toISOString()

      const candidateFormData = new FormData()
      candidateFormData.append('name', name.trim())
      candidateFormData.append('email', email.trim().toLowerCase())
      if (phone) candidateFormData.append('phone', phone.trim())
      if (cpf) candidateFormData.append('cpf', cpf.trim())
      if (linkedin) candidateFormData.append('linkedin', linkedin.trim())
      if (location) candidateFormData.append('location', location.trim())
      if (seniority) candidateFormData.append('seniority', seniority)
      if (skills) candidateFormData.append('skills', skills.trim())
      if (availability) candidateFormData.append('availability', availability)
      candidateFormData.append('lgpd_consent', 'true')
      candidateFormData.append('lgpd_consent_date', consentTimestamp)
      candidateFormData.append('lgpd_consent_version', 'LGPD-v1.0-2025')

      if (resumeFile) {
        candidateFormData.append('resume', resumeFile)
      }

      // Dados estruturados do modelo padrão (extraídos por IA e revisados, ou manuais)
      if (structuredData) {
        candidateFormData.append('resume_structured', JSON.stringify(structuredData))
        candidateFormData.append('resume_source', wasExtracted ? 'ai_extracted' : 'manual')
      }

      if (candidate) {
        // Atualizar candidato no Banco de Talentos
        candidate = await candidatesService.updateCandidate(candidate.id, candidateFormData)
      } else {
        // Criar novo candidato
        candidate = await candidatesService.createCandidate(candidateFormData)
      }

      // 2. Verificar se já existe candidatura para esta mesma vaga
      const existingApps = await applicationsService.listApplications(job.id)
      const alreadyApplied = existingApps.find((a) => a.candidate_id === candidate?.id)

      if (alreadyApplied) {
        toast({
          title: 'Candidatura já registrada',
          description:
            'Você já possui uma candidatura ativa para esta vaga! Seus dados e currículo foram atualizados.',
        })
        setSuccessSubmitted(true)
        return
      }

      // 3. Criar registro de aplicação vinculando vaga e candidato
      const stages = (Array.isArray(job.stages) ? job.stages : []) as { id: string }[]
      const initialStageId = stages[0]?.id || 'applied'

      const newApp = await applicationsService.createApplication({
        candidate_id: candidate.id,
        job_id: job.id,
        stage_id: initialStageId,
        status: 'active',
        source: source,
      })

      // 4. Log de auditoria da inscrição
      await auditService.createLog({
        application_id: newApp.id,
        candidate_id: candidate.id,
        action: 'candidate_created',
        user_name: name,
        user_role: 'candidato',
        details: `Candidatura submetida via canal: ${source}. Consentimento LGPD aceito em ${new Date(consentTimestamp).toLocaleString('pt-BR')}.`,
      })

      setSuccessSubmitted(true)
      toast({
        title: 'Candidatura enviada com sucesso!',
        description: 'Recebemos suas informações e currículo. Boa sorte!',
      })
    } catch (err) {
      console.error('Erro ao enviar candidatura:', err)
      toast({
        title: 'Falha no envio',
        description: getFriendlyNetworkError(err),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const getSourceLabel = (src: ApplicationSource) => {
    switch (src) {
      case 'google_for_jobs':
        return 'Google for Jobs'
      case 'whatsapp':
        return 'WhatsApp'
      case 'referral':
        return 'Indicação'
      case 'linkedin':
        return 'LinkedIn'
      default:
        return 'Link Direto'
    }
  }

  if (loading) {
    return (
      <LoadingState
        message="Carregando detalhes da oportunidade..."
        className="min-h-screen bg-slate-50"
      />
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-xl font-bold text-slate-800">
          {loadError ? 'Não foi possível carregar esta vaga' : 'Vaga não encontrada'}
        </h2>
        <p className="text-slate-500 text-sm mt-1 mb-4">
          {loadError
            ? 'Ocorreu um problema de conexão ao abrir a vaga. Verifique sua internet e tente novamente.'
            : 'Esta posição pode ter sido encerrada ou movida.'}
        </p>
        <div className="flex gap-2">
          <Link to="/carreiras">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para a página de vagas
            </Button>
          </Link>
          {loadError && <Button onClick={() => window.location.reload()}>Recarregar página</Button>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to="/carreiras"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Todas as Vagas
          </Link>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>
              Canal: <strong className="text-slate-700">{getSourceLabel(source)}</strong>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {successSubmitted ? (
          <Card className="max-w-xl mx-auto text-center py-12 px-6 bg-white shadow-sm border-emerald-100">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Candidatura Enviada!</h2>
            <p className="text-slate-600 text-sm mb-6">
              Obrigado pelo seu interesse na vaga de <strong>{job.title}</strong> na{' '}
              <strong>{company?.trade_name || 'nossa empresa'}</strong>. Seus dados e currículo
              foram salvos de forma segura em nosso sistema conforme as diretrizes da LGPD.
            </p>
            <div className="bg-slate-50 p-4 rounded-lg text-xs text-slate-500 mb-6 text-left border">
              <div className="font-semibold text-slate-700 mb-1">Próximos passos:</div>
              <p>• O time de recrutamento analisará suas competências.</p>
              <p>• Você receberá notificações a cada mudança de etapa no processo seletivo.</p>
              <p>
                • Seus dados permanecem em nosso Banco de Talentos para futuras oportunidades
                compatíveis.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Link to="/carreiras">
                <Button variant="outline">Ver outras oportunidades</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Lado Esquerdo: Descrição da Vaga */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="bg-white">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="secondary" className="bg-sky-50 text-sky-700 border-sky-200">
                      {job.department || 'Geral'}
                    </Badge>
                    <Badge variant="outline">
                      {job.workplace_type === 'remote'
                        ? 'Remoto'
                        : job.workplace_type === 'hybrid'
                          ? 'Híbrido'
                          : 'Presencial'}
                    </Badge>
                    <Badge variant="outline">
                      {job.employment_type === 'clt'
                        ? 'CLT'
                        : job.employment_type === 'pj'
                          ? 'PJ'
                          : 'Estágio'}
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl font-extrabold text-slate-900">
                    {job.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {job.location || 'Brasil'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {company?.trade_name || 'Vanguard Soluções'}
                    </span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 text-slate-700 text-sm leading-relaxed border-t pt-4">
                  {job.salary_disclosed && job.salary_min && (
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                      <div>
                        Faixa Salarial Prevista: R$ {job.salary_min.toLocaleString('pt-BR')}
                        {job.salary_max
                          ? ` até R$ ${job.salary_max.toLocaleString('pt-BR')}`
                          : ''}{' '}
                        / mês
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-slate-900 mb-2">Sobre a vaga</h4>
                    <p className="whitespace-pre-line text-slate-600">{job.description}</p>
                  </div>

                  {job.requirements && (
                    <div>
                      <h4 className="font-bold text-slate-900 mb-2">Requisitos e Qualificações</h4>
                      <p className="whitespace-pre-line text-slate-600">{job.requirements}</p>
                    </div>
                  )}

                  {job.benefits && (
                    <div>
                      <h4 className="font-bold text-slate-900 mb-2">
                        Benefícios & O que oferecemos
                      </h4>
                      <p className="whitespace-pre-line text-slate-600">{job.benefits}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Informações sobre a empresa */}
              <Card className="bg-slate-50 border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-sky-600" />
                    Sobre a {company?.trade_name || 'empresa'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600">
                  <p>
                    {company?.description ||
                      'Empresa comprometida com inovação, crescimento humano e transparência.'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Lado Direito: Formulário de Candidatura */}
            <div className="lg:col-span-5">
              <Card className="bg-white sticky top-20 shadow-sm border-sky-100">
                <CardHeader className="pb-4 border-b">
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Send className="w-5 h-5 text-sky-600" />
                    Envie sua Candidatura
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Preencha os campos abaixo e anexe seu currículo (PDF ou Word).
                  </CardDescription>
                  {/* Indicador de progresso por etapas */}
                  <div className="mt-4 bg-slate-50 rounded-lg border p-3">
                    <ApplicationProgress
                      steps={APPLICATION_STEPS}
                      current={currentStep}
                      errorSteps={errorSteps}
                    />
                  </div>
                  {/* Aviso de pré-preenchimento (Banco de Talentos) */}
                  {prefilled && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-lg p-2.5">
                      <Users className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Alguns campos foram preenchidos com os dados do seu cadastro anterior.
                        Revise e edite livremente — suas alterações serão salvas.
                      </span>
                    </div>
                  )}
                </CardHeader>

                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4 pt-4">
                    {/* E-mail (com auto-complete do Banco de Talentos) */}
                    <div>
                      <Label htmlFor="email" className="text-xs font-semibold">
                        E-mail <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        placeholder="seu.email@exemplo.com.br"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={handleEmailBlur}
                        className="mt-1 text-sm"
                      />
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Se já se candidatou antes, seus dados serão preenchidos automaticamente.
                      </p>
                    </div>

                    {/* Nome Completo */}
                    <div>
                      <Label htmlFor="name" className="text-xs font-semibold">
                        Nome Completo <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        required
                        placeholder="Ex: Ana Clara dos Santos"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 text-sm"
                      />
                    </div>

                    {/* Telefone & WhatsApp */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="phone" className="text-xs font-semibold">
                          Telefone / WhatsApp
                        </Label>
                        <Input
                          id="phone"
                          placeholder="(11) 99999-9999"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cpf" className="text-xs font-semibold">
                          CPF
                        </Label>
                        <Input
                          id="cpf"
                          placeholder="000.000.000-00"
                          value={cpf}
                          onChange={(e) => setCpf(e.target.value)}
                          className="mt-1 text-sm"
                        />
                      </div>
                    </div>

                    {/* LinkedIn & Localização */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="location" className="text-xs font-semibold">
                          Cidade / Estado
                        </Label>
                        <Input
                          id="location"
                          placeholder="Ex: São Paulo, SP"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="seniority" className="text-xs font-semibold">
                          Senioridade Atual
                        </Label>
                        <Select
                          value={seniority}
                          onValueChange={(v) => setSeniority(v as SeniorityLevel)}
                        >
                          <SelectTrigger id="seniority" className="mt-1 text-xs">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="intern">Estágio</SelectItem>
                            <SelectItem value="junior">Júnior</SelectItem>
                            <SelectItem value="mid">Pleno</SelectItem>
                            <SelectItem value="senior">Sênior</SelectItem>
                            <SelectItem value="lead">Especialista / Lead</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="linkedin" className="text-xs font-semibold">
                        Perfil do LinkedIn
                      </Label>
                      <Input
                        id="linkedin"
                        type="url"
                        placeholder="https://linkedin.com/in/seuperfil"
                        value={linkedin}
                        onChange={(e) => setLinkedin(e.target.value)}
                        className="mt-1 text-sm"
                      />
                    </div>

                    {/* Habilidades e Disponibilidade */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="availability" className="text-xs font-semibold">
                          Disponibilidade
                        </Label>
                        <Select
                          value={availability}
                          onValueChange={(v) => setAvailability(v as CandidateAvailability)}
                        >
                          <SelectTrigger id="availability" className="mt-1 text-xs">
                            <SelectValue placeholder="Disponibilidade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediate">Imediata</SelectItem>
                            <SelectItem value="two_weeks">Em até 2 semanas</SelectItem>
                            <SelectItem value="one_month">Em 30 dias</SelectItem>
                            <SelectItem value="exploring">Apenas avaliando</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="skills" className="text-xs font-semibold">
                          Principais Competências
                        </Label>
                        <Input
                          id="skills"
                          placeholder="Ex: React, Node, SQL..."
                          value={skills}
                          onChange={(e) => setSkills(e.target.value)}
                          className="mt-1 text-sm"
                        />
                      </div>
                    </div>

                    {/* Upload de Currículo (PDF ou Word .docx) com leitura por IA */}
                    <div>
                      <Label className="text-xs font-semibold">
                        Currículo (PDF ou Word) <span className="text-rose-500">*</span>
                      </Label>
                      <div className="mt-1 border-2 border-dashed rounded-lg p-4 text-center hover:bg-slate-50 cursor-pointer transition">
                        <input
                          id="resume-file"
                          type="file"
                          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
                          onChange={handleFileChange}
                          className="hidden"
                          disabled={readerStatus === 'reading'}
                        />
                        <label htmlFor="resume-file" className="cursor-pointer block">
                          <UploadCloud className="w-7 h-7 text-sky-600 mx-auto mb-1" />
                          {resumeFile ? (
                            <div className="flex items-center justify-center gap-2 text-xs font-medium text-emerald-700">
                              <FileText className="w-4 h-4" />
                              <span className="truncate max-w-[200px]">{resumeFile.name}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                              </Badge>
                            </div>
                          ) : (
                            <div>
                              <span className="text-xs font-medium text-sky-700">
                                Clique para anexar seu currículo (PDF ou Word)
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Máximo 10 MB — a IA lê os dados e você revisa antes de confirmar
                              </p>
                            </div>
                          )}
                        </label>
                      </div>

                      {/* Estado: analisando */}
                      {readerStatus === 'reading' && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-sky-700 bg-sky-50 border border-sky-100 rounded-lg p-3">
                          <Loader2 className="w-4 h-4 animate-spin text-sky-600 shrink-0" />
                          <span>
                            Analisando seu currículo com IA... Isso pode levar alguns segundos.
                          </span>
                        </div>
                      )}

                      {/* Estado: falha (ilegível/escaneado/erro) — fluxo segue manual */}
                      {readerStatus === 'failed' && readerError && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{readerError}</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={handleManualStart}
                          >
                            <PenLine className="w-3.5 h-3.5 mr-1" />
                            Preencher o modelo manualmente
                          </Button>
                        </div>
                      )}

                      {/* Estado: revisão/edição do modelo padrão */}
                      {readerStatus === 'review' && structuredData && (
                        <div className="mt-3">
                          {reviewConfirmed && (
                            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-2">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>
                                Currículo revisado e confirmado. Ele será salvo junto com sua
                                candidatura.
                              </span>
                            </div>
                          )}
                          <ResumeReviewForm
                            data={structuredData}
                            onChange={setStructuredData}
                            onConfirm={handleConfirmStructured}
                            onManualStart={handleManualStart}
                            disabled={submitting}
                            fromExtraction={wasExtracted}
                          />
                        </div>
                      )}
                    </div>

                    {/* Consentimento LGPD com data e versão */}
                    <div className="bg-sky-50/60 p-3 rounded-lg border border-sky-100 flex items-start gap-3">
                      <Checkbox
                        id="lgpd"
                        checked={lgpdConsent}
                        onCheckedChange={(checked) => setLgpdConsent(!!checked)}
                        className="mt-0.5"
                      />
                      <label
                        htmlFor="lgpd"
                        className="text-[11px] leading-tight text-slate-700 cursor-pointer"
                      >
                        <span className="font-semibold text-slate-900 block mb-0.5">
                          Consentimento para Tratamento de Dados (LGPD)
                        </span>
                        Concordo com o tratamento dos meus dados pessoais e currículo pela{' '}
                        <strong>{company?.trade_name || 'empresa'}</strong> para participação neste
                        processo seletivo e armazenamento em Banco de Talentos para futuras
                        oportunidades, com direito a revogação ou exclusão total a qualquer momento.
                      </label>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-2 border-t">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-sky-600 hover:bg-sky-700 text-white font-medium"
                    >
                      {submitting ? 'Enviando Candidatura...' : 'Confirmar e Enviar Candidatura'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
