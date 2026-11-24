import React, { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import {
  interviewScorecardsService,
  formatScorecardAverage,
  type InterviewScorecard,
} from '@/services/interviewScorecards'
import type { Job } from '@/types/ats'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { LoadingState } from '@/components/LoadingState'
import { ClipboardList } from 'lucide-react'

interface InterviewScorecardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  candidateName: string
  jobTitle: string
  stageId: string
  stageLabel: string
  onSaved?: () => void
}

const SCORE_FIELDS = [
  { key: 'score_technical', label: 'Nota técnica' },
  { key: 'score_communication', label: 'Nota de comunicação' },
  { key: 'score_culture', label: 'Nota de cultura' },
] as const

type ScoreKey = (typeof SCORE_FIELDS)[number]['key']

const TODAY_ISO = () => new Date().toISOString().slice(0, 10)

/**
 * Scorecard de entrevista (coleção interview_scorecards, mig 0051): três notas
 * 1–5 (técnica, comunicação, cultura), comentários e recomendação
 * (avançar/reprovar/contratar). Se já existe scorecard para candidatura+etapa,
 * carrega para edição. Entrevistador é o usuário logado (com opção de ajuste).
 */
export const InterviewScorecardDialog: React.FC<InterviewScorecardDialogProps> = ({
  open,
  onOpenChange,
  applicationId,
  candidateName,
  jobTitle,
  stageId,
  stageLabel,
  onSaved,
}) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [existingId, setExistingId] = useState<string | undefined>(undefined)
  const [interviewerName, setInterviewerName] = useState('')
  const [interviewedAt, setInterviewedAt] = useState(TODAY_ISO())
  const [scores, setScores] = useState<Record<ScoreKey, string>>({
    score_technical: '',
    score_communication: '',
    score_culture: '',
  })
  const [comments, setComments] = useState('')
  const [recommendation, setRecommendation] = useState('')

  const average = useMemo(() => {
    const notes = [scores.score_technical, scores.score_communication, scores.score_culture]
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5)
    if (notes.length === 0) return null
    return notes.reduce((a, b) => a + b, 0) / notes.length
  }, [scores])

  useEffect(() => {
    if (!open || !applicationId) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const me = pb.authStore.record as (Record<string, unknown> & { name?: string }) | null
        const card = await interviewScorecardsService.findForApplicationStage(
          applicationId,
          stageId,
        )
        if (cancelled) return
        if (card) {
          setExistingId(card.id)
          setInterviewerName(card.interviewer || me?.name || '')
          setInterviewedAt(card.interviewed_at ? card.interviewed_at.slice(0, 10) : TODAY_ISO())
          setScores({
            score_technical: card.score_technical != null ? String(card.score_technical) : '',
            score_communication:
              card.score_communication != null ? String(card.score_communication) : '',
            score_culture: card.score_culture != null ? String(card.score_culture) : '',
          })
          setComments(card.comments || '')
          setRecommendation(card.recommendation || '')
        } else {
          setExistingId(undefined)
          setInterviewerName(me?.name || '')
          setInterviewedAt(TODAY_ISO())
          setScores({ score_technical: '', score_communication: '', score_culture: '' })
          setComments('')
          setRecommendation('')
        }
      } catch (err) {
        console.warn('[scorecard] falha ao carregar:', err)
        if (!cancelled) {
          toast({
            title: 'Não foi possível carregar a avaliação',
            description: 'Tente novamente em instantes.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, applicationId, stageId])

  const parseScore = (value: string): number | null => {
    if (!value) return null
    const n = Math.round(Number(value))
    if (!Number.isFinite(n) || n < 1 || n > 5) return null
    return n
  }

  const handleSave = async () => {
    const technical = parseScore(scores.score_technical)
    const communication = parseScore(scores.score_communication)
    const culture = parseScore(scores.score_culture)
    if (technical === null || communication === null || culture === null) {
      toast({
        title: 'Notas incompletas',
        description: 'Preencha as três notas de 1 a 5 antes de salvar.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await interviewScorecardsService.save(
        {
          application_id: applicationId,
          stage: stageId,
          interviewer: interviewerName || undefined,
          interviewed_at: interviewedAt
            ? new Date(`${interviewedAt}T12:00:00`).toISOString()
            : undefined,
          score_technical: technical,
          score_communication: communication,
          score_culture: culture,
          comments: comments || undefined,
          recommendation: recommendation || undefined,
        },
        existingId,
      )
      toast({
        title: existingId ? 'Avaliação atualizada' : 'Avaliação registrada',
        description: `Scorecard de ${candidateName} salvo com sucesso.`,
      })
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      toast({
        title: 'Erro ao salvar a avaliação',
        description: Object.values(fieldErrors)[0] || 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-sky-600" />
            Avaliação da entrevista — {candidateName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Etapa <strong>{stageLabel}</strong> · vaga <strong>{jobTitle}</strong>
            {existingId ? ' · avaliação existente carregada para edição' : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <LoadingState label="Carregando avaliação..." />
        ) : (
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="scorecard-interviewer" className="text-xs font-semibold">
                  Entrevistador
                </Label>
                <Input
                  id="scorecard-interviewer"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                  placeholder="Nome de quem entrevistou"
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="scorecard-date" className="text-xs font-semibold">
                  Data da entrevista
                </Label>
                <Input
                  id="scorecard-date"
                  type="date"
                  value={interviewedAt}
                  onChange={(e) => setInterviewedAt(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {SCORE_FIELDS.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs font-semibold">{f.label}</Label>
                  <Select
                    value={scores[f.key] || undefined}
                    onValueChange={(v) => setScores((s) => ({ ...s, [f.key]: v }))}
                  >
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue placeholder="1–5" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-xs">
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="text-sm font-bold text-sky-700" aria-live="polite">
              Média:{' '}
              {formatScorecardAverage({
                score_technical: parseScore(scores.score_technical),
                score_communication: parseScore(scores.score_communication),
                score_culture: parseScore(scores.score_culture),
              })}
            </div>

            <div>
              <Label htmlFor="scorecard-comments" className="text-xs font-semibold">
                Comentários
              </Label>
              <Textarea
                id="scorecard-comments"
                rows={3}
                placeholder="Ex: boa comunicação, domínio técnico alinhado à vaga..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Recomendação</Label>
              <Select value={recommendation || undefined} onValueChange={setRecommendation}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avançar" className="text-xs">
                    Avançar no processo
                  </SelectItem>
                  <SelectItem value="reprovar" className="text-xs">
                    Reprovar
                  </SelectItem>
                  <SelectItem value="contratar" className="text-xs">
                    Contratar
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400 mt-1">
                A recomendação sugere a próxima movimentação — a decisão segue no pipeline.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
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
            disabled={saving || loading}
            onClick={handleSave}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            {saving ? 'Salvando...' : existingId ? 'Atualizar avaliação' : 'Salvar avaliação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default InterviewScorecardDialog
