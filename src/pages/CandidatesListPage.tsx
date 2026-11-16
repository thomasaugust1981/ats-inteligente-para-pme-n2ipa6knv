import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { candidatesService, applicationsService, auditService } from '@/services/candidates'
import { jobsService } from '@/services/jobs'
import type { Candidate, SeniorityLevel, CandidateAvailability, Job } from '@/types/ats'
import {
  Users,
  Search,
  Filter,
  MapPin,
  FileText,
  ExternalLink,
  ShieldCheck,
  Trash2,
  Clock,
  Sparkles,
  Calendar,
  X,
  Briefcase,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import LgpdDeleteDialog from '@/components/candidates/LgpdDeleteDialog'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { useCopyLink } from '@/hooks/use-copy-link'
import { useActiveCompany } from '@/hooks/use-active-company'
import {
  fetchAllApplications,
  latestRejectionsByCandidate,
  type RejectionInfo,
} from '@/lib/candidateSuggest'

export const CandidatesListPage: React.FC = () => {
  const { activeCompanyId, companyVersion } = useActiveCompany()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [rejections, setRejections] = useState<Map<string, RejectionInfo & { created: string }>>(
    new Map(),
  )
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const { copyLink } = useCopyLink()
  const [lgpdTarget, setLgpdTarget] = useState<{
    id: string
    name: string
    hasResume: boolean
    appsCount: number
  } | null>(null)

  // Filtros solicitados na especificação: competência, senioridade, localidade e disponibilidade
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSeniority, setSelectedSeniority] = useState<string>('all')
  const [selectedAvailability, setSelectedAvailability] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState('')
  const [skillFilter, setSkillFilter] = useState('')

  const loadCandidates = async () => {
    try {
      setLoading(true)
      const list = await candidatesService.listCandidates(
        activeCompanyId ? `company_id = "${activeCompanyId}"` : undefined,
      )
      const apps = await fetchAllApplications(
        activeCompanyId ? `job_id.company_id = "${activeCompanyId}"` : undefined,
      )
      setRejections(latestRejectionsByCandidate(apps))
      setAppsByCandidate(
        new Map(
          Array.from(
            apps.reduce((acc, a) => {
              const key = a.candidate_id
              const list = acc.get(key) || []
              acc.set(key, [...list, a])
              return acc
            }, new Map<string, typeof apps>()),
          ),
        ),
      )
      setCandidates(list)
    } catch (err) {
      console.error('Erro ao carregar candidatos:', err)
      toast({
        title: 'Erro ao listar candidatos',
        description: 'Verifique sua conexão e tente recarregar a página.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCandidates()
  }, [activeCompanyId, companyVersion])

  const [lgpdDialogOpen, setLgpdDialogOpen] = useState(false)
  const [lgpdBusy, setLgpdBusy] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [appsByCandidate, setAppsByCandidate] = useState<Map<string, any[]>>(new Map())

  const handlePermanentDelete = async () => {
    if (!lgpdTarget) return
    const { id, name } = lgpdTarget
    setLgpdBusy(true)
    try {
      const result = await candidatesService.deleteCandidateRealLGPD(id)
      const d = result.deleted || {}
      toast({
        title: 'Dados excluídos com sucesso (LGPD)',
        description:
          `Candidaturas: ${d.applications ?? 0} · Scores de IA: ${d.ai_scores ?? 0} · ` +
          `DISC: ${d.disc_results ?? 0} · Fichas CHA: ${d.cha_evaluations ?? 0}. ` +
          `Currículo de ${name} removido e auditoria anonimizada.`,
      })
      setLgpdTarget(null)
      setLgpdDialogOpen(false)
      loadCandidates()
    } catch (err) {
      toast({
        title: 'Erro ao excluir candidato',
        description:
          err instanceof Error && err.message
            ? err.message
            : 'Não foi possível completar a exclusão. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLgpdBusy(false)
    }
  }

  const filteredCandidates = candidates.filter((cand) => {
    const matchesSearch =
      cand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cand.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesSeniority = selectedSeniority === 'all' || cand.seniority === selectedSeniority

    const matchesAvailability =
      selectedAvailability === 'all' || cand.availability === selectedAvailability

    const matchesLocation =
      !locationFilter.trim() ||
      (cand.location && cand.location.toLowerCase().includes(locationFilter.toLowerCase()))

    const matchesSkill =
      !skillFilter.trim() ||
      (cand.skills && cand.skills.toLowerCase().includes(skillFilter.toLowerCase()))

    return (
      matchesSearch && matchesSeniority && matchesAvailability && matchesLocation && matchesSkill
    )
  })

  const getSeniorityLabel = (s?: string) => {
    const map: Record<string, string> = {
      intern: 'Estágio',
      junior: 'Júnior',
      mid: 'Pleno',
      senior: 'Sênior',
      lead: 'Especialista / Lead',
    }
    return s ? map[s] || s : 'Não informado'
  }

  const getAvailabilityLabel = (a?: string) => {
    const map: Record<string, string> = {
      immediate: 'Imediata',
      two_weeks: 'Em 2 semanas',
      one_month: 'Em 30 dias',
      exploring: 'Apenas avaliando',
    }
    return a ? map[a] || a : 'Não informada'
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Banco de Talentos & Candidatos
          </h1>
          <p className="text-sm text-slate-500">
            Consulte todos os candidatos cadastrados com filtros por competência, senioridade,
            localidade e disponibilidade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200 py-1.5 px-3"
          >
            <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
            Consentimento LGPD Ativo
          </Badge>
        </div>
      </div>

      {/* Barra de Filtros avançados */}
      <Card className="bg-white">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                className="pl-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="relative">
              <Sparkles className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Filtrar por competência (ex: React, SQL)..."
                className="pl-9 text-xs"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
              />
            </div>

            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Filtrar por localidade (ex: SP, Remoto)..."
                className="pl-9 text-xs"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div>
              <Select value={selectedSeniority} onValueChange={setSelectedSeniority}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Senioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Senioridades</SelectItem>
                  <SelectItem value="intern">Estágio</SelectItem>
                  <SelectItem value="junior">Júnior</SelectItem>
                  <SelectItem value="mid">Pleno</SelectItem>
                  <SelectItem value="senior">Sênior</SelectItem>
                  <SelectItem value="lead">Especialista / Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={selectedAvailability} onValueChange={setSelectedAvailability}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Disponibilidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer Disponibilidade</SelectItem>
                  <SelectItem value="immediate">Imediata</SelectItem>
                  <SelectItem value="two_weeks">Em 2 semanas</SelectItem>
                  <SelectItem value="one_month">Em 30 dias</SelectItem>
                  <SelectItem value="exploring">Apenas avaliando</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-slate-500"
                onClick={() => {
                  setSearchTerm('')
                  setSkillFilter('')
                  setLocationFilter('')
                  setSelectedSeniority('all')
                  setSelectedAvailability('all')
                }}
              >
                Limpar Filtros
              </Button>
              <Badge variant="secondary" className="text-xs py-1">
                {filteredCandidates.length} candidatos encontrados
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Candidatos */}
      {loading ? (
        <LoadingState message="Carregando candidatos..." />
      ) : filteredCandidates.length === 0 ? (
        candidates.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum candidato no banco de talentos ainda"
            description="À medida que as pessoas se candidatarem nas suas vagas publicadas, elas aparecerão aqui com currículo, competências e consentimento LGPD."
            actions={[
              { label: 'Publicar uma vaga', to: '/vagas', icon: Briefcase },
              { label: 'Ver página de carreiras', to: '/carreiras', icon: ExternalLink },
            ]}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Nenhum candidato encontrado com esses filtros"
            description="Nenhum candidato corresponde à busca ou aos filtros selecionados. Ajuste ou limpe os filtros para ver mais resultados."
            actions={[
              {
                label: 'Limpar filtros',
                onClick: () => {
                  setSearchTerm('')
                  setSkillFilter('')
                  setLocationFilter('')
                  setSelectedSeniority('all')
                  setSelectedAvailability('all')
                },
                icon: X,
              },
            ]}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCandidates.map((candidate) => (
            <Card
              key={candidate.id}
              className="bg-white hover:border-slate-300 transition flex flex-col"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base font-bold text-slate-900">
                      {candidate.name}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span>{candidate.email}</span>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[11px] bg-slate-50 shrink-0">
                    {getSeniorityLabel(candidate.seniority)}
                  </Badge>
                </div>
                {rejections.get(candidate.id) && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 shrink-0"
                    >
                      Reprovado
                    </Badge>
                    {rejections.get(candidate.id)!.reason && (
                      <span
                        className="text-[10px] text-rose-600 truncate"
                        title={rejections.get(candidate.id)!.reason}
                      >
                        {rejections.get(candidate.id)!.reason}
                      </span>
                    )}
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex-1 text-xs space-y-3 pb-3">
                <div className="grid grid-cols-2 gap-2 text-slate-600 bg-slate-50 p-2 rounded">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Localidade</span>
                    <span className="font-medium text-slate-700 truncate block">
                      {candidate.location || 'Não informada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Disponibilidade</span>
                    <span className="font-medium text-slate-700 truncate block">
                      {getAvailabilityLabel(candidate.availability)}
                    </span>
                  </div>
                </div>

                {candidate.skills && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 uppercase font-semibold">
                      Competências
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {candidate.skills
                        .split(',')
                        .slice(0, 4)
                        .map((sk, idx) => (
                          <span
                            key={idx}
                            className="bg-sky-50 text-sky-700 text-[10px] px-1.5 py-0.5 rounded border border-sky-100"
                          >
                            {sk.trim()}
                          </span>
                        ))}
                      {candidate.skills.split(',').length > 4 && (
                        <span className="text-[10px] text-slate-400 px-1 py-0.5">
                          +{candidate.skills.split(',').length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 text-[11px] text-emerald-700 pt-1 border-t">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    LGPD Aceito:{' '}
                    {new Date(candidate.lgpd_consent_date || candidate.created).toLocaleDateString(
                      'pt-BR',
                    )}
                  </span>
                </div>
              </CardContent>

              <div className="p-3 border-t bg-slate-50/50 flex items-center justify-between gap-2">
                <Link to={`/candidato/${candidate.id}`}>
                  <Button size="sm" variant="outline" className="text-xs h-8">
                    Ver Perfil Completo
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
                  onClick={() =>
                    setLgpdTarget({
                      id: candidate.id,
                      name: candidate.name,
                      hasResume: !!candidate.resume,
                      appsCount: appsByCandidate.get(candidate.id)?.length || 0,
                    })
                  }
                  title="Exclusão real LGPD"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Excluir LGPD
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Exclusão LGPD — mesmo diálogo padrão do perfil: lista o que será
          apagado/anonimizado, exige digitar EXCLUIR e marcar o checkbox LGPD. */}
      <LgpdDeleteDialog
        open={!!lgpdTarget}
        onOpenChange={(open) => {
          setLgpdDialogOpen(open)
          if (!open) setLgpdTarget(null)
        }}
        candidateName={lgpdTarget?.name || ''}
        applicationsCount={lgpdTarget?.appsCount || 0}
        hasResume={!!lgpdTarget?.hasResume}
        onConfirm={handlePermanentDelete}
      />
    </div>
  )
}
