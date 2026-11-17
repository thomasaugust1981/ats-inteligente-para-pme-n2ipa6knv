// Detalhe da contribuição CHA na dimensão técnica do score de IA: selo
// "baseado na ficha CHA" + % por bloco. Renderiza null quando o score não veio
// da ficha CHA (candidato sem ficha — comportamento anterior preservado).

import { ClipboardCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CHA_BLOCK_LABELS, CHA_BLOCK_ORDER, chaFromSnapshot } from '@/lib/aiScoreCha'

export function AiScoreChaDetail({ snapshot }: { snapshot: unknown }) {
  const cha = chaFromSnapshot(snapshot)
  if (!cha) return null

  return (
    <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-[10px] gap-1">
          <ClipboardCheck className="w-3 h-3" />
          Baseado na ficha CHA
        </Badge>
        <span className="text-[10px] text-slate-500">
          Requisitos da vaga com nota 1–5 · evidências lançadas pelo avaliador
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-slate-600">
        {CHA_BLOCK_ORDER.map((b) => {
          const pct = cha.block_scores?.[b]
          return (
            <span key={b}>
              {CHA_BLOCK_LABELS[b]}:{' '}
              <span className="font-semibold tabular-nums text-slate-800">
                {pct == null ? '—' : `${pct}%`}
              </span>
            </span>
          )
        })}
        <span className="ml-auto">
          Score CHA:{' '}
          <span className="font-semibold tabular-nums text-slate-800">
            {cha.weighted_score ?? '—'}%
          </span>
        </span>
      </div>
      {Array.isArray(cha.low_grades) && cha.low_grades.length > 0 && (
        <div className="pt-1 border-t border-sky-100 space-y-0.5">
          {cha.low_grades.map((g, i) => (
            <p key={i} className="text-[10px] text-slate-500 truncate">
              <span className="font-medium text-rose-600">Nota {g.nota}</span> · {g.requisito}
              {g.evidencia ? ` — “${g.evidencia}”` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export default AiScoreChaDetail
