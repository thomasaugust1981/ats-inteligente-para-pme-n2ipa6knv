import React, { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import {
  offerLettersService,
  renderProposalLetter,
  type OfferLetter,
} from '@/services/offerLetters'
import type { Application, Job } from '@/types/ats'
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
import { LoadingState } from '@/components/LoadingState'
import { useCopyLink } from '@/hooks/use-copy-link'
import { FileText, CheckCircle2 } from 'lucide-react'

interface OfferLetterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: Application | null
  job: Job | null
  companyName: string
  onSaved?: () => void
}

const BR_MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

function brLongDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date()
  return `${String(d.getDate()).padStart(2, '0')} de ${BR_MONTHS[d.getMonth()]} de ${d.getFullYear()}`
}

function formatSalaryRange(job: Job | null): string {
  if (!job) return ''
  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)} a ${fmt(job.salary_max)}`
  if (job.salary_min) return `a partir de ${fmt(job.salary_min)}`
  if (job.salary_max) return `até ${fmt(job.salary_max)}`
  return ''
}

/**
 * Carta de proposta (etapa "Proposta"): gera o texto a partir do modelo da
 * organização (mig 0053) com os dados reais da candidatura, permite editar e
 * salva em offer_letters (mig 0055). Envio por e-mail fica para depois.
 */
export const OfferLetterDialog: React.FC<OfferLetterDialogProps> = ({
  open,
  onOpenChange,
  application,
  job,
  companyName,
  onSaved,
}) => {
  const { toast } = useToast()
  const { copyLink } = useCopyLink()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState<OfferLetter | null>(null)
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)

  const candidateName = application?.expand?.candidate_id?.name || ''
  const salaryText = useMemo(() => formatSalaryRange(job), [job])

  // Gera o preview sempre que abre (ou quando os dados mudam) a partir do
  // modelo — a carta salva tem prioridade quando o usuário não editou nada.
  useEffect(() => {
    if (!open || !application) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const orgId = String(
          (application.expand?.job_id as (Job & { org_id?: string }) | undefined)?.org_id ||
            (application as unknown as { org_id?: string }).org_id ||
            '',
        )
        const [template, saved] = await Promise.all([
          offerLettersService.getTemplate(orgId),
          offerLettersService.findForApplication(application.id).catch(() => null),
        ])
        if (cancelled) return
        setExisting(saved)
        if (saved?.content) {
          setContent(saved.content)
        } else {
          setContent(
            renderProposalLetter(template, {
              candidato: candidateName,
              cargo: job?.title || '',
              empresa: companyName,
              salario: salaryText,
              dataInicio: brLongDate(),
            }),
          )
        }
        setDirty(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, application?.id])

  const handleSave = async () => {
    if (!application) return
    if (!content.trim()) {
      toast({
        title: 'Carta vazia',
        description: 'Escreva o texto da proposta antes de salvar.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await offerLettersService.save({ application_id: application.id, content }, existing?.id)
      toast({
        title: existing ? 'Carta atualizada' : 'Carta registrada',
        description: 'A proposta foi gravada no histórico da candidatura.',
      })
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      toast({
        title: 'Erro ao salvar a carta',
        description: Object.values(fieldErrors)[0] || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    await copyLink(content, 'Texto da proposta')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-600" />
            Carta de proposta — {candidateName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {job?.title} · {companyName}
            {existing
              ? ' · proposta existente carregada'
              : ' · texto gerado, edite antes de salvar'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <LoadingState message="Gerando preview da proposta..." />
        ) : (
          <div className="space-y-3 py-1">
            <Textarea
              rows={16}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                setDirty(true)
              }}
              className="text-xs leading-relaxed font-mono"
              aria-label="Texto da carta de proposta"
            />
            <p className="text-[11px] text-slate-400">
              O texto é salvo na candidatura e pode ser copiado para enviar ao candidato. Envio
              automático por e-mail não está incluído nesta etapa.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={loading || !content}
          >
            Copiar texto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || loading || !dirty}
            onClick={handleSave}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? 'Salvando...' : existing ? 'Atualizar carta' : 'Salvar carta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OfferLetterDialog
