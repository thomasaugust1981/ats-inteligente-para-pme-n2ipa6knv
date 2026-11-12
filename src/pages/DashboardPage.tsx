import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { jobsService } from '@/services/jobs'
import { candidatesService, applicationsService } from '@/services/candidates'
import { onboardingService } from '@/services/onboarding'
import type { Job, Candidate, Application, OnboardingStatus } from '@/types/ats'
import {
  Briefcase,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  Building2,
  FileText,
  AlertCircle,
  Plus,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/hooks/use-toast'

export const DashboardPage: React.FC = () => {
  const { user, role, isManager } = useAuth()
  const { toast } = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>('not_started')

  useEffect(() => {
    onboardingService
      .getOnboardingStatus()
      .then(setOnboardingStatus)
      .catch(() => setOnboardingStatus('not_started'))
  }, [])

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true)
        // Regra de perfil: Gestor visualiza apenas as vagas das quais é responsável
        let jobsFilter = ''
        if (isManager && user?.id) {
          jobsFilter = `manager_id = "${user.id}"`
        }

        const [jobsList, candsList, appsList] = await Promise.all([
          jobsService.listJobs(jobsFilter || undefined),
          candidatesService.listCandidates(),
          applicationsService.listApplications(),
        ])

        setJobs(jobsList)
        setCandidates(candsList)

        // Se for gestor, filtrar apenas candidaturas das suas vagas
        if (isManager && user?.id) {
          const userJobIds = new Set(jobsList.map((j) => j.id))
          setApplications(appsList.filter((a) => userJobIds.has(a.job_id)))
        } else {
          setApplications(appsList)
        }
      } catch (err) {
        console.error('Erro ao carregar dados do painel:', err)
        toast({
          title: 'Erro ao carregar o painel',
          description: 'Alguns números podem estar desatualizados. Recarregue a página.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    loadDashboardData()
  }, [user, isManager])

  const publishedJobsCount = jobs.filter((j) => j.status === 'published').length
  const activeApplicationsCount = applications.filter((a) => a.status === 'active').length
  const hiredCount = applications.filter((a) => a.status === 'hired').length

  // Origem das candidaturas
  const sourcesMap: Record<string, number> = {}
  applications.forEach((a) => {
    const src = a.source || 'direct_link'
    sourcesMap[src] = (sourcesMap[src] || 0) + 1
  })

  const getSourceDisplay = (src: string) => {
    const map: Record<string, string> = {
      google_for_jobs: 'Google for Jobs',
      whatsapp: 'WhatsApp',
      referral: 'Indicação',
      direct_link: 'Link Direto',
      linkedin: 'LinkedIn',
      other: 'Outro',
    }
    return map[src] || src
  }

  return (
    <div className="space-y-6">
      {/* Banner de retomada do onboarding (visível quando não concluído) */}
      {onboardingStatus !== 'completed' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {onboardingStatus === 'skipped'
                  ? 'Onboarding da empresa pulado — retome quando quiser'
                  : 'Você ainda não concluiu a configuração inicial da empresa'}
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Configure nome, logo, cor de marca, página de carreiras e convide sua equipe.
              </p>
            </div>
          </div>
          <Link to="/onboarding">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 shrink-0">
              {onboardingStatus === 'skipped' ? 'Retomar onboarding' : 'Concluir onboarding'}
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Painel Geral de Recrutamento
          </h1>
          <p className="text-sm text-slate-500">
            {isManager
              ? `Visão do Gestor — vagas sob sua responsabilidade`
              : `Visão Corporativa — empresa ${user?.company_name || 'Vanguard Soluções'}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/vagas/nova">
            <Button size="sm" className="bg-sky-600 hover:bg-sky-700">
              <Plus className="w-4 h-4 mr-1.5" />
              Criar Nova Vaga
            </Button>
          </Link>
          <Link to="/carreiras" target="_blank">
            <Button variant="outline" size="sm" className="text-slate-600">
              <Eye className="w-4 h-4 mr-1.5" />
              Ver Página de Carreiras
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Vagas Abertas
            </CardTitle>
            <Briefcase className="w-4 h-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{publishedJobsCount}</div>
            <p className="text-xs text-slate-500 mt-1">
              De um total de {jobs.length} posições criadas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Candidaturas Ativas
            </CardTitle>
            <Users className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{activeApplicationsCount}</div>
            <p className="text-xs text-slate-500 mt-1">Em andamento nas etapas do pipeline</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Banco de Talentos
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{candidates.length}</div>
            <p className="text-xs text-slate-500 mt-1">Perfis com consentimento LGPD ativo</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Contratações Fechadas
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{hiredCount}</div>
            <p className="text-xs text-slate-500 mt-1">Candidatos contratados no sistema</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vagas em destaque com atalho para Pipeline */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Processos Seletivos em Andamento
                </CardTitle>
                <CardDescription className="text-xs">
                  Vagas publicadas e distribuição rápida dos inscritos
                </CardDescription>
              </div>
              <Link to="/vagas">
                <Button variant="ghost" size="sm" className="text-xs text-sky-600">
                  Ver Todas ({jobs.length})
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingState message="Carregando vagas..." className="py-8" />
              ) : jobs.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="Nenhuma vaga cadastrada ainda"
                  description="Crie sua primeira vaga para começar a receber candidaturas e acompanhar o pipeline."
                  actions={[{ label: 'Cadastrar Primeira Vaga', to: '/vagas/nova', icon: Plus }]}
                />
              ) : (
                <div className="divide-y">
                  {jobs.slice(0, 5).map((job) => {
                    const jobApps = applications.filter((a) => a.job_id === job.id)
                    return (
                      <div
                        key={job.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">
                              {job.title}
                            </span>
                            <Badge
                              variant={job.status === 'published' ? 'default' : 'secondary'}
                              className="text-[10px] uppercase"
                            >
                              {job.status === 'published' ? 'Publicada' : job.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{job.department || 'Geral'}</span>
                            <span>•</span>
                            <span>{job.location}</span>
                            <span>•</span>
                            <span className="font-medium text-slate-700">
                              {jobApps.length} inscritos
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link to={`/pipeline/${job.id}`}>
                            <Button size="sm" variant="outline" className="text-xs h-8">
                              Abrir Pipeline
                              <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Candidaturas Recentes */}
          <Card className="bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Candidaturas Recentes
                </CardTitle>
                <CardDescription className="text-xs">
                  Últimos inscritos recebidos pelos canais
                </CardDescription>
              </div>
              <Link to="/candidatos">
                <Button variant="ghost" size="sm" className="text-xs text-sky-600">
                  Banco de Candidatos
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingState message="Carregando candidaturas..." className="py-8" />
              ) : applications.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Nenhuma candidatura ainda"
                  description="Divulgue o link público das suas vagas publicadas para começar a receber candidatos."
                  actions={[{ label: 'Ir para Minhas Vagas', to: '/vagas', icon: Briefcase }]}
                />
              ) : (
                <div className="divide-y">
                  {applications.slice(0, 4).map((app) => (
                    <div key={app.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">
                          {app.expand?.candidate_id?.name || 'Candidato'}
                        </div>
                        <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Vaga: {app.expand?.job_id?.title || 'Posição'}</span>
                          <span>•</span>
                          <span>
                            Canal:{' '}
                            <strong className="text-slate-700">
                              {getSourceDisplay(app.source)}
                            </strong>
                          </span>
                        </div>
                      </div>
                      <Link to={`/candidato/${app.candidate_id}?appId=${app.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-sky-600">
                          Ver Perfil
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lado Direito: Origem das Candidaturas & LGPD Compliance */}
        <div className="space-y-4">
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900">
                Canais de Atração (Origem)
              </CardTitle>
              <CardDescription className="text-xs">
                Mapeamento do canal de entrada das candidaturas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.keys(sourcesMap).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  Assim que chegarem candidaturas, mostramos aqui por qual canal (WhatsApp,
                  LinkedIn, indicação…) elas entraram.
                </p>
              ) : (
                Object.entries(sourcesMap).map(([src, count]) => {
                  const pct = Math.round((count / (applications.length || 1)) * 100)
                  return (
                    <div key={src} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-700">{getSourceDisplay(src)}</span>
                        <span className="text-slate-500">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-sky-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Bloco LGPD & Auditoria */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-sm font-bold">Conformidade LGPD</CardTitle>
              </div>
              <CardDescription className="text-slate-300 text-xs">
                Trilha de auditoria integral e exclusão permanente garantida
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs space-y-2 text-slate-300">
              <p>• 100% dos candidatos registram aceite com timestamp legal (data/hora).</p>
              <p>• Acesso restrito a gestores apenas para suas respectivas vagas.</p>
              <p>• Exclusão real e definitiva de dados disponível na tela do candidato.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
