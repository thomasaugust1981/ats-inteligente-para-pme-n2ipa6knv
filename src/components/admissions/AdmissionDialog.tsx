import React, { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import {
  admissionsService,
  derivedStatus,
  ADMISSION_STATUS_LABELS,
  type Admission,
  type AdmissionChecklistItem,
  type AdmissionStatus,
} from '@/services/admissions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/LoadingState'
import { useCopyLink } from '@/hooks/use-copy-link'
import { ClipboardList, Plus, Trash2, CheckCircle2 } from 'lucide-react'

interface AdmissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Processo admissional carregado (ou null para buscar pela candidatura). */
  admission: Admission | null
  /** Quando informado, busca/cria o processo pela candidatura ao abrir. */
  applicationId?: string
  onSaved?: () => void
}

const STATUS_BADGE_CLASS: Record<AdmissionStatus, string> = {
  pendente: 'bg-slate-100 text-slate-700 border-slate-200',
  em_andamento: 'bg-amber-50 text-amber-800 border-amber-200',
  concluido: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

/**
 * Dialog do processo admissional de uma candidatura contratada: checklist
 * padrão editável (concluir, adicionar, remover extras), observações e
 * "Pacote de admissão" copiável (entregável do handoff para o Goldway).
 */
export const AdmissionDialog: React.FC<AdmissionDialogProps> = ({
  open,
  onOpenChange,
  admission: admissionProp,
  applicationId,
  onSaved,
}) => {
  const { toast } = useToast()
  const { copyLink } = useCopyLink()

  const [loading, setLoading] = useState(false)
  const [admission, setAdmission] = useState<Admission | null>(admissionProp)
  const [items, setItems] = useState<AdmissionChecklistItem[]>([])
  const [newItemTitle, setNewItemTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Busca (e, se necessário, cria via fallback) o processo ao abrir.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        let current = admissionProp
        if (!current && applicationId) {
          current = await admissionsService.findForApplication(applicationId)
          if (!current) {
            current = await admissionsService.createForApplication(applicationId)
          }
        }
        if (cancelled) return
        if (!current) {
          toast({
            title: 'Processo admissional não encontrado',
            description: 'Esta candidatura ainda não possui processo de admissão.',
            variant: 'destructive',
          })
          onOpenChange(false)
          return
        }
        setAdmission(current)
        setNotes(current.notes || '')
        const its = await admissionsService.listItems(current.id)
        if (!cancelled) setItems(its)
      } catch (err) {
        if (cancelled) return
        const fieldErrors = extractFieldErrors(err)
        toast({
          title: 'Erro ao carregar o processo admissional',
          description: Object.values(fieldErrors)[0] || 'Tente novamente.',
          variant: 'destructive',
        })
        onOpenChange(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, applicationId, admissionProp?.id])

  const status: AdmissionStatus = admission ? (admission.status as AdmissionStatus) : 'pendente'
  const doneCount = items.filter((i) => i.done).length

  const handleToggle = async (item: AdmissionChecklistItem) => {
    try {
      const updated = await admissionsService.setItemDone(item.id, !item.done)
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
      const nextItems = items.map((i) => (i.id === item.id ? updated : i))
      const nextStatus = derivedStatus(nextItems)
      if (admission && nextStatus !== admission.status) {
        try {
          const upd = await admissionsService.update(admission.id, { status: nextStatus })
          setAdmission(upd)
        } catch (_) {
          // Status derivado é best-effort; o manual sobrepõe depois.
        }
      }
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      toast({
        title: 'Erro ao atualizar o item',
        description: Object.values(fieldErrors)[0] || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleAddItem = async () => {
    if (!admission || !newItemTitle.trim()) return
    setAdding(true)
    try {
      const created = await admissionsService.addItem(admission.id, newItemTitle, items.length + 1)
      setItems((prev) => [...prev, created])
      setNewItemTitle('')
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      toast({
        title: 'Erro ao adicionar o item',
        description: Object.values(fieldErrors)[0] || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveItem = async (item: AdmissionChecklistItem) => {
    try {
      await admissionsService.removeItem(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      toast({
        title: 'Erro ao remover o item',
        description: Object.values(fieldErrors)[0] || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleSaveNotes = async () => {
    if (!admission) return
    setSavingNotes(true)
    try {
      const upd = await admissionsService.update(admission.id, { notes })
      setAdmission(upd)
      toast({ title: 'Observações salvas.' })
      onSaved?.()
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      toast({
        title: 'Erro ao salvar as observações',
        description: Object.values(fieldErrors)[0] || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingNotes(false)
    }
  }

  const packageText = useMemo(
    () => (admission ? buildPackageText(admission, items) : ''),
    [admission, items],
  )

  const handleCopyPackage = async () => {
    if (!packageText) return
    await copyLink(packageText, 'Pacote de admissão')
  }

  const handleMarkDone = async () => {
    if (!admission) return
    try {
      const upd = await admissionsService.update(admission.id, { status: 'concluido' })
      setAdmission(upd)
      toast({ title: 'Processo marcado como concluído.' })
      onSaved?.()
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      toast({
        title: 'Erro ao atualizar o status',
        description: Object.values(fieldErrors)[0] || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-sky-600" />
            Processo admissional — {admission?.candidate_name || '...'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {admission?.job_title || ''}
            {admission?.org_name ? ` · ${admission.org_name}` : ''}
            {admission?.manager_name ? ` · Gestor: ${admission.manager_name}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <LoadingState message="Carregando processo admissional..." />
        ) : admission ? (
          <div className="space-y-4 py-1">
            {/* Status + data */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Badge variant="outline" className={STATUS_BADGE_CLASS[status]}>
                {ADMISSION_STATUS_LABELS[status]}
              </Badge>
              <span className="text-slate-500">
                Contratação:{' '}
                {admission.hire_date
                  ? new Date(admission.hire_date).toLocaleDateString('pt-BR')
                  : '—'}
              </span>
              <span className="text-slate-400">
                {doneCount}/{items.length} itens concluídos
              </span>
              {status !== 'concluido' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-emerald-700 hover:bg-emerald-50 px-2"
                  onClick={handleMarkDone}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Marcar concluído
                </Button>
              )}
            </div>

            {/* Checklist */}
            <div className="space-y-1.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 p-2 rounded-lg border bg-slate-50/60"
                >
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={() => handleToggle(item)}
                    className="mt-0.5"
                    aria-label={`Concluir ${item.title}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs leading-snug ${
                        item.done ? 'text-slate-400 line-through' : 'text-slate-800'
                      }`}
                    >
                      {item.title}
                    </p>
                    {item.done && (item.done_by || item.done_at) && (
                      <p className="text-[10px] text-emerald-700 mt-0.5">
                        Concluído
                        {item.expand?.done_by?.name ? ` por ${item.expand.done_by.name}` : ''}
                        {item.done_at
                          ? ` em ${new Date(item.done_at).toLocaleString('pt-BR')}`
                          : ''}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-slate-300 hover:text-rose-600 shrink-0"
                    onClick={() => handleRemoveItem(item)}
                    title="Remover item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Novo item */}
            <div className="flex items-center gap-2">
              <Input
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="Adicionar item ao checklist..."
                className="text-xs h-8"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddItem()
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={adding || !newItemTitle.trim()}
                onClick={handleAddItem}
                className="h-8 shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Adicionar
              </Button>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600">
                Observações do processo
              </label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: exame agendado para 12/05; documentos pendentes do título de eleitor."
                className="text-xs"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={savingNotes || notes === (admission.notes || '')}
                  onClick={handleSaveNotes}
                >
                  {savingNotes ? 'Salvando...' : 'Salvar observações'}
                </Button>
              </div>
            </div>

            {/* Pacote de admissão */}
            <div className="space-y-1.5 pt-2 border-t">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-600">
                  Pacote de admissão (para o Goldway / DP)
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!packageText}
                  onClick={handleCopyPackage}
                  className="h-7 text-[11px]"
                >
                  Copiar pacote
                </Button>
              </div>
              <pre className="text-[10px] leading-relaxed whitespace-pre-wrap bg-slate-50 border rounded-lg p-3 max-h-48 overflow-y-auto text-slate-700 font-mono">
                {packageText}
              </pre>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Texto do pacote local (mesmo formato do service, usado no dialog). */
function buildPackageText(admission: Admission, items: AdmissionChecklistItem[]): string {
  const fmtDate = (iso?: string) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString('pt-BR')
    } catch (_) {
      return iso
    }
  }
  const lines: string[] = []
  lines.push(`PACOTE DE ADMISSÃO — ${admission.org_name || 'Talent'}`)
  lines.push('')
  lines.push('DADOS DO ADMITIDO')
  lines.push(`• Candidato: ${admission.candidate_name}`)
  lines.push(`• Contato: ${admission.candidate_contact || '—'}`)
  lines.push(`• CPF: ${admission.candidate_cpf || '—'}`)
  lines.push(`• Vaga: ${admission.job_title || '—'}`)
  lines.push(`• Cargo: ${admission.cargo_title || '—'}`)
  lines.push(`• Gestor da vaga: ${admission.manager_name || '—'}`)
  lines.push(`• Data da contratação: ${fmtDate(admission.hire_date)}`)
  lines.push(
    `• Status do processo: ${ADMISSION_STATUS_LABELS[admission.status] || admission.status}`,
  )
  if (admission.notes) lines.push(`• Observações: ${admission.notes}`)
  lines.push('')
  lines.push(
    `CHECKLIST ADMISSIONAL (${items.filter((i) => i.done).length}/${items.length} concluídos)`,
  )
  for (const item of items) {
    const mark = item.done ? '[x]' : '[ ]'
    const who = item.done && item.expand?.done_by?.name ? ` — por ${item.expand.done_by.name}` : ''
    const when = item.done_at ? ` em ${fmtDate(item.done_at)}` : ''
    lines.push(`${mark} ${item.title}${who}${when}`)
  }
  lines.push('')
  lines.push('Próxima etapa: cadastro no Goldway ERP pelo Departamento Pessoal.')
  lines.push('Gerado por Talent · Ausland.')
  return lines.join('\n')
}

export default AdmissionDialog
