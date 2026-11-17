import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  BriefcaseBusiness,
  Pencil,
  Trash2,
  BookOpen,
  Wrench,
  HeartHandshake,
  Building2,
  FileDown,
  Send,
  Check,
  X,
  ArrowRightLeft,
  History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { cargosService, type CargoAction } from '@/services/cargos'
import { exportCargoPdf } from '@/lib/chaExport'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { Cargo, CargoApprovalEntry } from '@/types/ats'
import { CARGO_PURPOSES } from '@/types/ats'
import {
  CHA_BLOCK_KEYS,
  CHA_BLOCK_META,
  CHA_LEVEL_LABELS,
  CHA_LEVELS,
  type ChaBlockKey,
  type ChaLevel,
} from '@/lib/cha'
import { CargoFormDialog } from '@/components/cargos/CargoFormDialog'
import { OpenJobButton } from '@/components/cargos/OpenJobButton'
import { OpenJobDialog } from '@/components/cargos/OpenJobDialog'
import {
  cargoNodeId,
  checkOpeningPreconditions,
  listOrgNodes,
  loadCargoInheritance,
  type CargoInheritance,
  type InheritanceNode,
} from '@/services/jobOpening'

const BLOCK_ICONS: Record<ChaBlockKey, React.ElementType> = {
  conhecimentos: BookOpen,
  habilidades: Wrench,
  atitudes: HeartHandshake,
}

