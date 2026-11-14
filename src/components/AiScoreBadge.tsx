import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiScore, formatScoreDate } from '@/hooks/use-ai-score'

// Badge de score de IA do card do pipeline. Consultivo: mostra número +
// justificativa num popover, data do último cálculo e botão de recalcular.
// Nunca reprova/aprova — apenas informa o recrutador.

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

  if (status === 'loading') {
    return <Skeleton className={`h-6 w-24 rounded-full ${className || ''}`} />
  }

  const scoreColor =
    latest && latest.score >= 70
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
          title="Score de IA (consultivo)"
        >
          <Sparkles className="w-3 h-3" />
          {status === 'ready' && latest ? <>Score IA {latest.score}</> : <>Score IA —</>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs" align="start">
        {status === 'ready' && latest ? (
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
