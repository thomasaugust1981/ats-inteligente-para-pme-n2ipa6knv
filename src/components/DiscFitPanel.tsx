import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { Company, DiscResult } from '@/types/ats'
import { onboardingService } from '@/services/onboarding'

// Painel de resultado DISC + aderência (FIT) à visão e missão da empresa.
// Busca por application_id em disc_results; quando não há resultado, mostra
// um estado vazio discreto (o candidato ainda não respondeu o questionário).

const FACTOR_LABELS: Array<{
  key: 'score_d' | 'score_i' | 'score_s' | 'score_c'
  label: string
  color: string
}> = [
  { key: 'score_d', label: 'Dominância (D)', color: 'bg-rose-500' },
  { key: 'score_i', label: 'Influência (I)', color: 'bg-amber-500' },
  { key: 'score_s', label: 'Estabilidade (S)', color: 'bg-emerald-500' },
  { key: 'score_c', label: 'Conformidade (C)', color: 'bg-sky-500' },
]

const PROFILE_TRAITS: Record<string, string> = {
  D: 'Determinado — orientado a resultados, direto e decidido.',
  I: 'Influente — comunicativo, otimista e persuasivo.',
  S: 'Estável — paciente, colaborativo e consistente.',
  C: 'Consciencioso — analítico, detalhista e preciso.',
}

export interface DiscFitPanelProps {
  applicationId: string
  className?: string
}

export function DiscFitPanel({ applicationId, className }: DiscFitPanelProps) {
  const [result, setResult] = useState<DiscResult | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const record = await pb
          .collection('disc_results')
          .getFirstListItem<DiscResult>(`application_id = "${applicationId}"`)
        if (!cancelled) setResult(record)
      } catch (_) {
        // sem resultado ainda
      }
      try {
        setCompany(await onboardingService.getOrCreateCompany())
      } catch (_) {
        // sem empresa configurada
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [applicationId])

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-center text-xs text-slate-400">
          Carregando resultado DISC...
        </CardContent>
      </Card>
    )
  }

  const score = result?.status === 'completed' ? result : null
  const maxScore = 20 // 5 perguntas x nota máxima 4

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          DISC &amp; FIT Cultural
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!score && (
          <p className="text-xs text-slate-500">
            {result
              ? 'O candidato ainda não respondeu o questionário DISC (convite enviado).'
              : 'Sem convite DISC registrado para esta candidatura.'}
          </p>
        )}

        {score && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                Perfil {score.profile || '—'}
              </Badge>
              <span className="text-xs text-slate-500">
                {PROFILE_TRAITS[score.profile || ''] || ''}
              </span>
            </div>

            <div className="space-y-2">
              {FACTOR_LABELS.map((factor) => {
                const value = score[factor.key] || 0
                return (
                  <div key={factor.key} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">{factor.label}</span>
                      <span className="font-medium tabular-nums text-slate-700">
                        {value}/{maxScore}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${factor.color}`}
                        style={{ width: `${Math.min(100, (value / maxScore) * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* FIT cultural: aderência da empresa (visão e missão) — exibida quando configurada */}
        {(company?.vision || company?.mission) && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Aderência cultural</p>
            {company?.vision && (
              <div className="text-xs space-y-0.5">
                <p className="font-medium text-slate-700">Visão</p>
                <p className="text-slate-500 leading-relaxed">{company.vision}</p>
              </div>
            )}
            {company?.mission && (
              <div className="text-xs space-y-0.5">
                <p className="font-medium text-slate-700">Missão</p>
                <p className="text-slate-500 leading-relaxed">{company.mission}</p>
              </div>
            )}
            {score && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">Aderência estimada</span>
                  <span className="font-medium tabular-nums text-slate-700">
                    {score.fit_score ?? '—'}
                    {score.fit_score != null ? '%' : ''}
                  </span>
                </div>
                <Progress value={score.fit_score ?? 0} className="h-1.5" />
                {score.fit_note && <p className="text-[11px] text-slate-500">{score.fit_note}</p>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default DiscFitPanel
