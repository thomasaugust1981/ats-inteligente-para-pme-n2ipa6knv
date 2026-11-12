import React from 'react'
import { CheckCircle2, Circle } from 'lucide-react'

export interface ProgressStep {
  key: string
  label: string
}

interface ApplicationProgressProps {
  steps: ProgressStep[]
  current: number
  errorSteps?: number[]
}

/**
 * Indicador de progresso por etapas do formulário de candidatura.
 * Mostra onde o candidato está e o que falta concluir.
 */
export const ApplicationProgress: React.FC<ApplicationProgressProps> = ({
  steps,
  current,
  errorSteps = [],
}) => {
  return (
    <ol className="flex items-center gap-1.5 w-full">
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        const hasError = errorSteps.includes(i)
        return (
          <li key={step.key} className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {/* Círculo de estado da etapa */}
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Circle
                  className={`w-4 h-4 shrink-0 ${
                    hasError ? 'text-rose-500' : active ? 'text-sky-600' : 'text-slate-300'
                  }`}
                  fill={active ? '#0284c7' : hasError ? '#fecdd3' : 'none'}
                />
              )}
              <span
                className={`text-[10px] sm:text-[11px] truncate ${
                  done
                    ? 'text-emerald-700 font-medium'
                    : hasError
                      ? 'text-rose-600 font-semibold'
                      : active
                        ? 'text-sky-700 font-semibold'
                        : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {/* Barra de conexão com a próxima etapa */}
            {i < steps.length - 1 && (
              <div className="h-0.5 mt-1 rounded-full w-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${i < current ? 'bg-emerald-500' : 'bg-transparent'}`}
                  style={{ width: i < current ? '100%' : '0%' }}
                />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
