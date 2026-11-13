import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { jobsService, DEFAULT_STAGES, OPTIONAL_STAGE_DEFS } from '@/services/jobs'
import pb from '@/lib/pocketbase/client'
import type { Job, JobStage, User } from '@/types/ats'
import { ArrowLeft, Save, Layers, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { SuggestedCandidatesPanel } from '@/components/SuggestedCandidatesPanel'
import { BasicInfoCard } from '@/components/jobForm/BasicInfoCard'
import { DescriptionCard } from '@/components/jobForm/DescriptionCard'
import { StagesCard } from '@/components/jobForm/StagesCard'
import type { JobFormValues, JobFormErrors, SetJobFormField } from '@/components/jobForm/types'

const INITIAL_VALUES: JobFormValues = {
  title: '',
  slug: '',
  department: '',
  location: 'São Paulo - SP (Híbrido)',
  workplaceType: 'hybrid',
  employmentType: 'clt',
  seniority: 'mid',
  salaryMin: '',
  salaryMax: '',
  salaryDisclosed: true,
  status: 'published',
  managerId: '',
  description: '',
  requirements: '',
  benefits: '',
}

export const JobFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [managers, setManagers] = useState<User[]>([])
  const [values, setValues] = useState<JobFormValues>(INITIAL_VALUES)
  const [stages, setStages] = useState<JobStage[]>(DEFAULT_STAGES)
  const [highImpact, setHighImpact] = useState(false)
  const [optionalStages, setOptionalStages] = useState<string[]>([])
  // Vaga salva (criada/atualizada) — quando definida, exibe o painel de sugestões
  const [savedJob, setSavedJob] = useState<Job | null>(null)
  // Erros de validação, exibidos junto a cada campo
  const [errors, setErrors] = useState<JobFormErrors>({})

  /** Setter único: mantém os tipos de cada campo e limpa o erro do campo ao digitar. */
  const setField: SetJobFormField = (field, value) => {
    // Título gera o slug automaticamente (apenas em criação)
    if (field === 'title' && !isEditing) {
      const generatedSlug = String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setValues((prev) => ({ ...prev, title: String(value), slug: generatedSlug }))
      setErrors((prev) => ({ ...prev, title: '', slug: '' }))
      return
    }
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

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
        setValues({
          title: job.title,
          slug: job.slug,
          department: job.department || '',
          location: job.location || '',
          workplaceType: job.workplace_type || 'hybrid',
          employmentType: job.employment_type || 'clt',
          seniority: job.seniority || 'mid',
          salaryMin: job.salary_min ? String(job.salary_min) : '',
          salaryMax: job.salary_max ? String(job.salary_max) : '',
          salaryDisclosed: Boolean(job.salary_disclosed),
          status: job.status || 'published',
          managerId: job.manager_id || '',
          description: job.description || '',
          requirements: job.requirements || '',
          benefits: job.benefits || '',
        })
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

  const handleAddStage = () => {
    setStages((prev) => [
      ...prev,
      { id: `stage_${Date.now()}`, label: 'Nova Etapa', color: '#6366f1' },
    ])
  }

  const handleUpdateStage = (index: number, label: string) => {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, label } : s)))
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
    setStages((prev) => prev.filter((_, i) => i !== index))
  }

  // O flag de alto impacto controla a Validação Executiva: ao desligá-lo,
  // a etapa deixa de estar selecionada (em vez de ser filtrada silenciosamente no submit).
  const handleHighImpactChange = (checked: boolean) => {
    setHighImpact(checked)
    if (!checked) {
      setOptionalStages((prev) => prev.filter((s) => s !== 'executive_validation'))
    }
  }

  const handleToggleOptional = (stageId: string, checked: boolean) => {
    setOptionalStages((prev) => {
      if (checked) return prev.includes(stageId) ? prev : [...prev, stageId]
      return prev.filter((s) => s !== stageId)
    })
    // Marcar a Validação Executiva liga o flag de alto impacto automaticamente
    if (stageId === 'executive_validation' && checked && !highImpact) {
      setHighImpact(true)
    }
  }

  // Validação com erros exibidos junto a cada campo (em pt-BR)
  const validate = (): boolean => {
    const next: JobFormErrors = {}
    if (!values.title.trim()) next.title = 'Informe o título da vaga.'
    if (!values.slug.trim()) {
      next.slug = 'Informe o slug da URL.'
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug.trim())) {
      next.slug = 'Use apenas letras minúsculas, números e hífens (ex.: vendedor-pleno).'
    }
    if (!values.description.trim()) next.description = 'Descreva as responsabilidades do cargo.'
    const min = parseFloat(values.salaryMin)
    const max = parseFloat(values.salaryMax)
    if (values.salaryMin && values.salaryMax && !isNaN(min) && !isNaN(max) && min > max) {
      next.salaryMax = 'O salário máximo deve ser maior ou igual ao mínimo.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      toast({
        title: 'Revise o formulário',
        description: 'Alguns campos obrigatórios precisam de atenção.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      setLoading(true)
      const payload: Partial<Job> = {
        title: values.title.trim(),
        slug: values.slug.trim(),
        department: values.department.trim(),
        location: values.location.trim(),
        workplace_type: values.workplaceType,
        employment_type: values.employmentType,
        seniority: values.seniority,
        salary_min: values.salaryMin ? parseFloat(values.salaryMin) : undefined,
        salary_max: values.salaryMax ? parseFloat(values.salaryMax) : undefined,
        salary_disclosed: values.salaryDisclosed,
        status: values.status,
        manager_id: values.managerId || user?.id,
        description: values.description.trim(),
        requirements: values.requirements.trim(),
        benefits: values.benefits.trim(),
        stages: stages,
        high_impact: highImpact,
        optional_stages: optionalStages,
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
          description: 'Confira abaixo os candidatos sugeridos para esta vaga.',
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

  // Painel de sugestões: vaga salva + próximos passos (os dados do formulário
  // permanecem no estado — "Continuar editando" volta sem perder nada)
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
          <Button variant="ghost" onClick={() => setSavedJob(null)}>
            <Pencil className="w-4 h-4 mr-2" />
            Continuar editando
          </Button>
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
              Preencha os dados, configure as etapas do processo e salve para ver os candidatos
              sugeridos.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloco 1: Dados da Vaga (identificação, salário e status) */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold">1. Dados da Vaga</CardTitle>
            <CardDescription className="text-xs">
              Identificação, local de trabalho, remuneração e status inicial
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BasicInfoCard values={values} managers={managers} errors={errors} onField={setField} />
          </CardContent>
        </Card>

        {/* Bloco 2: Descrição e Pré-requisitos */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold">2. Descrição & Pré-requisitos</CardTitle>
            <CardDescription className="text-xs">
              Texto detalhado que aparecerá para o candidato
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DescriptionCard values={values} errors={errors} onField={setField} />
          </CardContent>
        </Card>

        {/* Bloco 3: Etapas do processo (fixas + opcionais juntas) */}
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">3. Etapas do Processo</CardTitle>
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
          <CardContent>
            <StagesCard
              stages={stages}
              highImpact={highImpact}
              optionalStages={optionalStages}
              errors={errors}
              onAddStage={handleAddStage}
              onUpdateStage={handleUpdateStage}
              onRemoveStage={handleRemoveStage}
              onHighImpactChange={handleHighImpactChange}
              onToggleOptional={handleToggleOptional}
            />
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
            {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Vaga'}
          </Button>
        </div>
      </form>
    </div>
  )
}
