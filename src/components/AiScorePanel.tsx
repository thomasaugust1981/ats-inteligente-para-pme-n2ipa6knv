import { Sparkles, RefreshCw, ShieldCheck, BotOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useAiScore, formatScoreDate } from '@/hooks/use-ai-score'
import { useAiAgentSettings } from '@/hooks/use-ai-agent-settings'

// Painel de score de IA do perfil do candidato: score geral + detalhamento por
// dimensão (técnica, comportamental/DISC, cultural) + justificativa + HISTÓRICO
// de cálculos anteriores. Consultivo — nunca aprova/reprova automaticamente.

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Recálculo manual',
  stage_change: 'Mudança de etapa',
  disc_completed: 'DISC preenchido',
  note_added: 'Comentário adicionado',
  stage_comment: 'Comentário de etapa',
  application_created: 'Candidatura criada',
}

const DIMENSIONS: Array<{
  key: 'score_technical' | 'score_behavioral' | 'score_cultural'
  label: string
  color: string
}> = [
  { key: 'score_technical', label: 'Técnica (currículo vs. requisitos)', color: 'bg-sky-500' },
  { key: 'score_behavioral', label: 'Comportamental (DISC)', color: 'bg-purple-500' },
  { key: 'score_cultural', label: 'Cultural (FIT + visão/missão)', color: 'bg-emerald-500' },
]

export function AiScorePanel({
  applicationId,
  className,
}: {
  applicationId?: string | null
  className?: string
}) {
  const { status, latest, history, message, error, recalculating, recalculate } =
    useAiScore(applicationId)
  const { settings: agentSettings, loading: settingsLoading } = useAiAgentSettings()
  const agentOff = !settingsLoading && !agentSettings.enabled

  const score = status === 'ready' && latest ? latest.score : null
  const scoreColor =
    score != null && score >= 70
      ? 'text-emerald-700'
      : score != null && score >= 45
        ? 'text-amber-700'
        : 'text-slate-600'

  return (
    <Card className={`bg-white ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Score de IA (consultivo)
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            disabled={recalculating || !applicationId || agentOff}
            onClick={() => recalculate('manual')}
            title={agentOff ? 'O agente está desativado pelo administrador' : undefined}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalculando...' : 'Recalcular score'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {agentOff && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2">
            <BotOff className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-semibold text-slate-700">Agente de score desativado</p>
              <p className="text-slate-500 mt-0.5">
                O administrador desativou o agente — nenhum score é calculado. scores anteriores
                continuam no histórico abaixo.
              </p>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="space-y-2">
            <div className="h-8 w-28 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-slate-100 animate-pulse" />
          </div>
        )}

        {!agentOff && (status === 'empty' || status === 'insufficient' || status === 'error') && (
          <div className="text-xs space-y-2">
            <p className="font-semibold text-slate-700">Score ainda não calculado</p>
            <p className="text-slate-500">
              {error ||
                message ||
                'Dados insuficientes para o cálculo (sem currículo estruturado nem habilidades preenchidas).'}
            </p>
            {history.length > 0 && (
              <div className="pt-2 border-t">
                <p className="font-semibold text-slate-600 mb-2">
                  Histórico de cálculos anteriores
                </p>
                <ul className="space-y-1">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">{formatScoreDate(h.created)}</span>
                      <span className="font-medium tabular-nums text-slate-700">
                        {h.insufficient_data ? '—' : `${h.score}/100`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {status === 'ready' && latest && (
          <>
            <div className="flex items-end gap-3">
              <span className={`text-4xl font-bold tabular-nums ${scoreColor}`}>
                {latest.score}
              </span>
              <span className="text-sm text-slate-400 pb-1">/100</span>
              <Badge variant="outline" className="mb-1.5 text-[10px]">
                {TRIGGER_LABELS[latest.trigger || 'manual'] || latest.trigger}
              </Badge>
            </div>

            {(() => {
              const w =
                latest.snapshot &&
                typeof latest.snapshot === 'object' &&
                'weights_used' in latest.snapshot
                  ? (
                      latest.snapshot as {
                        weights_used?: {
                          technical?: number
                          behavioral?: number
                          cultural?: number
                        }
                      }
                    ).weights_used
                  : null
              if (!w) return null
              return (
                <p className="text-[10px] text-slate-400 -mt-2">
                  Pesos usados: técnica {w.technical ?? '—'}% · comportamental {w.behavioral ?? '—'}
                  % · cultural {w.cultural ?? '—'}%
                </p>
              )
            })()}

            <div className="space-y-2">
              {DIMENSIONS.map((dim) => {
                const value = latest[dim.key]
                return (
                  <div key={dim.key} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">{dim.label}</span>
                      <span className="font-medium tabular-nums text-slate-700">
                        {value == null ? '—' : `${value}/100`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${dim.color}`}
                        style={{ width: `${value == null ? 0 : Math.min(100, value)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="bg-slate-50 border rounded-lg p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1">
                Justificativa
              </p>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {latest.justification}
              </p>
            </div>

            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 shrink-0" />
              Consultivo — o sistema nunca reprova nem aprova automaticamente por score · Último
              cálculo: {formatScoreDate(latest.created)}
            </p>

            {history.length > 1 && (
              <div className="pt-3 border-t">
                <p className="text-[11px] font-semibold text-slate-500 uppercase mb-2">Histórico</p>
                <ul className="space-y-1">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between text-[11px] gap-2">
                      <span className="text-slate-500">{formatScoreDate(h.created)}</span>
                      <span className="text-slate-400 truncate max-w-[45%] text-right">
                        {TRIGGER_LABELS[h.trigger || 'manual'] || h.trigger}
                      </span>
                      <span className="font-medium tabular-nums text-slate-700">
                        {h.insufficient_data ? '—' : `${h.score}/100`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default AiScorePanel
