import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useActiveCompany } from '@/hooks/use-active-company'
import { useToast } from '@/hooks/use-toast'
import { requisitionsService, type NewRequisitionInput } from '@/services/requisitions'
import { auditService } from '@/services/candidates'
import { jobsService } from '@/services/jobs'
import type { JobRequisition, Job } from '@/types/ats'
import {
  REQUISITION_STATUS_META,
  REQUISITION_URGENCY_META,
  type RequisitionUrgency,
} from '@/types/ats'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import {
  FileText,
  Plus,
  ThumbsUp,
  ThumbsDown,
  ClipboardList,
  Briefcase,
  RefreshCw,
} from 'lucide-react'

const isApprover = (role?: string) => role === 'admin' || role === 'recruiter'

const brl = (v?: number | null) =>
  v == null || v === (undefined as unknown as number)
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

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

/** Notificação in-app da decisão: registro de auditoria (padrão já existente). */
async function notifyDecision(req: JobRequisition, approved: boolean): Promise<void> {
  try {
    await auditService.createLog({
      user_id: req.requested_by,
      action: approved ? 'requisition_approved' : 'requisition_rejected',
      details: `Requisição "${req.title}" ${approved ? 'APROVADA' : 'REPROVADA'}${
        req.decision_note ? ` — justificativa: ${req.decision_note}` : ''
      }`,
    })
  } catch (err) {
    console.warn('[requisicoes] falha ao registrar notificação de decisão:', err)
  }
}

