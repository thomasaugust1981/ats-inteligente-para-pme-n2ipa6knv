// Seletor de empresa ativa no topo do ATS (multi-empresa: matriz/filiais).
// Com 2+ empresas é um dropdown; com apenas 1, um indicador estático.
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, ChevronDown, Check, Loader2, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useActiveCompany } from '@/hooks/use-active-company'
import type { CompanyNode } from '@/services/companies'
import { cn } from '@/lib/utils'

const typeLabel = (c: CompanyNode) => (c.company_type === 'filial' ? 'Filial' : 'Matriz')

const CompanySelector: React.FC = () => {
  const { companies, activeCompany, loading, setActiveCompany } = useActiveCompany()
  const navigate = useNavigate()

  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 px-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Empresas...
      </div>
    )
  }

  if (companies.length === 0) {
    return null
  }

  // Empresa única: indicador estático (sem dropdown)
  if (companies.length === 1) {
    const only = companies[0]
    return (
      <Link
        to="/empresas"
        title="Gerenciar empresas"
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition text-xs"
      >
        <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span className="text-slate-200 font-medium truncate max-w-[140px]">{only.name}</span>
        <Badge variant="outline" className="text-[9px] border-slate-600 text-slate-400 shrink-0">
          {typeLabel(only)}
        </Badge>
      </Link>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition text-xs max-w-[260px]"
        >
          <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="text-slate-200 font-medium truncate">
            {activeCompany?.name || 'Selecione a empresa'}
          </span>
          {activeCompany && (
            <Badge
              variant="outline"
              className="text-[9px] border-slate-600 text-slate-400 shrink-0"
            >
              {typeLabel(activeCompany)}
            </Badge>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[11px] text-slate-500">
          Empresa ativa (filtra as telas)
        </DropdownMenuLabel>
        {companies.map((c) => {
          const active = c.id === activeCompany?.id
          return (
            <DropdownMenuItem
              key={c.id}
              onClick={() => setActiveCompany(c.id)}
              className="gap-2 text-xs cursor-pointer"
            >
              <Check
                className={cn('w-3.5 h-3.5 shrink-0', active ? 'text-sky-500' : 'invisible')}
              />
              <span className="truncate flex-1">{c.name}</span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] shrink-0',
                  c.company_type === 'filial'
                    ? 'border-slate-300 text-slate-500'
                    : 'border-sky-300 text-sky-600',
                )}
              >
                {typeLabel(c)}
              </Badge>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/empresas')}
          className="gap-2 text-xs cursor-pointer text-sky-600"
        >
          <Plus className="w-3.5 h-3.5" />
          Gerenciar empresas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default CompanySelector
