import { Sparkles, BotOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiScore, formatScoreDate } from '@/hooks/use-ai-score'
import { useAiAgentSettings } from '@/hooks/use-ai-agent-settings'
import { chaFromSnapshot } from '@/lib/aiScoreCha'
import { AiScoreChaDetail } from '@/components/aiScore/AiScoreChaDetail'

// Badge de score de IA do card do pipeline. Consultivo: mostra número +
// justificativa num popover, data do último cálculo e botão de recalcular.
// Quando o agente está desativado (ai_agent_settings.enabled = false), o badge
// mostra o estado desativado em vez do número. Nunca reprova/aprova.

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Recálculo manual',
  stage_change: 'Mudança de etapa',
  disc_completed: 'DISC preenchido',
  note_added: 'Comentário adicionado',
  stage_comment: 'Comentário de etapa',
  application_created: 'Candidatura criada',
}

export function AiScoreBadge({
  applicationId,
  className,
}: {
  applicationId?: string | null
  className?: string
}) {
  const { status, latest, message, error, recalculating, recalculate } = useAiScore(applicationId)
  const { settings: agentSettings, loading: settingsLoading } = useAiAgentSettings()
  const agentOff = !settingsLoading && !agentSettings.enabled

  if (status === 'loading') {
    return <Skeleton className={`h-6 w-24 rounded-full ${className || ''}`} />
  }

  const scoreColor = agentOff
    ? 'bg-slate-100 text-slate-500 border-slate-200'
    : latest && latest.score >= 70
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : latest && latest.score >= 45
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-slate-100 text-slate-700 border-slate-200'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors hover:opacity-90 ${scoreColor} ${className || ''}`}
          title={agentOff ? 'Agente desativado' : 'Score de IA (consultivo)'}
        >
          {agentOff ? <BotOff className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
          {agentOff ? (
            <>Agente desativado</>
          ) : status === 'ready' && latest ? (
            <>Score IA {latest.score}</>
          ) : (
            <>Score IA —</>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs" align="start">
        {agentOff ? (
          <div className="space-y-2">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <BotOff className="w-3.5 h-3.5" /> Agente de score desativado
            </p>
            <p className="text-slate-500">
              O administrador desativou o agente de score de IA — nenhum score é calculado (nem por
              gatilho, nem no botão recalcular). Scores anteriores continuam visíveis no perfil.
            </p>
            {latest && (
              <p className="text-[10px] text-slate-400">
                Último score registrado: {latest.score}/100 · {formatScoreDate(latest.created)}
              </p>
            )}
          </div>
        ) : status === 'ready' && latest ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-800">Score de IA: {latest.score}/100</span>
              <Badge variant="outline" className="text-[10px]">
                {TRIGGER_LABELS[latest.trigger || 'manual'] || latest.trigger}
              </Badge>
            </div>
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
              {latest.justification}
            </p>
            {(() => {
              const snap = latest.snapshot as
                | {
                    weights_used?: {
                      technical?: number
                      behavioral?: number
                      cultural?: number
                    }
                    weights_source?: string
                  }
                | null
                | undefined
              const w = snap?.weights_used
              if (!w) return null
              const source = snap?.weights_source === 'job' ? 'régua da vaga' : 'global'
              return (
                <p className="text-[10px] text-slate-400">
                  Pesos usados: técnica {w.technical ?? '—'}% · comportamental {w.behavioral ?? '—'}
                  % · cultural {w.cultural ?? '—'}% ({source})
                </p>
              )
            })()}
            <AiScoreChaDetail snapshot={latest.snapshot} />
            <p className="text-[10px] text-slate-400">
              Último cálculo: {formatScoreDate(latest.created)} · Consultivo — não reprova nem
              aprova automaticamente.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              disabled={recalculating}
              onClick={() => recalculate('manual')}
            >
              {recalculating ? 'Recalculando...' : 'Recalcular score'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="font-semibold text-slate-800">Score ainda não calculado</p>
            <p className="text-slate-500">
              {error ||
                message ||
                'Dados insuficientes para o cálculo (sem currículo estruturado nem habilidades).'}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              disabled={recalculating}
              onClick={() => recalculate('manual')}
            >
              {recalculating ? 'Recalculando...' : 'Tentar calcular'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export default AiScoreBadge