export const RequisitionsPage: React.FC = () => {
  const { user, isAdmin, isRecruiter, isManager } = useAuth()
  const { activeCompanyId } = useActiveCompany()
  const { toast } = useToast()
  const navigate = useNavigate()

  const approver = isApprover(user?.role)
  // Superadmin não pertence a uma org: vê tudo, mas não cria requisições.
  const isSuperadmin = user?.role === 'superadmin'
  const canRequest = !isSuperadmin

  const [requisitions, setRequisitions] = useState<JobRequisition[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deciding, setDeciding] = useState<string | null>(null)
  const [creatingJob, setCreatingJob] = useState<string | null>(null)

  // Formulário de nova requisição
  const [form, setForm] = useState<{
    title: string
    justification: string
    budget: string
    salaryMin: string
    salaryMax: string
    urgency: RequisitionUrgency
  }>({
    title: '',
    justification: '',
    budget: '',
    salaryMin: '',
    salaryMax: '',
    urgency: 'media',
  })
  const [formError, setFormError] = useState('')

  // Diálogo de decisão (aprovar/reprovar)
  const [decision, setDecision] = useState<{
    req: JobRequisition
    type: 'approve' | 'reject'
    note: string
  } | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const list = await requisitionsService.list()
      // Gestor vê somente as requisições que ele mesmo solicitou.
      const mine = !approver && user?.id ? list.filter((r) => r.requested_by === user.id) : list
      setRequisitions(mine)
    } catch (err) {
      console.error('Erro ao carregar requisições:', err)
      toast({
        title: 'Erro ao carregar requisições',
        description: requisitionsService.requisitionErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [approver, user?.id, toast])

  useEffect(() => {
    load()
  }, [load])

  const pendingCount = useMemo(
    () => requisitions.filter((r) => r.status === 'pendente').length,
    [requisitions],
  )

  const handleOpenDialog = () => {
    setForm({
      title: '',
      justification: '',
      budget: '',
      salaryMin: '',
      salaryMax: '',
      urgency: 'media',
    })
    setFormError('')
    setDialogOpen(true)
  }

  const toNum = (v: string): number | null => {
    const n = Number(v)
    return v.trim() !== '' && Number.isFinite(n) ? n : null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || form.title.trim().length < 3) {
      setFormError('Informe o cargo/título pretendido (mín. 3 caracteres).')
      return
    }
    if (!form.justification.trim()) {
      setFormError('Descreva a justificativa da contratação.')
      return
    }
    const sMin = toNum(form.salaryMin)
    const sMax = toNum(form.salaryMax)
    if (sMin != null && sMax != null && sMin > sMax) {
      setFormError('A faixa salarial máxima deve ser maior ou igual à mínima.')
      return
    }
    try {
      setSaving(true)
      const orgId =
        (pb.authStore.record as { org_id?: string } | null)?.org_id ||
        (user as { org_id?: string } | null)?.org_id ||
        ''
      if (!orgId) {
        toast({
          title: 'Organização não identificada',
          description: 'Sessão sem organização associada — faça login novamente.',
          variant: 'destructive',
        })
        return
      }
      const input: NewRequisitionInput = {
        title: form.title,
        justification: form.justification,
        budget_estimate: toNum(form.budget),
        salary_min: sMin,
        salary_max: sMax,
        urgency: form.urgency,
        company_id: activeCompanyId || null,
      }
      const created = await requisitionsService.create(input, orgId)
      try {
        await auditService.createLog({
          user_id: user?.id,
          action: 'requisition_created',
          details: `Requisição "${created.title}" criada (urgência: ${REQUISITION_URGENCY_META[created.urgency || 'media'].label})`,
        })
      } catch (_) {
        /* auditoria é best-effort */
      }
      toast({
        title: 'Requisição enviada!',
        description: 'Aguardando aprovação de orçamento pelo RH/Admin.',
      })
      setDialogOpen(false)
      await load()
    } catch (err) {
      console.error('Erro ao criar requisição:', err)
      toast({
        title: 'Erro ao enviar requisição',
        description: requisitionsService.requisitionErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDecision = async () => {
    if (!decision) return
    const { req, type, note } = decision
    if (type === 'reject' && !note.trim()) {
      toast({
        title: 'Justificativa obrigatória',
        description: 'Ao reprovar, informe ao solicitante o motivo do cancelamento.',
        variant: 'destructive',
      })
      return
    }
    try {
      setDeciding(req.id)
      if (type === 'approve') {
        await requisitionsService.approve(req.id, note)
      } else {
        await requisitionsService.reject(req.id, note)
      }
      // Notificação in-app da decisão ao solicitante (registro de auditoria).
      await notifyDecision({ ...req, decision_note: note }, type === 'approve')
      toast({
        title: type === 'approve' ? 'Requisição aprovada' : 'Requisição reprovada',
        description:
          type === 'approve'
            ? 'Crie a vaga a partir dela para o RH editar e publicar.'
            : 'O solicitante verá a justificativa na lista de requisições.',
      })
      setDecision(null)
      await load()
    } catch (err) {
      console.error('Erro ao registrar decisão:', err)
      toast({
        title: 'Erro ao registrar decisão',
        description: requisitionsService.requisitionErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setDeciding(null)
    }
  }

  /** Aprovar → cria a VAGA em rascunho pré-preenchida com os dados da requisição. */
  const handleCreateJob = async (req: JobRequisition) => {
    try {
      setCreatingJob(req.id)
      const slug =
        req.title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60) || `vaga-${Date.now()}`
      const payload: Partial<Job> = {
        title: req.title,
        slug: `${slug}-${req.id.slice(0, 6)}`,
        status: 'draft',
        description: req.justification || '',
        requirements: req.justification || '',
        salary_min: req.salary_min ?? undefined,
        salary_max: req.salary_max ?? undefined,
        company_id: req.company_id || activeCompanyId || undefined,
        manager_id: req.requested_by || undefined,
      }
      const job = await jobsService.createJob(payload)
      await requisitionsService.linkJob(req.id, job.id)
      try {
        await auditService.createLog({
          user_id: req.requested_by,
          action: 'requisition_approved',
          details: `Vaga criada a partir da requisição "${req.title}" — aguardando edição e publicação pelo RH.`,
        })
      } catch (_) {
        /* best-effort */
      }
      toast({
        title: 'Vaga criada a partir da requisição!',
        description: 'Ela está em rascunho na lista de Vagas, pronta para editar e publicar.',
      })
      navigate(`/vagas/${job.id}/editar`)
    } catch (err) {
      console.error('Erro ao criar vaga da requisição:', err)
      toast({
        title: 'Erro ao criar vaga',
        description: requisitionsService.requisitionErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setCreatingJob(null)
    }
  }

  const pendingList = requisitions.filter((r) => r.status === 'pendente')
  const decidedList = requisitions.filter((r) => r.status !== 'pendente')

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Requisições de Vaga
            </h1>
            <p className="text-xs text-slate-500">
              {approver
                ? 'Avalie as solicitações dos gestores — aprovadas viram vagas em rascunho.'
                : 'Solicite uma vaga e acompanhe a aprovação do orçamento pelo RH.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={load} title="Atualizar">
            <RefreshCw className="w-4 h-4" />
          </Button>
          {canRequest && (
            <Button onClick={handleOpenDialog} className="bg-sky-600 hover:bg-sky-700 text-white">
              <Plus className="w-4 h-4 mr-1.5" />
              Nova Requisição
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Carregando requisições..." />
      ) : requisitions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma requisição por aqui"
          description={
            approver
              ? 'Quando um gestor solicitar uma vaga, ela aparece aqui para aprovação.'
              : 'Solicite uma nova vaga preenchendo cargo pretendido, justificativa e orçamento estimado.'
          }
          actions={
            canRequest
              ? [{ onClick: handleOpenDialog, icon: Plus, label: 'Nova Requisição' }]
              : undefined
          }
        />
      ) : (
        <>
          {/* Pendentes (fila do aprovador / acompanhamento do gestor) */}
          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Aguardando aprovação {pendingCount > 0 && `(${pendingCount})`}
                </CardTitle>
                <CardDescription className="text-xs">
                  {approver
                    ? 'Gateway "Orçamento Aprovado?" — aprove ou reproque com justificativa.'
                    : 'Suas solicitações que ainda aguardam o RH.'}
                </CardDescription>
              </div>
              <FileText className="w-5 h-5 text-slate-400" />
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingList.length === 0 && (
                <p className="text-sm text-slate-500 py-2">Nada pendente neste momento.</p>
              )}
              {pendingList.map((req) => (
                <RequisitionRow
                  key={req.id}
                  req={req}
                  approver={approver}
                  deciding={deciding === req.id}
                  creatingJob={creatingJob === req.id}
                  onDecide={(type) => setDecision({ req, type, note: '' })}
                  onCreateJob={() => handleCreateJob(req)}
                  onOpenJob={(jobId) => navigate(`/vagas/${jobId}/editar`)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Decididas */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Histórico de decisões</CardTitle>
              <CardDescription className="text-xs">
                Aprovadas (com vaga criada ou a criar) e reprovadas com a justificativa registrada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {decidedList.length === 0 && (
                <p className="text-sm text-slate-500 py-2">Nenhuma decisão registrada ainda.</p>
              )}
              {decidedList.map((req) => (
                <RequisitionRow
                  key={req.id}
                  req={req}
                  approver={approver}
                  onOpenJob={(jobId) => navigate(`/vagas/${jobId}/editar`)}
                />
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* Diálogo: nova requisição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Requisição de Vaga</DialogTitle>
            <DialogDescription>
              A solicitação vai ao RH/Admin para o gateway "Orçamento Aprovado?".
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="req-title">Cargo / título pretendido *</Label>
              <Input
                id="req-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: Analista de Vendas Pleno"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-just">Justificativa da contratação *</Label>
              <Textarea
                id="req-just"
                value={form.justification}
                onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
                placeholder="Por que esta contratação? (aumento de demanda, reposição, novo projeto...)"
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="req-budget">Orçamento estimado (R$)</Label>
                <Input
                  id="req-budget"
                  type="number"
                  min="0"
                  value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                  placeholder="Ex.: 50000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Urgência</Label>
                <Select
                  value={form.urgency}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, urgency: v as RequisitionUrgency }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="req-smin">Faixa salarial mín. (R$)</Label>
                <Input
                  id="req-smin"
                  type="number"
                  min="0"
                  value={form.salaryMin}
                  onChange={(e) => setForm((f) => ({ ...f, salaryMin: e.target.value }))}
                  placeholder="Ex.: 3000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="req-smax">Faixa salarial máx. (R$)</Label>
                <Input
                  id="req-smax"
                  type="number"
                  min="0"
                  value={form.salaryMax}
                  onChange={(e) => setForm((f) => ({ ...f, salaryMax: e.target.value }))}
                  placeholder="Ex.: 4500"
                />
              </div>
            </div>
            {formError && <p className="text-xs text-rose-600">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                {saving ? 'Enviando...' : 'Enviar requisição'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo: decisão do aprovador */}
      <Dialog open={!!decision} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent className="max-w-md">
          {decision && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {decision.type === 'approve' ? 'Aprovar requisição' : 'Reprovar requisição'}
                </DialogTitle>
                <DialogDescription>
                  {decision.type === 'approve'
                    ? `"${decision.req.title}" — ao aprovar, você poderá criar a vaga em rascunho pré-preenchida.`
                    : `"${decision.req.title}" — o processo será cancelado e o solicitante verá o motivo.`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="decision-note">
                  {decision.type === 'approve' ? 'Observação (opcional)' : 'Justificativa *'}
                </Label>
                <Textarea
                  id="decision-note"
                  value={decision.note}
                  onChange={(e) => setDecision((d) => (d ? { ...d, note: e.target.value } : d))}
                  rows={3}
                  maxLength={2000}
                  placeholder={
                    decision.type === 'approve'
                      ? 'Ex.: orçamento aprovado pela diretoria, contratar até março.'
                      : 'Ex.: verba do trimestre comprometida — reavaliar no próximo ciclo.'
                  }
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDecision(null)}>
                  Voltar
                </Button>
                <Button
                  onClick={handleDecision}
                  disabled={deciding === decision.req.id}
                  className={
                    decision.type === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }
                >
                  {deciding === decision.req.id
                    ? 'Registrando...'
                    : decision.type === 'approve'
                      ? 'Aprovar'
                      : 'Reprovar'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Linha de requisição (usada na fila e no histórico). */
const RequisitionRow: React.FC<{
  req: JobRequisition
  approver: boolean
  deciding?: boolean
  creatingJob?: boolean
  onDecide?: (type: 'approve' | 'reject') => void
  onCreateJob?: () => void
  onOpenJob?: (jobId: string) => void
}> = ({ req, approver, deciding, creatingJob, onDecide, onCreateJob, onOpenJob }) => {
  const meta = REQUISITION_STATUS_META[req.status]
  const requesterName = req.expand?.requested_by?.name || req.expand?.requested_by?.email || '—'
  return (
    <div className="rounded-lg border p-3 space-y-2 bg-slate-50/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm text-slate-900 truncate">{req.title}</p>
            <Badge variant="outline" className={`text-[10px] ${meta.className}`}>
              {meta.label}
            </Badge>
            {req.urgency && req.urgency !== 'baixa' && (
              <Badge variant="outline" className="text-[10px]">
                Urgência {REQUISITION_URGENCY_META[req.urgency].label}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Solicitante: {requesterName} · {fmtDate(req.created)}
          </p>
        </div>
        <div className="text-right text-xs text-slate-600 space-y-0.5 shrink-0">
          <p>
            <Briefcase className="w-3 h-3 inline mr-1 -mt-0.5" />
            Orçamento: {brl(req.budget_estimate)}
          </p>
          <p>
            Faixa: {brl(req.salary_min)} – {brl(req.salary_max)}
          </p>
        </div>
      </div>
      {req.justification && (
        <p className="text-xs text-slate-600 line-clamp-2">
          <span className="font-medium">Justificativa:</span> {req.justification}
        </p>
      )}
      {req.status !== 'pendente' && req.decision_note && (
        <p
          className={`text-xs rounded-md px-2 py-1.5 ${
            req.status === 'reprovada'
              ? 'bg-rose-50 text-rose-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          <span className="font-medium">
            Decisão{req.decided_by ? ` (${req.decided_by})` : ''}:
          </span>{' '}
          {req.decision_note}
          {req.decided_at ? ` · ${fmtDate(req.decided_at)}` : ''}
        </p>
      )}
      {approver && req.status === 'pendente' && onDecide && (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={deciding}
            onClick={() => onDecide('reject')}
            className="text-rose-600 border-rose-300 hover:bg-rose-50"
          >
            <ThumbsDown className="w-3.5 h-3.5 mr-1" />
            Reprovar
          </Button>
          <Button
            size="sm"
            disabled={deciding}
            onClick={() => onDecide('approve')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <ThumbsUp className="w-3.5 h-3.5 mr-1" />
            Aprovar
          </Button>
        </div>
      )}
      {approver && req.status === 'aprovada' && !req.job_id && onCreateJob && (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            disabled={creatingJob}
            onClick={onCreateJob}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            <Briefcase className="w-3.5 h-3.5 mr-1" />
            {creatingJob ? 'Criando vaga...' : 'Criar vaga a partir da requisição'}
          </Button>
        </div>
      )}
      {req.job_id && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenJob && onOpenJob(req.job_id as string)}
            className="text-sky-700"
          >
            <Briefcase className="w-3.5 h-3.5 mr-1" />
            Ver vaga vinculada
          </Button>
        </div>
      )}
    </div>
  )
}
