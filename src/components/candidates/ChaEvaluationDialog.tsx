//
// FASE 2 do modelo CHA — ficha de avaliação do candidato no pipeline.
// Notas 1-5 por requisito (agrupados por bloco, peso visível), evidência
// obrigatória em nota < 3, score ponderado 0-100 calculado ao vivo e gravado
// em cha_evaluations. A revalidação é server-side (cha_evaluations.js).
//

import React, { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { CHA_BLOCK_META, type ChaBlockKey, type JobChaRequirements } from '@/lib/cha'
import {
  allGraded,
  blockScores,
  chaEvaluationService,
  CHA_EVAL_BLOCK_LABELS,
  flattenJobRequirements,
  parseGrades,
  validateGrades,
  weightedScore,
  type ChaEvalItem,
} from '@/services/chaEvaluation'
import type { Application, Candidate } from '@/types/ats'

interface ChaEvaluationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobCha: JobChaRequirements | null
  jobId: string
  application: Application | null
  /** Chamado após salvar com sucesso (para recarregar o pipeline/comparativo). */
  onSaved?: () => void
}

const GRADE_LABELS: Record<number, string> = {
  1: '1 — Insuficiente',
  2: '2 — Abaixo do esperado',
  3: '3 — Atende',
  4: '4 — Supera',
  5: '5 — Excepcional',
}

function gradeColor(score: number): string {
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-sky-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-rose-600'
}

export const ChaEvaluationDialog: React.FC<ChaEvaluationDialogProps> = ({
  open,
  onOpenChange,
  jobCha,
  jobId,
  application,
  onSaved,
}) => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [items, setItems] = useState<ChaEvalItem[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadedId, setLoadedId] = useState<string | null>(null)

  const candidate = application?.expand?.candidate_id as Candidate | undefined
  const requirements = useMemo(
    () => (open && jobCha ? flattenJobRequirements(jobCha) : []),
    [open, jobCha],
  )

  // Carrega a ficha existente da candidatura (editável) ao abrir.
  useEffect(() => {
    if (!open || !application || requirements.length === 0) return
    let cancelled = false
    setLoading(true)
    setErrors({})
    chaEvaluationService
      .getByApplication(application.id)
      .then((existing) => {
        if (cancelled) return
        const saved = existing ? parseGrades(existing.grades) : []
        const byKey = new Map(saved.map((s) => [s.key, s]))
        setItems(
          requirements.map((req) => {
            const prev = byKey.get(req.key)
            return prev ? { ...req, grade: prev.grade, evidence: prev.evidence } : req
          }),
        )
        setLoadedId(existing ? existing.id : null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, application?.id, requirements])

  const liveScore = useMemo(() => weightedScore(items), [items])
  const liveBlocks = useMemo(() => blockScores(items), [items])
  const complete = allGraded(items)
  // Apenas admin, superadmin, recrutador (RH) avaliam — gestor é somente leitura.
  const canEvaluate = Boolean(user && user.role !== 'manager')

  const setGrade = (key: string, grade: number) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, grade } : it)))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const setEvidence = (key: string, evidence: string) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, evidence } : it)))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleSave = async () => {
    if (!application) return
    const errs = validateGrades(items)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast({
        title: 'Ficha incompleta',
        description:
          'Avalie todos os requisitos (1-5). Notas abaixo de 3 exigem evidência/observação.',
        variant: 'destructive',
      })
      return
    }
    try {
      setSaving(true)
      await chaEvaluationService.save(application.id, jobId, items)
      toast({
        title: 'Avaliação CHA salva!',
        description: `Score ponderado de ${candidate?.name || 'candidato'}: ${weightedScore(items)}%.`,
      })
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      console.error('[ChaEvaluationDialog] erro ao salvar:', err)
      toast({
        title: 'Erro ao salvar avaliação',
        description: 'A ficha não foi gravada. Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setLoadedId(null)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Ficha de Avaliação CHA</DialogTitle>
          <DialogDescription className="text-xs">
            {candidate ? (
              <>
                <strong>{candidate.name}</strong> — vaga de{' '}
                <strong>{application?.expand?.job_id?.title || 'vaga'}</strong>. Nota 1-5 por
                requisito; abaixo de 3, registre a evidência observada.
              </>
            ) : (
              'Notas de 1 a 5 por requisito CHA.'
            )}
          </DialogDescription>
        </DialogHeader>

        {!canEvaluate ? (
          <p className="text-xs text-amber-600 py-4">
            Somente administradores, RH e recrutadores podem lançar avaliações CHA.
          </p>
        ) : loading ? (
          <p className="text-xs text-slate-400 py-6 text-center">Carregando ficha…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            Esta vaga não tem requisitos CHA definidos.
          </p>
        ) : (
          <>
            <ScrollArea className="flex-1 max-h-[55vh] pr-3">
              <div className="space-y-5">
                {CHA_BLOCK_META &&
                  (Object.keys(CHA_BLOCK_META) as ChaBlockKey[]).map((block) => {
                    const blockItems = items.filter((it) => it.block === block)
                    if (blockItems.length === 0) return null
                    return (
                      <div key={block}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                            {CHA_EVAL_BLOCK_LABELS[block]}
                          </h4>
                          <Badge variant="outline" className="text-[10px]">
                            {liveBlocks[block]}%
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          {blockItems.map((it) => (
                            <div
                              key={it.key}
                              className="rounded-lg border bg-slate-50/60 p-3 space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-medium text-slate-800 leading-snug">
                                  {it.description}
                                  <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                                    (peso {it.weight})
                                  </span>
                                </p>
                                <div className="flex shrink-0 items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <button
                                      key={n}
                                      type="button"
                                      disabled={saving}
                                      onClick={() => setGrade(it.key, n)}
                                      title={GRADE_LABELS[n]}
                                      className={cn(
                                        'rounded transition',
                                        n <= it.grade
                                          ? n < 3
                                            ? 'text-rose-500'
                                            : 'text-amber-400'
                                          : 'text-slate-300 hover:text-slate-400',
                                      )}
                                    >
                                      <Star className="w-4 h-4 fill-current" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {(it.grade > 0 && it.grade < 3) || errors[it.key] ? (
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-semibold text-slate-500">
                                    Evidência / observação <span className="text-rose-500">*</span>
                                  </Label>
                                  <Textarea
                                    rows={2}
                                    disabled={saving}
                                    placeholder="O que foi observado na entrevista/teste que justifica essa nota?"
                                    value={it.evidence}
                                    onChange={(e) => setEvidence(it.key, e.target.value)}
                                    className="text-xs"
                                  />
                                  {errors[it.key] && (
                                    <p className="text-[10px] text-rose-600">{errors[it.key]}</p>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </ScrollArea>

            <Separator className="my-3" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Score ponderado (nota × peso ÷ peso × 5)
                </p>
                <p
                  className={cn(
                    'text-2xl font-bold leading-tight',
                    gradeColor(liveScore),
                    !complete && 'opacity-60',
                  )}
                >
                  {liveScore}%
                  {!complete && (
                    <span className="ml-2 text-[10px] font-normal text-slate-400">
                      (faltam requisitos)
                    </span>
                  )}
                </p>
              </div>
              <p className="text-[10px] text-slate-400 max-w-[55%] text-right">
                {loadedId
                  ? 'Esta ficha já foi salva antes — salvar novamente atualiza as notas.'
                  : 'A ficha é única por candidato/vaga e pode ser editada depois.'}
              </p>
            </div>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || loading || !canEvaluate || items.length === 0}
            onClick={handleSave}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            {saving ? 'Gravando…' : 'Salvar avaliação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ChaEvaluationDialog
