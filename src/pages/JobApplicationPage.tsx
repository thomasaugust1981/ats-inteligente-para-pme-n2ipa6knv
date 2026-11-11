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

  // Detecção do canal / origem (Query param ?origem= ou ?utm_source= ou referer)
  const [source, setSource] = useState<ApplicationSource>('direct_link')

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
        if (!name && existing.name) setName(existing.name)
        if (!phone && existing.phone) setPhone(existing.phone)
        if (!cpf && existing.cpf) setCpf(existing.cpf)
        if (!linkedin && existing.linkedin) setLinkedin(existing.linkedin)
        if (!location && existing.location) setLocation(existing.location)
        if (existing.seniority) setSeniority(existing.seniority)
        if (!skills && existing.skills) setSkills(existing.skills)
        if (existing.availability) setAvailability(existing.availability)

        toast({
          title: 'Dados pré-carregados!',
          description:
            'Encontramos seu cadastro no Banco de Talentos. Você pode atualizar seus dados ou currículo se desejar.',
        })
      }
    } catch (_) {
      // Silencioso se não encontrar
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Arquivo inválido',
          description: 'Por favor envie apenas currículos em formato PDF.',
          variant: 'destructive',
        })
        return
      }
      if (file.size > 15 * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: 'O tamanho máximo do currículo é de 15MB.',
          variant: 'destructive',
        })
        return
      }
      setResumeFile(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!job) return

    if (!lgpdConsent) {
      toast({
        title: 'Consentimento obrigatório',
        description:
          'Você precisa autorizar o tratamento de dados conforme a LGPD para submeter sua candidatura.',
        variant: 'destructive',
      })
      return
    }

    if (!name.trim() || !email.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor preencha nome completo e e-mail válido.',
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
        description:
          'Não foi possível registrar a candidatura. Verifique os dados e tente novamente.',
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Carregando detalhes da oportunidade...
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Vaga não encontrada</h2>
        <p className="text-slate-500 text-sm mt-1 mb-4">
          Esta posição pode ter sido encerrada ou movida.
        </p>
        <Link to="/carreiras">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para a página de vagas
          </Button>
        </Link>
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
                    Preencha os campos abaixo e anexe seu currículo em PDF.
                  </CardDescription>
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

                    {/* Upload de Currículo em PDF */}
                    <div>
                      <Label className="text-xs font-semibold">
                        Currículo em PDF <span className="text-rose-500">*</span>
                      </Label>
                      <div className="mt-1 border-2 border-dashed rounded-lg p-4 text-center hover:bg-slate-50 cursor-pointer transition">
                        <input
                          id="resume-file"
                          type="file"
                          accept="application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
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
                                Clique para anexar o currículo em PDF
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Máximo 15MB (.pdf)
                              </p>
                            </div>
                          )}
                        </label>
                      </div>
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