const CARGO_STATUS_META: Record<string, { label: string; badge: string }> = {
  RASCUNHO: { label: 'Rascunho', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  EM_APROVACAO: { label: 'Em aprovação', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  APROVADO: { label: 'Aprovado', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REPROVADO: { label: 'Reprovado', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
}

const TRAIL_STEP_LABEL: Record<string, string> = {
  CRIACAO: 'Criação',
  ENVIO: 'Enviado para aprovação',
  APROVACAO: 'Aprovação',
  REJEICAO: 'Reprovação',
  CONVERSAO: 'Conversão de finalidade',
}

const purposeLabel = (v?: string | null) =>
  CARGO_PURPOSES.find((p) => p.value === v)?.label || v || '—'

const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

/** Modal de comentário único para aprovar/rejeitar/converter (comment = foco). */
const CommentActionDialog: React.FC<{
  open: boolean
  mode: CargoAction
  cargo: Cargo | null
  busy: boolean
  onClose: () => void
  onConfirm: (comment: string) => void
}> = ({ open, mode, cargo, busy, onClose, onConfirm }) => {
  const [comment, setComment] = useState('')
  useEffect(() => {
    if (open) setComment('')
  }, [open, mode, cargo?.id])

  const title =
    mode === 'approve'
      ? 'Aprovar cargo'
      : mode === 'reject'
        ? 'Reprovar cargo'
        : 'Converter finalidade para “Preenchimento imediato”'
  const desc =
    mode === 'approve'
      ? 'Cargo aprovado pode gerar vaga. Registre o comentário de aprovação.'
      : mode === 'reject'
        ? 'Cargo volta a ficar disponível para ajustes. A justificativa fica registrada na trilha.'
        : 'A conversão fica registrada como evento auditável (autor, data, finalidade anterior e nova) — não é edição silenciosa.'
  const cta = mode === 'approve' ? 'Aprovar' : mode === 'reject' ? 'Reprovar' : 'Converter'
  const destructive = mode === 'reject'
  const needsReason = mode === 'reject'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cargo-action-comment">
            {needsReason ? 'Justificativa *' : 'Comentário *'}
          </Label>
          <Textarea
            id="cargo-action-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={
              needsReason
                ? 'Por que o cargo está sendo reprovado?'
                : mode === 'approve'
                  ? 'Ex.: faixa salarial conferida com o orçamento do ano.'
                  : 'Ex.: vaga aberta para este cargo, recrutamento começa em seguida.'
            }
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            className={destructive ? '' : 'bg-sky-600 hover:bg-sky-700 text-white'}
            disabled={busy || !comment.trim()}
            onClick={() => onConfirm(comment.trim())}
          >
            {busy ? 'Processando…' : cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const CargosPage: React.FC = () => {
  const { toast } = useToast()
  const { user, isAdmin, isRecruiter, isSuperadmin } = useAuth()
  // Regra FASE 2: admin/RH cria e edita cargo; recrutador puro só visualiza.
  const canEdit = isAdmin || isSuperadmin
  const canApprove = isAdmin || isSuperadmin

  const [cargos, setCargos] = useState<Cargo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Cargo | null>(null)
  const [deleting, setDeleting] = useState<Cargo | null>(null)
  // FASE 2 — ciclo de aprovação
  const [action, setAction] = useState<CargoAction | null>(null)
  const [actionCargo, setActionCargo] = useState<Cargo | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [trailCargo, setTrailCargo] = useState<Cargo | null>(null)
  const [trail, setTrail] = useState<CargoApprovalEntry[]>([])
  const [trailLoading, setTrailLoading] = useState(false)
  // FASE 3 — abertura de vaga a partir do cargo
  const [orgNodes, setOrgNodes] = useState<InheritanceNode[]>([])
  const [openJobCargo, setOpenJobCargo] = useState<Cargo | null>(null)
  const [openJobInheritance, setOpenJobInheritance] = useState<CargoInheritance | null>(null)
  const [openJobLoading, setOpenJobLoading] = useState(false)

  useEffect(() => {
    listOrgNodes().then(setOrgNodes)
  }, [])

  // Pré-condições de abertura por cargo (posição do organograma pelo vínculo do cargo)
  const openingPreconditions = useMemo(() => {
    const map: Record<
      string,
      {
        preconditions: ReturnType<typeof checkOpeningPreconditions>
        canOpen: boolean
      }
    > = {}
    for (const cargo of cargos) {
      const nodeId = cargoNodeId(cargo)
      const node = orgNodes.find((n) => n.id === nodeId) || null
      const preconditions = checkOpeningPreconditions(cargo, node)
      map[cargo.id] = { preconditions, canOpen: preconditions.every((p) => p.ok) }
    }
    return map
  }, [cargos, orgNodes])

  // Pré-condição de finalidade (resolveTo vazio) resolve aqui mesmo: converte finalidade
  const handleOpenJob = async (cargo: Cargo) => {
    setOpenJobLoading(true)
    try {
      const inheritance = await loadCargoInheritance(cargo.id)
      setOpenJobInheritance(inheritance)
      setOpenJobCargo(cargo)
    } finally {
      setOpenJobLoading(false)
    }
  }

  const load = React.useCallback(async () => {
    try {
      setLoading(true)
      setCargos(await cargosService.listCargos())
    } catch (err) {
      console.error('Erro ao carregar cargos:', err)
      toast({ title: 'Erro ao carregar cargos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  // Trilha de auditoria do cargo em exibição
  useEffect(() => {
    if (!trailCargo) {
      setTrail([])
      return
    }
    let alive = true
    setTrailLoading(true)
    cargosService
      .listApprovals(trailCargo.id)
      .then((entries) => {
        if (alive) setTrail(entries)
      })
      .finally(() => {
        if (alive) setTrailLoading(false)
      })
    return () => {
      alive = false
    }
  }, [trailCargo])

  const areas = useMemo(
    () => Array.from(new Set(cargos.map((c) => (c.area || '').trim()).filter(Boolean))).sort(),
    [cargos],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cargos.filter((c) => {
      if (areaFilter !== 'all' && (c.area || '') !== areaFilter) return false
      if (levelFilter !== 'all' && (c.level || '') !== levelFilter) return false
      if (!q) return true
      return (
        c.title.toLowerCase().includes(q) ||
        (c.area || '').toLowerCase().includes(q) ||
        (c.mission || '').toLowerCase().includes(q)
      )
    })
  }, [cargos, search, areaFilter, levelFilter])

  const countRequired = (cargo: Cargo, key: ChaBlockKey) => (cargo.cha?.[key]?.items || []).length

  const openAction = (cargo: Cargo, act: CargoAction) => {
    setActionCargo(cargo)
    setAction(act)
  }

  const closeAction = () => {
    setAction(null)
    setActionCargo(null)
  }

  const handleAction = async (comment: string) => {
    if (!actionCargo || !action) return
    try {
      setActionBusy(true)
      // Payload por ação — o hook cargo_server.js valida campos diferentes:
      // reject exige reason; convert exige purpose='PREENCHIMENTO'.
      const payload =
        action === 'reject'
          ? { cargo_id: actionCargo.id, action, reason: comment }
          : action === 'convert'
            ? { cargo_id: actionCargo.id, action, comment, purpose: 'PREENCHIMENTO' }
            : { cargo_id: actionCargo.id, action, comment }
      await cargosService.runAction(payload)
      toast({
        title:
          action === 'submit'
            ? 'Cargo enviado para aprovação'
            : action === 'approve'
              ? 'Cargo aprovado'
              : action === 'reject'
                ? 'Cargo reprovado'
                : 'Finalidade convertida',
        description: actionCargo.title,
      })
      closeAction()
      load()
    } catch (err) {
      console.error('Erro na ação do cargo:', err)
      toast({ title: 'Erro na ação', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setActionBusy(false)
    }
  }

  // FASE 3 — PDF da descrição do cargo direto da lista.
  const handleExportPdf = (cargo: Cargo) => {
    exportCargoPdf(
      {
        title: cargo.title,
        area: cargo.area,
        level: cargo.level,
        levelLabel: cargo.level ? CHA_LEVEL_LABELS[cargo.level as ChaLevel] || cargo.level : '',
        mission: cargo.mission,
        salaryMin: cargo.salary_min ?? null,
        salaryMed: cargo.salary_med ?? null,
        salaryMax: cargo.salary_max ?? null,
        cha: (cargo.cha || {}) as Record<
          string,
          { items?: { description: string; required: boolean; weight: number }[] }
        >,
      },
      '',
    )
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await cargosService.delete(deleting.id)
      toast({ title: 'Cargo excluído', description: deleting.title })
      setDeleting(null)
      load()
    } catch (err) {
      console.error('Erro ao excluir cargo:', err)
      toast({
        title: 'Erro ao excluir',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const openTrail = (cargo: Cargo) => {
    setTrailCargo(cargo)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-3">
          <BriefcaseBusiness className="w-6 h-6 text-sky-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cargos</h1>
            <p className="text-xs text-slate-500">
              Catálogo da organização com os requisitos CHA de cada função — criados a partir de
              posições APROVADAS no organograma vigente.
            </p>
          </div>
        </div>
        {canEdit && (
          <Button
            className="bg-sky-600 hover:bg-sky-700 text-white"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Cargo
          </Button>
        )}
      </div>

      {/* Busca + filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, área ou missão…"
            className="pl-9"
          />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            {CHA_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {CHA_LEVEL_LABELS[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingState message="Carregando cargos…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title={cargos.length === 0 ? 'Nenhum cargo cadastrado' : 'Nenhum cargo encontrado'}
          description={
            cargos.length === 0
              ? 'Cadastre o primeiro cargo a partir de uma posição aprovada do organograma.'
              : 'Ajuste a busca ou os filtros para encontrar o cargo.'
          }
          actions={
            canEdit && cargos.length === 0
              ? [
                  {
                    label: 'Cadastrar cargo',
                    onClick: () => {
                      setEditing(null)
                      setFormOpen(true)
                    },
                  },
                ]
              : []
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((cargo) => {
            const status = cargo.status || 'RASCUNHO'
            const statusMeta = CARGO_STATUS_META[status] || CARGO_STATUS_META.RASCUNHO
            const isAuthor = cargo.created_by_id === user?.id
            const canAct = canApprove && !isAuthor
            return (
              <Card key={cargo.id} className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900">{cargo.title}</h3>
                        <Badge className={`text-[10px] border ${statusMeta.badge}`}>
                          {statusMeta.label}
                        </Badge>
                        {cargo.level && (
                          <Badge variant="outline" className="text-[10px]">
                            {CHA_LEVEL_LABELS[cargo.level as ChaLevel] || cargo.level}
                          </Badge>
                        )}
                        {cargo.area && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Building2 className="w-3 h-3" />
                            {cargo.area}
                          </Badge>
                        )}
                        {cargo.purpose && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-sky-700 border-sky-200"
                          >
                            {purposeLabel(cargo.purpose)}
                          </Badge>
                        )}
                      </div>
                      {cargo.mission && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{cargo.mission}</p>
                      )}
                      {status === 'REPROVADO' && cargo.rejection_reason && (
                        <p className="text-xs text-rose-600 mt-1">
                          Reprovado: {cargo.rejection_reason}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {CHA_BLOCK_KEYS.map((key) => {
                          const Icon = BLOCK_ICONS[key]
                          const n = countRequired(cargo, key)
                          return (
                            <Badge
                              key={key}
                              variant="outline"
                              className={`text-[10px] gap-1 ${n === 0 ? 'text-rose-600 border-rose-300' : 'text-slate-600'}`}
                            >
                              <Icon className="w-3 h-3" />
                              {CHA_BLOCK_META[key].label}: {n}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canEdit && (
                        <OpenJobButton
                          cargo={cargo}
                          preconditions={openingPreconditions[cargo.id]?.preconditions || []}
                          canOpen={openingPreconditions[cargo.id]?.canOpen || false}
                          onOpen={() => {
                            const failedFinalidade = (
                              openingPreconditions[cargo.id]?.preconditions || []
                            ).find((p) => !p.ok && !p.resolveTo)
                            if (failedFinalidade) {
                              openAction(cargo, 'convert')
                              return
                            }
                            handleOpenJob(cargo)
                          }}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Exportar descrição do cargo em PDF"
                        onClick={() => handleExportPdf(cargo)}
                      >
                        <FileDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Histórico de aprovação e auditoria"
                        onClick={() => openTrail(cargo)}
                      >
                        <History className="w-4 h-4" />
                      </Button>
                      {canEdit && (
                        <>
                          {status === 'RASCUNHO' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600"
                              title="Enviar para aprovação"
                              onClick={() => openAction(cargo, 'submit')}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                          {status === 'EM_APROVACAO' && canAct && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600"
                                title="Aprovar"
                                onClick={() => openAction(cargo, 'approve')}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-rose-600"
                                title="Reprovar"
                                onClick={() => openAction(cargo, 'reject')}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {status === 'APROVADO' &&
                            cargo.purpose !== 'PREENCHIMENTO' &&
                            !isAuthor && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-sky-600"
                                title="Converter finalidade para Preenchimento imediato"
                                onClick={() => openAction(cargo, 'convert')}
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </Button>
                            )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditing(cargo)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-600 hover:text-rose-700"
                            onClick={() => setDeleting(cargo)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {!canEdit && cargos.length > 0 && (
        <p className="text-xs text-slate-500 text-center">
          Você tem acesso de leitura aos cargos da organização — apenas administradores podem
          criá-los e editá-los.
        </p>
      )}

      <CargoFormDialog
        open={formOpen}
        cargo={editing}
        allCargos={cargos}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          load()
        }}
      />

      <CommentActionDialog
        open={action !== null}
        mode={action || 'approve'}
        cargo={actionCargo}
        busy={actionBusy}
        onClose={closeAction}
        onConfirm={handleAction}
      />

      <OpenJobDialog
        open={Boolean(openJobCargo)}
        onOpenChange={(o) => {
          if (!o) {
            setOpenJobCargo(null)
            setOpenJobInheritance(null)
          }
        }}
        cargo={openJobCargo}
        inheritance={openJobInheritance}
      />

      {/* Trilha de auditoria do cargo */}
      <Dialog open={Boolean(trailCargo)} onOpenChange={(o) => !o && setTrailCargo(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico do cargo</DialogTitle>
            <DialogDescription>
              Ciclo de aprovação e conversões de finalidade de “{trailCargo?.title}” — quem, quando
              e o que mudou.
            </DialogDescription>
          </DialogHeader>
          {trailLoading ? (
            <LoadingState message="Carregando histórico…" />
          ) : trail.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum evento registrado ainda.</p>
          ) : (
            <ol className="space-y-2">
              {trail.map((ev) => (
                <li key={ev.id} className="border rounded-md px-3 py-2 text-xs space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">
                      {TRAIL_STEP_LABEL[ev.step] || ev.step}
                    </span>
                    <span className="text-slate-400">{fmtDate(ev.created)}</span>
                  </div>
                  <p className="text-slate-600">
                    {ev.user_name || '—'}
                    {ev.user_role ? ` (${ev.user_role})` : ''}
                    {ev.from_value
                      ? ` · ${purposeLabel(ev.from_value)} → ${purposeLabel(ev.to_value)}`
                      : ''}
                    {ev.from_status ? ` · ${ev.from_status} → ${ev.to_status || ev.decision}` : ''}
                  </p>
                  {ev.comment && <p className="text-slate-500 italic">“{ev.comment}”</p>}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cargo</DialogTitle>
            <DialogDescription>
              Excluir “{deleting?.title}”? Vagas vinculadas continuam com os requisitos já herdados,
              mas novas vagas não poderão mais selecionar este cargo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CargosPage
