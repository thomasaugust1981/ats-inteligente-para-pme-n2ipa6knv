import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Rocket } from 'lucide-react'
import type { OpeningPrecondition } from '@/services/jobOpening'
import type { CargoRaw } from '@/services/cargos'

interface OpenJobButtonProps {
  cargo: CargoRaw
  preconditions: OpeningPrecondition[]
  canOpen: boolean
  onOpen: () => void
}

/** FASE 3: botão "Abrir vaga" — desabilitado enquanto alguma pré-condição falhar,
 *  listando exatamente qual falta, cada item com link para resolver. */
export const OpenJobButton: React.FC<OpenJobButtonProps> = ({
  cargo,
  preconditions,
  canOpen,
  onOpen,
}) => {
  const failed = preconditions.filter((p) => !p.ok)

  return (
    <div className="space-y-1.5">
      <Button
        size="sm"
        disabled={!canOpen}
        onClick={onOpen}
        title={canOpen ? 'Abrir vaga a partir deste cargo' : failed.map((f) => f.label).join('; ')}
        className={
          canOpen
            ? 'bg-sky-600 hover:bg-sky-700 text-white'
            : 'bg-slate-100 text-slate-400 hover:bg-slate-100 cursor-not-allowed'
        }
      >
        <Rocket className="w-3.5 h-3.5 mr-1" />
        Abrir vaga
      </Button>

      {failed.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Falta para abrir a vaga:
          </p>
          <ul className="space-y-0.5">
            {failed.map((p) => (
              <li key={p.id} className="text-[11px] text-amber-800 flex items-center gap-1">
                <X className="w-3 h-3 text-amber-600 shrink-0" />
                <span>{p.label}</span>
                {p.resolveLink && p.resolveLabel && (
                  <Link
                    to={p.resolveLink}
                    className="underline font-medium text-sky-700 hover:text-sky-900 ml-1 whitespace-nowrap"
                  >
                    {p.resolveLabel}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canOpen && (
        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">
          <Check className="w-3 h-3 mr-0.5" /> Pré-condições OK
        </Badge>
      )}
    </div>
  )
}

export default OpenJobButton
