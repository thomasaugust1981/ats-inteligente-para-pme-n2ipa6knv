import React, { useEffect, useState } from 'react'
import { interviewScorecardsService, type InterviewScorecard } from '@/services/interviewScorecards'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/LoadingState'
import { ClipboardList, FileText } from 'lucide-react'

interface InterviewHistorySectionProps {
  applicationId: string
  /** Abre a carta de proposta da candidatura (perfil do candidato). */
  onEditOffer?: () => void
}

const RECOMMENDATION_BADGE: Record<string, { label: string; className: string }> = {
  'avançar': { label: 'Avançar', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  reprovar: { label: 'Reprovar', className: 'bg-rose-50 text-rose-800 border-rose-200' },
  contratar: { label: 'Contratar', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
}

const STAGE_LABELS: Record<string, string> = {
  interview_hr: 'Entrevista RH',
  tech_interview: 'Entrevista Técnica',
  cultural_fit: 'Entrevista de Cultura',
}

/**
 * Histórico de entrevistas no perfil do candidato: lista os scorecards
 * (interview_scorecards — mig 0051) da candidatura com notas 1–5, média em
 * destaque, recomendação, entrevistador e data.
 */
export const InterviewHistorySection: React.FC<InterviewHistorySectionProps> = ({
  applicationId,
  onEditOffer,
}) => {
  const [scorecards, setScorecards] = useState<InterviewScorecard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!applicationId) return
    let cancelled = false
    setLoading(true)
    interviewScorecardsService
      .listForApplication(applicationId)
      .then((rows) => {
        if (!cancelled) setScorecards(rows)
      })
      .catch((err) => {
        console.warn('[scorecard] falha ao carregar histórico:', err)
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-sky-600" />
              Histórico de entrevistas
            </CardTitle>
            <CardDescription className="text-xs">
              Notas de entrevista por etapa (técnica, comunicação, cultura) e recomendação.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <LoadingState message="Carregando avaliações..." />
        ) : scorecards.length === 0 && !onEditOffer ? (
          <p className="text-xs text-slate-400">
            Nenhuma avaliação de entrevista registrada para esta candidatura. Registre pelo botão
            "Avaliação da entrevista" no Pipeline.
          </p>
        ) : (
          <>
            {onEditOffer && (
              <button
                type="button"
                onClick={onEditOffer}
                className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-100 rounded p-1.5 text-amber-700 font-medium transition flex items-center justify-center gap-1.5 text-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                Carta de proposta
              </button>
            )}
            {scorecards.length === 0 ? null : (
              <div className="space-y-3">
                {scorecards.map((card) => {
                  const rec = card.recommendation
                    ? RECOMMENDATION_BADGE[card.recommendation]
                    : null
                  const avg =
                    card.score_technical != null && card.score_communication != null && card.score_culture != null
                      ? (card.score_technical + card.score_communication + card.score_culture) / 3
                      : null
                  return (
                    <div key={card.id} className="p-3 rounded-lg border bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {STAGE_LABELS[card.stage] || card.stage || 'Entrevista'}
                        </span>
                        {rec ? (
                          <Badge variant="outline" className={`text-[10px] ${rec.className}`}>
                            {rec.label}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <span className="font-bold text-sky-700">
                          Média {avg != null ? avg.toFixed(1) : '—'}
                        </span>
                        <span>· Técnica {card.score_technical ?? '—'}</span>
                        <span>· Comunicação {card.score_communication ?? '—'}</span>
                        <span>· Cultura {card.score_culture ?? '—'}</span>
                      </div>
                      {card.interviewer ? (
                        <p className="text-[11px] text-slate-500">Entrevistador: {card.interviewer}</p>
                      ) : null}
                      {card.interviewed_at ? (
                        <p className="text-[10px] text-slate-400">
                          {new Date(card.interviewed_at).toLocaleDateString('pt-BR')}
                        </p>
                      ) : null}
                      {card.comments ? (
                        <p className="text-[11px] text-slate-600 bg-white border rounded p-1.5">
                          {card.comments}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default InterviewHistorySection
