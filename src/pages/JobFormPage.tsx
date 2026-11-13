import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { jobsService, DEFAULT_STAGES, OPTIONAL_STAGE_DEFS } from '@/services/jobs'
import pb from '@/lib/pocketbase/client'
import type {
  Job,
  JobStatus,
  WorkplaceType,
  EmploymentType,
  SeniorityLevel,
  JobStage,
  User,
} from '@/types/ats'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  DollarSign,
  Layers,
  Building2,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { SuggestedCandidatesPanel } from '@/components/SuggestedCandidatesPanel'

export const JobFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [managers, setManagers] = useState<User[]>([])

  // Form states
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [department, setDepartment] = useState('')
  const [location, setLocation] = useState('São Paulo - SP (Híbrido)')
  const [workplaceType, setWorkplaceType] = useState<WorkplaceType>('hybrid')
  const [employmentType, setEmploymentType] = useState<EmploymentType>('clt')
  const [seniority, setSeniority] = useState<SeniorityLevel>('mid')
  const [salaryMin, setSalaryMin] = useState<string>('')
  const [salaryMax, setSalaryMax] = useState<string>('')
  const [salaryDisclosed, setSalaryDisclosed] = useState(true)
  const [status, setStatus] = useState<JobStatus>('published')
  const [managerId, setManagerId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [benefits, setBenefits] = useState('')
  const [stages, setStages] = useState<JobStage[]>(DEFAULT_STAGES)
  const [highImpact, setHighImpact] = useState(false)
  const [optionalStages, setOptionalStages] = useState<string[]>([])
  // Vaga salva (criada/atualizada) — quando definida, exibe o painel de sugestões
  const [savedJob, setSavedJob] = useState<Job | null>(null)
  const [saving, setSaving] = useState(false)

  // Carregar lista de gestores/usuários
  useEffect(() => {
    async function loadManagers() {
      try {
        const usersList = await pb.collection('users').getFullList<User>()
        setManagers(usersList)
      } catch (err) {
        console.error('Erro ao carregar gestores:', err)
      }
    }
    loadManagers()
  }, [])

  // Carregar dados da vaga se estiver em edição
  useEffect(() => {
    if (!id) return
    async function loadJob() {
      try {
        setLoading(true)
        const job = await jobsService.getJobById(id)
        setTitle(job.title)
        setSlug(job.slug)
        setDepartment(job.department || '')
        setLocation(job.location || '')
        setWorkplaceType(job.workplace_type || 'hybrid')
        setEmploymentType(job.employment_type || 'clt')
        setSeniority(job.seniority || 'mid')
        setSalaryMin(job.salary_min ? String(job.salary_min) : '')
        setSalaryMax(job.salary_max ? String(job.salary_max) : '')
        setSalaryDisclosed(Boolean(job.salary_disclosed))
        setStatus(job.status || 'published')
        setManagerId(job.manager_id || '')
        setDescription(job.description || '')
        setRequirements(job.requirements || '')
        setBenefits(job.benefits || '')
        setHighImpact(Boolean(job.high_impact))
        let parsedOptional: string[] = []
        if (typeof job.optional_stages === 'string') {
          try {
            const parsed = JSON.parse(job.optional_stages)
            if (Array.isArray(parsed)) parsedOptional = parsed
          } catch (_) {
            parsedOptional = []
          }
        } else if (Array.isArray(job.optional_stages)) {
          parsedOptional = job.optional_stages
        }
        setOptionalStages(parsedOptional)
        if (Array.isArray(job.stages)) {
          // Remove as etapas opcionais para que o usuário edite apenas o fluxo base
          const baseIds = new Set(DEFAULT_STAGES.map((s) => s.id))
          setStages(job.stages.filter((s) => !baseIds.has(s.id) || !OPTIONAL_STAGE_DEFS[s.id]))
        }
      } catch (err) {
        toast({ title: 'Erro ao carregar vaga', variant: 'destructive' })
        navigate('/vagas')
      } finally {
        setLoading(false)
      }
    }
    loadJob()
  }, [id, navigate, toast])

  // Gerar slug automaticamente a partir do título se novo
  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!isEditing) {
      const generatedSlug = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setSlug(generatedSlug)
    }
  }

  const handleAddStage = () => {
    const stageId = `stage_${Date.now()}`
    setStages([...stages, { id: stageId, label: 'Nova Etapa', color: '#6366f1' }])
  }

  const handleUpdateStage = (index: number, label: string) => {
    const updated = [...stages]
    updated[index].label = label
    setStages(updated)
  }

  const handleRemoveStage = (index: number) => {
    if (stages.length <= 2) {
      toast({
        title: 'Mínimo de etapas',
        description: 'O processo deve ter no mínimo 2 etapas.',
        variant: 'destructive',
      })
      return
    }
    const updated = stages.filter((_, i) => i !== index)
    setStages(updated)
  }

  const handleToggleOptional = (stageId: string, checked: boolean) => {
    setOptionalStages((prev) => {
      if (checked) return prev.includes(stageId) ? prev : [...prev, stageId]
      return prev.filter((s) => s !== stageId)
    })
    if (stageId === 'executive_validation' && checked) {
      setHighImpact(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !slug.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Título, slug e descrição são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      setLoading(true)
      const payload: Partial<Job> = {
        title: title.trim(),
        slug: slug.trim(),
        department: department.trim(),
        location: location.trim(),
        workplace_type: workplaceType,
        employment_type: employmentType,
        seniority: seniority,
        salary_min: salaryMin ? parseFloat(salaryMin) : undefined,
        salary_max: salaryMax ? parseFloat(salaryMax) : undefined,
        salary_disclosed: salaryDisclosed,
        status: status,
        manager_id: managerId || user?.id,
        description: description.trim(),
        requirements: requirements.trim(),
        benefits: benefits.trim(),
        stages: stages,
        high_impact: highImpact,
        optional_stages: highImpact
          ? optionalStages
          : optionalStages.filter((s) => s !== 'executive_validation'),
      }

      if (isEditing && id) {
        await jobsService.updateJob(id, payload)
        toast({ title: 'Vaga atualizada!', description: 'As alterações foram salvas com sucesso.' })
        setSavedJob(await jobsService.getJobById(id))
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        const created = await jobsService.createJob(payload)
        toast({
          title: 'Vaga criada!',
          description: 'A vaga foi cadastrada e já está pronta para receber candidaturas.',
        })
        // Permanece na página para exibir o painel de candidatos sugeridos
        setSavedJob(created)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err) {
      console.error('Erro ao salvar vaga:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Verifique se o slug é único e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setSaving(false)
    }
  }

  // Painel de sugestões: vaga salva + botão de voltar
  if (savedJob) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div className="flex items-center justify-between pb-2 border-b">
          <div className="flex items-center gap-3">
            <Link to="/vagas">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Vaga salva: {savedJob.title}
              </h1>
              <p className="text-xs text-slate-500">
                O sistema analisou o banco de talentos e sugeriu candidatos com aderência a esta
                vaga.
              </p>
            </div>
          </div>
        </div>

        <SuggestedCandidatesPanel job={savedJob} />

        <div className="flex gap-2 justify-end">
          <Link to={`/pipeline/${savedJob.id}`}>
            <Button variant="outline">
              <Layers className="w-4 h-4 mr-2" />
              Abrir pipeline
            </Button>
          </Link>
          <Link to="/vagas">
            <Button>Ver todas as vagas</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-3">
          <Link to="/vagas">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isEditing ? 'Editar Vaga' : 'Criar Nova Vaga'}
            </h1>
            <p className="text-xs text-slate-500">
              Configure dados da vaga, pré-requisitos, faixa salarial e etapas do processo seletivo.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloco 1: Informações Básicas */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold">1. Informações Básicas</CardTitle>
            <CardDescription className="text-xs">
              Título e identificação da oportunidade na página pública de carreiras
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title" className="text-xs font-semibold">
                  Título da Vaga *
                </Label>
                <Input
                  id="title"
                  required
                  placeholder="Ex: Desenvolvedor Full Stack Pleno"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="slug" className="text-xs font-semibold">
                  Slug da URL (Carreiras) *
                </Label>
                <Input
                  id="slug"
                  required
                  placeholder="desenvolvedor-full-stack-pleno"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
                <span className="text-[11px] text-slate-400">
                  URL: /carreiras/vaga/<strong>{slug || 'slug-da-vaga'}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="department" className="text-xs font-semibold">
                  Área / Departamento
                </Label>
                <Input
                  id="department"
                  placeholder="Ex: Tecnologia, Vendas..."
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="location" className="text-xs font-semibold">
                  Localidade
                </Label>
                <Input
                  id="location"
                  placeholder="Ex: São Paulo - SP"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="manager" className="text-xs font-semibold">
                  Gestor Responsável
                </Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger id="manager" className="mt-1">
                    <SelectValue placeholder="Selecione o gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name || m.email} ({m.role || 'membro'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs font-semibold">Modalidade</Label>
                <Select
                  value={workplaceType}
                  onValueChange={(v) => setWorkplaceType(v as WorkplaceType)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remote">Remoto</SelectItem>
                    <SelectItem value="hybrid">Híbrido</SelectItem>
                    <SelectItem value="on_site">Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Contrato</Label>
                <Select
                  value={employmentType}
                  onValueChange={(v) => setEmploymentType(v as EmploymentType)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clt">CLT</SelectItem>
                    <SelectItem value="pj">PJ</SelectItem>
                    <SelectItem value="internship">Estágio</SelectItem>
                    <SelectItem value="temporary">Temporário</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Senioridade</Label>
                <Select value={seniority} onValueChange={(v) => setSeniority(v as SeniorityLevel)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
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

              <div>
                <Label className="text-xs font-semibold">Status Inicial</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as JobStatus)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Publicada (Aberta)</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="closed">Encerrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bloco 2: Faixa Salarial */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold">2. Faixa Salarial</CardTitle>
            <CardDescription className="text-xs">
              Remuneração prevista e visibilidade pública
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sal-min" className="text-xs font-semibold">
                  Salário Mínimo (R$)
                </Label>
                <Input
                  id="sal-min"
                  type="number"
                  placeholder="Ex: 5000"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="sal-max" className="text-xs font-semibold">
                  Salário Máximo (R$)
                </Label>
                <Input
                  id="sal-max"
                  type="number"
                  placeholder="Ex: 7500"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">
                  Divulgar salário na página de carreiras
                </Label>
                <p className="text-[11px] text-slate-500">
                  Vagas com salário visível têm maior atração no Google for Jobs.
                </p>
              </div>
              <Switch checked={salaryDisclosed} onCheckedChange={setSalaryDisclosed} />
            </div>
          </CardContent>
        </Card>

        {/* Bloco 3: Descrição e Requisitos */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold">3. Detalhes & Pré-requisitos</CardTitle>
            <CardDescription className="text-xs">
              Texto detalhado que aparecerá para o candidato
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="desc" className="text-xs font-semibold">
                Descrição do Cargo *
              </Label>
              <Textarea
                id="desc"
                required
                rows={4}
                placeholder="Descreva as responsabilidades e o escopo da posição..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="req" className="text-xs font-semibold">
                Pré-requisitos e Qualificações
              </Label>
              <Textarea
                id="req"
                rows={4}
                placeholder="• Conhecimento em React e TypeScript&#10;• Experiência de 2+ anos&#10;• Ensino superior em andamento..."
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="ben" className="text-xs font-semibold">
                Benefícios Oferecidos
              </Label>
              <Textarea
                id="ben"
                rows={3}
                placeholder="• Vale refeição / alimentação flexível&#10;• Plano de saúde sem coparticipação&#10;• Auxílio home office..."
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bloco 4: Etapas Configuráveis do Pipeline */}
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                4. Etapas Configuráveis do Pipeline
              </CardTitle>
              <CardDescription className="text-xs">
                Defina o fluxo de fases que os candidatos passarão nesta vaga
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddStage}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adicionar Etapa
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-[11px] text-slate-400 -mt-1">
              Fluxo base da vaga. As etapas opcionais (bloco 5) entram automaticamente entre estas.
            </p>
            {stages.map((stage, idx) => (
              <div
                key={stage.id}
                className="flex items-center gap-2 bg-slate-50 p-2 rounded-md border"
              >
                <GripVertical className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 w-6">#{idx + 1}</span>
                <Input
                  value={stage.label}
                  onChange={(e) => handleUpdateStage(idx, e.target.value)}
                  className="h-8 text-xs flex-1 bg-white"
                />
                <span className="text-[11px] font-mono text-slate-400 px-2">{stage.id}</span>
                {stage.id !== 'applied' && stage.id !== 'hired' && stage.id !== 'rejected' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-rose-500 hover:text-rose-700"
                    onClick={() => handleRemoveStage(idx)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Bloco 4.5: Etapas Opcionais Inteligentes */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold">5. Etapas Opcionais</CardTitle>
            <CardDescription className="text-xs">
              Ative etapas de avaliação complementares para esta vaga (são inseridas automaticamente
              no pipeline, entre as etapas padrão).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Vaga de alto impacto estratégico</Label>
                <p className="text-[11px] text-slate-500">
                  Vagas críticas para a empresa exigem validação executiva final (uma etapa extra
                  antes da Proposta).
                </p>
              </div>
              <Switch checked={highImpact} onCheckedChange={setHighImpact} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
                  optionalStages.includes('disc')
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-purple-600"
                  checked={optionalStages.includes('disc')}
                  onChange={(e) => handleToggleOptional('disc', e.target.checked)}
                />
                <span>
                  <span className="block text-xs font-semibold text-slate-900">
                    {OPTIONAL_STAGE_DEFS.disc.label}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Perfil comportamental — após a Triagem.
                  </span>
                </span>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
                  optionalStages.includes('cultural_fit')
                    ? 'border-teal-300 bg-teal-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-teal-600"
                  checked={optionalStages.includes('cultural_fit')}
                  onChange={(e) => handleToggleOptional('cultural_fit', e.target.checked)}
                />
                <span>
                  <span className="block text-xs font-semibold text-slate-900">
                    {OPTIONAL_STAGE_DEFS.cultural_fit.label}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Aderência à visão e missão — antes da Entrevista Técnica.
                  </span>
                </span>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
                  !highImpact || !optionalStages.includes('executive_validation')
                    ? 'border-slate-200 bg-white hover:bg-slate-50'
                    : 'border-rose-300 bg-rose-50'
                } ${!highImpact ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-rose-600"
                  disabled={!highImpact}
                  checked={optionalStages.includes('executive_validation')}
                  onChange={(e) => handleToggleOptional('executive_validation', e.target.checked)}
                />
                <span>
                  <span className="block text-xs font-semibold text-slate-900">
                    {OPTIONAL_STAGE_DEFS.executive_validation.label}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Só disponível quando a vaga é de alto impacto.
                  </span>
                </span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link to="/vagas">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={saving || loading}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Vaga'}
          </Button>
        </div>
      </form>
    </div>
  )
}
