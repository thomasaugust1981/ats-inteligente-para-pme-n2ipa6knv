//
// FASE 2 do modelo CHA — comparativo lado a lado dos candidatos avaliados
// de uma vaga, ordenado pelo score ponderado (total e por bloco CHA).
//

import React, { useEffect, useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CHA_BLOCK_KEYS, type ChaBlockKey, type JobChaRequirements } from '@/lib/cha'
import {
  CHA_EVAL_BLOCK_LABELS,
  chaEvaluationService,
  parseGrades,
  type ChaEvaluation,
} from '@/services/chaEvaluation'
import type { Application, Candidate } from '@/types/ats'

interface ChaComparisonCardProps {
  jobId: string
  jobCha: JobChaRequirements | null
  applications: Application[]
  /** Mudou quando uma ficha é salva (para recarregar). */
  refreshSignal?: number
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (score >= 60) return 'bg-sky-50 text-sky-700 border-sky-200'
  if (score >= 40) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-rose-50 text-rose-700 border-rose-200'
}

export const ChaComparisonCard: React.FC<ChaComparisonCardProps> = ({
  jobId,
  jobCha,
  applications,
  refreshSignal = 0,
}) => {
  const [evals, setEvals] = useState<ChaEvaluation[]>([])
  const [loading, setLoading] = useState(false)

  const hasCha =
    Boolean(jobCha) &&
    (jobCha!.cargo !== null ||
      (jobCha!.specific && Object.values(jobCha!.specific).some((b) => b && b.items.length > 0)))

  useEffect(() => {
    if (!jobId || !hasCha) return
    let cancelled = false
    setLoading(true)
    chaEvaluationService
      .listByJob(jobId)
      .then((list) => {
        if (!cancelled) setEvals(list)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [jobId, hasCha, refreshSignal])

  const rows = useMemo(() => {
    const byApp = new Map(evals.map((e) => [e.application_id, e]))
    return applications
      .map((app) => {
        const ev = byApp.get(app.id) || null
        const items = ev ? parseGrades(ev.grades) : []
        const blocks = {} as Record<ChaBlockKey, number>
        for (const block of CHA_BLOCK_KEYS) {
          const bItems = items.filter((it) => it.block === block)
          let w = 0
          let max = 0
          for (const it of bItems) {
            if (it.grade < 1) continue
            w += it.grade * it.weight
            max += it.weight * 5
          }
          blocks[block] = max > 0 ? Math.round((w / max) * 1000) / 10 : 0
        }
        return {
          app,
          candidate: app.expand?.candidate_id as Candidate | undefined,
          evaluation: ev,
          score: ev?.weighted_score ?? 0,
          blocks,
        }
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0))
  }, [evals, applications])

  // Vaga sem cargo/CHA: comportamento gracioso — o comparativo nem aparece.
  if (!hasCha) return null

  const evaluated = rows.filter((r) => r.evaluation)

  return (
    <Card className="border-sky-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-sky-600" />
          Comparativo CHA — candidatos avaliados
        </CardTitle>
        <p className="text-[11px] text-slate-500">
          Score ponderado = soma(nota × peso) ÷ soma(peso × 5). Ordenado pelo score total.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {loading && rows.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">Carregando avaliações…</p>
        ) : evaluated.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">
            Nenhuma avaliação CHA lançada ainda — use "Avaliar CHA" no card de um candidato.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="py-1.5 pr-3 font-semibold">Candidato</th>
                  <th className="py-1.5 pr-3 font-semibold">Score</th>
                  {CHA_BLOCK_KEYS.map((b) => (
                    <th key={b} className="py-1.5 pr-3 font-semibold">
                      {CHA_EVAL_BLOCK_LABELS[b]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evaluated.map((r) => (
                  <tr key={r.app.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-800">
                      {r.candidate?.name || r.candidate?.email || r.app.candidate_id}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className={cn('font-bold', scoreColor(r.score))}>
                        {r.score}%
                      </Badge>
                    </td>
                    {CHA_BLOCK_KEYS.map((b) => (
                      <td key={b} className="py-2 pr-3 text-slate-600">
                        {r.blocks[b]}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ChaComparisonCard
