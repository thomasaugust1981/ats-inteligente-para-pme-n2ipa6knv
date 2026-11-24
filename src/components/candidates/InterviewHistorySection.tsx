import React, { useEffect, useState } from 'react'
import {
  interviewScorecardsService,
  formatScorecardAverage,
  type InterviewScorecard,
} from '@/services/interviewScorecards'
import type { Application } from '@/types/ats'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/LoadingState'
import { ClipboardList } from 'lucide-react'

interface InterviewHistorySectionProps {
  applicationId: string
}

const RECOMMENDATION_BADGE: Record<string, { label: string; className: string }> = {
  avançar: { label: 'Avançar', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  reprovar: { label: 'Reprovar', className: 'bg-rose-50 text-rose-800 border-rose-200' },
  contratar: { label: 'Contratar', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
}

function formatInterviewDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

/**
 * Histórico de entrevistas do perfil do candidato: lista os scorecards
 * (interview_scorecards — mig 0051) da candidatura com notas 1–5, média em
 * destaque, recomendação, entrevistador e data.
 */
export const InterviewHistorySection: React.FC<InterviewHistorySectionProps> = ({
  applicationId,
}) => {
  const [scorecards, setScorecards] = useState<InterviewScorecard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!applicationId) return
    let cancelled = false
    setLoading(true)
    interviewScorecardsService
      .listByApplication(applicationId)
      .then((rows) => {
        if (!cancelled) setScorecards(rows)
      })
      .catch((err) => {
        console.warn('[interviewHistory] falha ao carregar scorecards:', err)
        if (!cancelled) setScorecards([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applicationId])

  return (
    <Card className="bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-sky-600" />
          Histórico de entrevistas
        </CardTitle>
        <CardDescription className="text-xs">
          Avaliações estruturadas por etapa: notas de 1 a 5, média, recomendação e entrevistador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <LoadingState label="Carregando avaliações..." />
        ) : scorecards.length === 0 ? (
          <p className="text-xs text-slate-400">
            Nenhuma avaliação de entrevista registrada para esta candidatura. Registre pelo botão
            "Avaliação da entrevista" no Pipeline.
          </p>
        ) : (
          scorecards.map((card) => {
            const rec = card.recommendation ? RECOMMENDATION_BADGE[card.recommendation] : null
            return (
              <div key={card.id} className="p-3 rounded-lg border bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-indigo-50 text-indigo-800 border-indigo-200"
                    >
                      {card.stage || 'Etapa'}
                    </Badge>
                    {rec && (
                      <Badge variant="outline" className={`text-[10px] ${rec.className}`}>
                        {rec.label}
                      </Badge>
                    )}
                    <span className="text-sm font-bold text-sky-700">
                      {formatScorecardAverage(card)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {formatInterviewDate(card.interviewed_at)}
                  </span>
                </div>
                <div className="flex gap-3 text-[11px] text-slate-600 flex-wrap">
                  <span>Técnica: {card.score_technical ?? '—'}/5</span>
                  <span>Comunicação: {card.score_communication ?? '—'}/5</span>
                  <span>Cultura: {card.score_culture ?? '—'}/5</span>
                </div>
                {card.interviewer && (
                  <div className="text-[11px] text-slate-500">
                    Entrevistador: <strong>{card.interviewer}</strong>
                  </div>
                )}
                {card.comments && (
                  <p className="text-xs text-slate-600 bg-white p-2 rounded border">
                    {card.comments}
                  </p>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

export default InterviewHistorySection
