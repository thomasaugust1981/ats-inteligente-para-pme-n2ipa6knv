import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { jobsService } from '@/services/jobs'
import { applicationsService, auditService } from '@/services/candidates'
import { calculateScore } from '@/services/aiScore'
import type { Job, Application, JobStage, User } from '@/types/ats'
import {
  Users,
  ArrowLeft,
  MoveRight,
  Eye,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Filter,
  AlertCircle,
  Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useToast } from '@/hooks/use-toast'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { useCopyLink } from '@/hooks/use-copy-link'
import { useActiveCompany } from '@/hooks/use-active-company'
import StageOwnerSettings from '@/components/StageOwnerSettings'
import { DiscFitPanel } from '@/components/DiscFitPanel'
import { AiScoreBadge } from '@/components/AiScoreBadge'
import { Plus, BellRing } from 'lucide-react'

export const PipelinePage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>()
  const { user, isManager } = useAuth()
  const { activeCompanyId, companyVersion } = useActiveCompany()
  const { toast } = useToast()
  const { copyLink } = useCopyLink()

  const [job, setJob] = useState<Job | null>(null)
  const [allJobs, setAllJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  // Modal para mover candidato com justificativa
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [targetStageId, setTargetStageId] = useState('')
  const [moveReason, setMoveReason] = useState('')
  const [moveComment, setMoveComment] = useState('')
  const [moving, setMoving] = useState(false)

  // Dialog de responsáveis e notificações por etapa (por vaga)
  const [ownersModalOpen, setOwnersModalOpen] = useState(false)
  // Dialog de resultado DISC + FIT cultural (por candidatura)
  const [discModalOpen, setDiscModalOpen] = useState(false)
  const [ownersSaveSignal, setOwnersSaveSignal] = useState(0)
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    if (!ownersModalOpen || users.length > 0) return
    let cancelled = false
    pb.collection('users')
      .getFullList<User>({ filter: "email != 'ai-service@ats.internal'", sort: 'name' })
      .then((list) => {
        if (!cancelled) setUsers(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [ownersModalOpen, users.length])

  const loadPipeline = async (targetJobId: string) => {
    try {
      setLoading(true)
      const [currentJob, appsList, jobsList] = await Promise.all([
        jobsService.getJobById(targetJobId),
        applicationsService.listApplications(targetJobId),
        jobsService.listJobs(
          [
            activeCompanyId ? `company_id = "${activeCompanyId}"` : '',
            isManager && user?.id ? `manager_id = "${user.id}"` : '',
          ]
            .filter(Boolean)
            .join(' && ') || undefined,
        ),
      ])
      setJob(currentJob)
      setApplications(appsList)
      setAllJobs(jobsList)
    } catch (err) {
      console.error('Erro ao carregar pipeline:', err)
      toast({
        title: 'Erro ao carregar pipeline da vaga',
        description: 'Não foi possível carregar o quadro. Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (jobId) {
      loadPipeline(jobId)
    } else {
      // Se não passou jobId, busca a primeira vaga disponível (da empresa ativa)
      jobsService
        .listJobs(activeCompanyId ? `company_id = "${activeCompanyId}"` : undefined)
        .then((list) => {
          if (list.length > 0) {
            loadPipeline(list[0].id)
          } else {
            setLoading(false)
          }
        })
    }
  }, [jobId, activeCompanyId, companyVersion])

  const stages: JobStage[] = Array.isArray(job?.stages) ? job!.stages : []

  const handleOpenMoveModal = (app: Application, nextStageId: string) => {
    setSelectedApp(app)
    setTargetStageId(nextStageId)
    setMoveReason('')
    setMoveComment('')
    setMoveModalOpen(true)
  }

  const handleConfirmMove = async () => {
    if (!selectedApp || !targetStageId) return

    if (targetStageId === 'rejected' && !moveReason.trim()) {
      toast({
        title: 'Justificativa obrigatória',
        description:
          'Para reprovar o candidato, é necessário informar o motivo para a trilha de auditoria.',
        variant: 'destructive',
      })
      return
    }

    try {
      setMoving(true)
      await applicationsService.updateStage(
        selectedApp.id,
        targetStageId,
        selectedApp.stage_id,
        moveReason.trim(),
        moveComment.trim() || undefined,
      )

      toast({
        title: 'Candidato movimentado com sucesso!',
        description: `Movido para a etapa com justificativa registrada na auditoria.`,
      })

      setMoveModalOpen(false)

      // Gatilho de recálculo do score de IA (consultivo) — falha silenciosa:
      // o score anterior permanece visível até o próximo cálculo.
      calculateScore(selectedApp.id, 'stage_change').catch(() => {})

      if (job) {
        loadPipeline(job.id)
      }
    } catch (err) {
      console.error('Erro ao mover candidato:', err)
      toast({
        title: 'Erro ao mover candidato',
        description: 'O candidato permanece na etapa anterior. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setMoving(false)
    }
  }

  const getSourceBadge = (src: string) => {
    switch (src) {
      case 'google_for_jobs':
        return (
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
            Google
          </Badge>
        )
      case 'whatsapp':
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            WhatsApp
          </Badge>
        )
      case 'referral':
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-purple-50 text-purple-700 border-purple-200"
          >
            Indicação
          </Badge>
        )
      case 'linkedin':
        return (
          <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
            LinkedIn
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">
            Direto
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar com seletor de vaga */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-3">
          <Link to="/vagas">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Pipeline de Seleção
            </h1>
            <p className="text-xs text-slate-500">
              Quadro visual de etapas com movimentação do candidato e justificativa de auditoria.
            </p>
          </div>
        </div>

        {/* Seletor de Vagas */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-slate-500 shrink-0">Vaga selecionada:</Label>
          <Select
            value={job?.id || ''}
            onValueChange={(val) => {
              window.location.href = `/pipeline/${val}`
            }}
          >
            <SelectTrigger className="w-[260px] text-xs">
              <SelectValue placeholder="Selecione a vaga" />
            </SelectTrigger>
            <SelectContent>
              {allJobs.map((j) => (
                <SelectItem key={j.id} value={j.id} className="text-xs">
                  {j.title} ({j.department || 'Geral'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Carregando quadro do pipeline..." className="py-20" />
      ) : !job ? (
        <EmptyState
          icon={Users}
          title="Nenhum pipeline para exibir ainda"
          description="Cadastre e publique uma vaga para acompanhar os candidatos em um quadro por etapas."
          actions={[{ label: 'Cadastrar Vaga', to: '/vagas/nova', icon: Plus }]}
        />
      ) : (
        <div className="space-y-4">
          {/* Informações da vaga ativa */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{job.title}</h2>
                <Badge variant="outline" className="text-xs">
                  {job.location}
                </Badge>
                <Badge className="text-xs bg-sky-600">
                  Total: {applications.length} candidatos
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {job.department} • Contrato: {job.employment_type.toUpperCase()} • Gestor:{' '}
                {job.expand?.manager_id?.name || 'Não atribuído'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() =>
                  copyLink(
                    `${window.location.origin}/carreiras/vaga/${job.slug}?origem=direct_link`,
                    'Link público da vaga',
                  )
                }
              >
                <Link2 className="w-3.5 h-3.5 mr-1" />
                Copiar link
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setOwnersModalOpen(true)}
              >
                <BellRing className="w-3.5 h-3.5 mr-1" />
                Responsáveis e notificações
              </Button>
              <Link to={`/carreiras/vaga/${job.slug}`} target="_blank">
                <Button variant="outline" size="sm" className="text-xs">
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  Ver Página Pública
                </Button>
              </Link>
            </div>
          </div>

          {/* Quadro Kanban de Etapas */}
          <div className="flex gap-4 overflow-x-auto pb-6 pt-2 items-start min-h-[500px]">
            {stages.map((stage, stageIndex) => {
              const stageApps = applications.filter((a) => a.stage_id === stage.id)
              const isRejectStage = stage.id === 'rejected'
              const isHiredStage = stage.id === 'hired'

              return (
                <div
                  key={stage.id}
                  className={`shrink-0 w-72 rounded-xl border flex flex-col max-h-[750px] ${
                    isRejectStage
                      ? 'bg-rose-50/40 border-rose-200'
                      : isHiredStage
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-slate-100/70 border-slate-200'
                  }`}
                >
                  {/* Cabeçalho da coluna */}
                  <div className="p-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: stage.color || '#64748b' }}
                      />
                      <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                        {stage.label}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                      {stageApps.length}
                    </Badge>
                  </div>

                  {/* Lista de cards da coluna */}
                  <div className="p-2 space-y-2 overflow-y-auto flex-1">
                    {stageApps.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        Nenhum candidato nesta fase
                      </div>
                    ) : (
                      stageApps.map((app) => {
                        const candidate = app.expand?.candidate_id
                        if (!candidate) return null

                        return (
                          <Card
                            key={app.id}
                            className="bg-white shadow-2xs hover:shadow-sm border transition"
                          >
                            <CardHeader className="p-3 pb-2">
                              <div className="flex items-start justify-between gap-1">
                                <Link
                                  to={`/candidato/${candidate.id}?appId=${app.id}`}
                                  className="font-semibold text-xs text-slate-900 hover:text-sky-600 line-clamp-1"
                                >
                                  {candidate.name}
                                </Link>
                                {getSourceBadge(app.source)}
                              </div>
                              <CardDescription className="text-[11px] text-slate-500 truncate">
                                {candidate.email}
                              </CardDescription>
                            </CardHeader>

                            <CardContent className="p-3 pt-0 text-[11px] space-y-2">
                              <AiScoreBadge applicationId={app.id} className="mb-1" />

                              {(stage.id === 'disc' || app.disc_status) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedApp(app)
                                    setDiscModalOpen(true)
                                  }}
                                  className="w-full bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded p-1.5 text-purple-700 font-medium transition"
                                >
                                  {app.disc_status === 'completed'
                                    ? `DISC: perfil ${app.disc_profile || '—'}`
                                    : 'Convite DISC pendente — ver resultado'}
                                </button>
                              )}
                              {candidate.location && (
                                <div className="text-slate-600 truncate">
                                  📍 {candidate.location}
                                </div>
                              )}

                              {candidate.skills && (
                                <div className="flex flex-wrap gap-1">
                                  {candidate.skills
                                    .split(',')
                                    .slice(0, 2)
                                    .map((sk, idx) => (
                                      <span
                                        key={idx}
                                        className="bg-slate-100 text-slate-600 text-[9px] px-1 py-0.5 rounded"
                                      >
                                        {sk.trim()}
                                      </span>
                                    ))}
                                </div>
                              )}

                              {app.rejection_reason && (
                                <div className="bg-rose-50 text-rose-700 p-1.5 rounded text-[10px] border border-rose-100">
                                  <strong>Motivo:</strong> {app.rejection_reason}
                                </div>
                              )}
                            </CardContent>

                            {/* Ações de movimentação */}
                            <div className="p-2 border-t bg-slate-50/50 flex items-center justify-between gap-1">
                              <Link to={`/candidato/${candidate.id}?appId=${app.id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 text-slate-600"
                                >
                                  Perfil
                                </Button>
                              </Link>

                              <div className="flex items-center gap-1">
                                {/* Botão para avançar para a próxima etapa comum */}
                                {stageIndex < stages.length - 1 &&
                                  !isRejectStage &&
                                  !isHiredStage && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[10px] px-2 text-sky-700 hover:bg-sky-50"
                                      onClick={() =>
                                        handleOpenMoveModal(app, stages[stageIndex + 1].id)
                                      }
                                      title={`Mover para ${stages[stageIndex + 1].label}`}
                                    >
                                      Avançar
                                      <MoveRight className="w-3 h-3 ml-1" />
                                    </Button>
                                  )}

                                {/* Opção de Reprovar com justificativa */}
                                {!isRejectStage && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] px-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                    onClick={() => handleOpenMoveModal(app, 'rejected')}
                                    title="Reprovar candidato com justificativa"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </Card>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal de Movimentação com Justificativa para Auditoria */}
      <Dialog open={moveModalOpen} onOpenChange={setMoveModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {targetStageId === 'rejected'
                ? 'Reprovar Candidato'
                : 'Movimentar Candidato no Pipeline'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Toda mudança de etapa é registrada na <strong>trilha de auditoria</strong> com o seu
              usuário ({user?.name || user?.email}), data e justificativa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Candidato</Label>
              <div className="text-sm font-bold text-slate-800 mt-0.5">
                {selectedApp?.expand?.candidate_id?.name} (
                {selectedApp?.expand?.candidate_id?.email})
              </div>
            </div>

            <div>
              <Label htmlFor="target-stage" className="text-xs font-semibold">
                Nova Etapa de Destino
              </Label>
              <Select value={targetStageId} onValueChange={setTargetStageId}>
                <SelectTrigger id="target-stage" className="mt-1 text-xs">
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="move-reason" className="text-xs font-semibold">
                Justificativa / Parecer{' '}
                {targetStageId === 'rejected' && <span className="text-rose-500">*</span>}
              </Label>
              <Textarea
                id="move-reason"
                required={targetStageId === 'rejected'}
                rows={3}
                placeholder={
                  targetStageId === 'rejected'
                    ? 'Ex: Não possui a experiência mínima requerida em bancos de dados...'
                    : 'Ex: Aprovado na entrevista técnica, demonstrando grande domínio prático...'
                }
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
                className="mt-1 text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Essa justificativa fica gravada de forma permanente no histórico do candidato.
              </p>
            </div>

            <div>
              <Label htmlFor="move-comment" className="text-xs font-semibold">
                Comentário da avaliação (opcional)
              </Label>
              <Textarea
                id="move-comment"
                rows={2}
                placeholder="Ex: Comunicação clara, boas respostas técnicas sobre modelagem de dados..."
                value={moveComment}
                onChange={(e) => setMoveComment(e.target.value)}
                className="mt-1 text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Registro opcional da sua avaliação sobre o candidato nesta etapa.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMoveModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={moving}
              onClick={handleConfirmMove}
              className={
                targetStageId === 'rejected'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-sky-600 hover:bg-sky-700 text-white'
              }
            >
              {moving ? 'Gravando...' : 'Confirmar Movimentação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog com resultado DISC + FIT cultural da candidatura selecionada */}
      <Dialog open={discModalOpen} onOpenChange={setDiscModalOpen}>
        <DialogContent className="sm:max-w-md bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">DISC &amp; FIT Cultural</DialogTitle>
            <DialogDescription className="text-xs">
              Perfil comportamental e aderência à visão/missão de{' '}
              {selectedApp?.expand?.candidate_id?.name || 'candidato'}.
            </DialogDescription>
          </DialogHeader>
          {selectedApp && <DiscFitPanel applicationId={selectedApp.id} />}
        </DialogContent>
      </Dialog>

      {/* Dialog de Responsáveis e Notificações por etapa (da vaga aberta) */}
      <Dialog open={ownersModalOpen} onOpenChange={setOwnersModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <BellRing className="w-4 h-4 text-sky-600" />
              Responsáveis e notificações das etapas
            </DialogTitle>
            <DialogDescription className="text-xs">
              Para cada etapa de <strong>{job?.title}</strong>, defina o responsável (usuário da
              equipe e/ou e-mail livre). Esta pessoa recebe um e-mail quando um candidato entra na
              etapa e lembretes periódicos enquanto estiver pendente.
            </DialogDescription>
          </DialogHeader>

          {jobId && (
            <StageOwnerSettings
              jobId={jobId}
              stages={stages}
              teamMembers={users}
              saveSignal={ownersSaveSignal}
              onSaved={() => setOwnersModalOpen(false)}
            />
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOwnersModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!jobId}
              onClick={() => setOwnersSaveSignal((n) => n + 1)}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              Salvar configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
