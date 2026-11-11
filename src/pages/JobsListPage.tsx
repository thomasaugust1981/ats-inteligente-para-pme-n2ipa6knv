import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { jobsService } from '@/services/jobs'
import type {
  Job,
  JobStatus,
  WorkplaceType,
  EmploymentType,
  SeniorityLevel,
  JobStage,
} from '@/types/ats'
import {
  Plus,
  Search,
  ExternalLink,
  Share2,
  Edit3,
  Trash2,
  CheckCircle,
  Clock,
  DollarSign,
  Briefcase,
  Users,
  Building2,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { useToast } from '@/hooks/use-toast'

export const JobsListPage: React.FC = () => {
  const { user, isManager, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const loadJobs = async () => {
    try {
      setLoading(true)
      let filter = ''
      if (isManager && user?.id) {
        filter = `manager_id = "${user.id}"`
      }
      const list = await jobsService.listJobs(filter || undefined)
      setJobs(list)
    } catch (err) {
      console.error('Erro ao listar vagas:', err)
      toast({ title: 'Erro ao carregar vagas', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
  }, [user, isManager])

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/carreiras/vaga/${slug}?origem=direct_link`
    navigator.clipboard.writeText(url)
    toast({
      title: 'Link copiado!',
      description: 'Link direto da vaga copiado com tag de origem configurada.',
    })
  }

  const handleToggleStatus = async (job: Job, newStatus: JobStatus) => {
    try {
      await jobsService.updateJob(job.id, { status: newStatus })
      toast({ title: 'Status da vaga atualizado', description: `Vaga alterada para ${newStatus}.` })
      loadJobs()
    } catch (err) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' })
    }
  }

  const handleDelete = async (jobId: string) => {
    if (
      !window.confirm(
        'Tem certeza que deseja excluir esta vaga? Candidaturas vinculadas serão afetadas.',
      )
    ) {
      return
    }
    try {
      await jobsService.deleteJob(jobId)
      toast({ title: 'Vaga excluída com sucesso' })
      loadJobs()
    } catch (err) {
      toast({ title: 'Erro ao excluir vaga', variant: 'destructive' })
    }
  }

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.department && job.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (job.location && job.location.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-emerald-600">Publicada</Badge>
      case 'draft':
        return (
          <Badge variant="outline" className="text-slate-600 border-slate-300">
            Rascunho
          </Badge>
        )
      case 'paused':
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            Pausada
          </Badge>
        )
      case 'closed':
        return <Badge variant="destructive">Encerrada</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gestão de Vagas</h1>
          <p className="text-sm text-slate-500">
            {isManager
              ? 'Vagas onde você é o gestor responsável direto.'
              : 'Gerencie todas as posições abertas, salários, requisitos e etapas.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/vagas/nova">
            <Button className="bg-sky-600 hover:bg-sky-700">
              <Plus className="w-4 h-4 mr-1.5" />
              Criar Vaga
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white p-4 rounded-xl border flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por título, área ou localidade..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="published">Publicadas</SelectItem>
              <SelectItem value="draft">Rascunhos</SelectItem>
              <SelectItem value="paused">Pausadas</SelectItem>
              <SelectItem value="closed">Encerradas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de Vagas */}
      {loading ? (
        <div className="py-12 text-center text-slate-500">Carregando vagas...</div>
      ) : filteredJobs.length === 0 ? (
        <Card className="text-center py-12 bg-white">
          <CardContent>
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-800">Nenhuma vaga encontrada</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Crie uma nova oportunidade com requisitos, faixa salarial e etapas do processo.
            </p>
            <Link to="/vagas/nova">
              <Button size="sm">Criar Nova Vaga</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <Card key={job.id} className="flex flex-col bg-white hover:border-slate-300 transition">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                    {job.department || 'Geral'}
                  </span>
                  {getStatusBadge(job.status)}
                </div>
                <CardTitle className="text-lg font-bold text-slate-900 line-clamp-1">
                  {job.title}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 flex items-center gap-2">
                  <span>{job.location}</span>
                  <span>•</span>
                  <span>
                    {job.workplace_type === 'remote'
                      ? 'Remoto'
                      : job.workplace_type === 'hybrid'
                        ? 'Híbrido'
                        : 'Presencial'}
                  </span>
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 pb-4 text-xs space-y-3">
                <div className="text-slate-600 line-clamp-2">{job.description}</div>

                <div className="bg-slate-50 p-2.5 rounded border space-y-1">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold">Faixa Salarial:</span>
                    <span>
                      {job.salary_disclosed && job.salary_min
                        ? `R$ ${job.salary_min.toLocaleString('pt-BR')} - R$ ${(job.salary_max || job.salary_min).toLocaleString('pt-BR')}`
                        : 'Confidencial'}
                    </span>
                  </div>
                  {job.expand?.manager_id && (
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Gestor:</span>
                      <span className="font-medium text-slate-700">
                        {job.expand.manager_id.name}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-2 border-t flex flex-col gap-2">
                <div className="flex items-center justify-between w-full">
                  <Link to={`/pipeline/${job.id}`}>
                    <Button size="sm" className="bg-sky-600 hover:bg-sky-700 h-8 text-xs">
                      <Users className="w-3.5 h-3.5 mr-1" />
                      Pipeline
                    </Button>
                  </Link>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500"
                      title="Copiar link com origem"
                      onClick={() => handleCopyLink(job.slug)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>

                    <Link to={`/vagas/editar/${job.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500"
                        title="Editar Vaga"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    </Link>

                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-500 hover:text-rose-700"
                        title="Excluir Vaga"
                        onClick={() => handleDelete(job.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Alternância rápida de status */}
                <div className="w-full flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t">
                  <span>Alterar status:</span>
                  <div className="flex gap-1.5">
                    {job.status !== 'published' && (
                      <button
                        onClick={() => handleToggleStatus(job, 'published')}
                        className="text-emerald-600 hover:underline font-medium"
                      >
                        Publicar
                      </button>
                    )}
                    {job.status !== 'paused' && (
                      <button
                        onClick={() => handleToggleStatus(job, 'paused')}
                        className="text-amber-600 hover:underline font-medium"
                      >
                        Pausar
                      </button>
                    )}
                    {job.status !== 'closed' && (
                      <button
                        onClick={() => handleToggleStatus(job, 'closed')}
                        className="text-rose-600 hover:underline font-medium"
                      >
                        Encerrar
                      </button>
                    )}
                  </div>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
