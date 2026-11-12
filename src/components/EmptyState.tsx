import React from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface EmptyStateAction {
  label: string
  to?: string
  onClick?: () => void
  icon?: LucideIcon
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actions?: EmptyStateAction[]
}

/**
 * Estado vazio reutilizável: orienta o usuário e oferece uma ação clara
 * (ex.: criar vaga, limpar filtros). Usado nas listas do painel.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actions,
}) => {
  return (
    <div className="text-center py-14 px-6 bg-white rounded-xl border flex flex-col items-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-5">{description}</p>
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {actions.map((a, i) =>
            a.to ? (
              <Link key={i} to={a.to}>
                <Button size="sm">
                  {a.icon && <a.icon className="w-4 h-4 mr-1.5" />}
                  {a.label}
                </Button>
              </Link>
            ) : (
              <Button key={i} size="sm" variant="outline" onClick={a.onClick}>
                {a.icon && <a.icon className="w-4 h-4 mr-1.5" />}
                {a.label}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
