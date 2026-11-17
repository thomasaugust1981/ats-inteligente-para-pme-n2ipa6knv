import React from 'react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Cartão padrão de seção de indicador: título, subtítulo explicativo e conteúdo. */
export const SectionCard: React.FC<{
  title: string
  subtitle: string
  icon?: ReactNode
  children: ReactNode
}> = ({ title, subtitle, icon, children }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
        {icon && <span className="text-sky-600">{icon}</span>}
        {title}
      </CardTitle>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)

/** Item de uma lista com barra proporcional (distribuição, buckets, quebras). */
export interface BarItem {
  label: string
  /** Valor absoluto (exibido à direita). */
  value: number
  /** Percentual que define a largura da barra (0–100); null = barra pelo valor relativo ao maior. */
  pct: number | null
  /** Sufixo do valor (ex.: 'd' para dias, '%' para taxa). */
  suffix?: string
  /** Texto de apoio (ex.: contagem de contratações). */
  hint?: string
}

export const DistributionBarList: React.FC<{ title?: string; items: BarItem[] }> = ({
  title,
  items,
}) => {
  const maxVal = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="space-y-2">
      {title && (
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{title}</p>
      )}
      {items.length === 0 && <p className="text-xs text-slate-400">sem dados</p>}
      {items.map((item) => {
        const width =
          item.pct !== null ? Math.min(100, item.pct) : maxVal > 0 ? (item.value / maxVal) * 100 : 0
        return (
          <div key={item.label} className="flex items-center gap-3">
            <div className="w-40 text-xs text-slate-600 shrink-0 truncate" title={item.label}>
              {item.label}
            </div>
            <div className="flex-1 h-5 bg-slate-100 rounded relative overflow-hidden">
              <div
                className="h-full rounded bg-sky-500 transition-all"
                style={{ width: `${Math.max(width, item.value > 0 ? 2 : 0)}%` }}
              />
            </div>
            <div className="w-28 text-right text-xs shrink-0">
              <span className="font-medium text-slate-800">
                {item.value.toLocaleString('pt-BR')}
                {item.suffix || ''}
              </span>
              {item.pct !== null && (
                <span className="text-slate-400"> · {item.pct.toLocaleString('pt-BR')}%</span>
              )}
              {item.hint && <span className="block text-slate-400">{item.hint}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Atalhos de período (30/60/90 dias + datas custom). */
export const PeriodShortcuts: React.FC<{
  presets: number[]
  value: number | null
  onSelect: (d: number) => void
  getLabel: (d: number) => string
}> = ({ presets, value, onSelect, getLabel }) => (
  <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
    {presets.map((d) => (
      <button
        key={d}
        type="button"
        onClick={() => onSelect(d)}
        className={cn(
          'px-3 py-1.5 text-xs font-medium transition-colors',
          value === d ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
        )}
      >
        {getLabel(d)}
      </button>
    ))}
    <span
      className={cn(
        'px-3 py-1.5 text-xs font-medium',
        value === null ? 'bg-sky-600 text-white' : 'bg-white text-slate-400',
      )}
    >
      Personalizado
    </span>
  </div>
)

/** Cor da barra de alerta (queda brusca no funil). */
export function getAlertColor(): string {
  return 'bg-amber-500'
}
