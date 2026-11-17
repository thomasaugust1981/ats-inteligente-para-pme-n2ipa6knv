// Modelo canônico de navegação do menu lateral (sidebar).
// Cada item tem uma rota, ícone e PREDICADO DE VISIBILIDADE — o mesmo critério
// que o Layout já usa hoje (papéis, licença do módulo Indicadores).
import {
  LayoutDashboard,
  Briefcase,
  Columns3,
  Users,
  Boxes,
  Building2,
  BarChart3,
  Network,
  Plug,
  Bot,
  ShieldCheck,
  Rocket,
  type LucideIcon,
} from 'lucide-react'

export type NavId =
  | 'dashboard'
  | 'vagas'
  | 'pipeline'
  | 'candidatos'
  | 'cargos'
  | 'estrutura'
  | 'indicadores'
  | 'organograma'
  | 'integracoes'
  | 'agente-score'
  | 'superadmin'
  | 'onboarding'

export interface NavItem {
  id: NavId
  label: string
  path: string
  icon: LucideIcon
  /** Predicado de visibilidade (mesmo critério de permissão usado hoje). */
  visible: (ctx: NavVisibilityContext) => boolean
  /** Estilo do link quando ativo/inativo (superadmin usa violeta). */
  tone?: 'default' | 'superadmin'
}

export interface NavVisibilityContext {
  isAdmin: boolean
  isRecruiter: boolean
  isManager: boolean
  isSuperadmin: boolean
  agentEnabled: boolean
  /** Módulo Indicadores licenciado para a org (resolvido via rota do hook). */
  indicatorsLicensed?: boolean
}

/**
 * ORDEM PADRÃO — a mesma do Layout antes da reordenação existir.
 * Qualquer usuário restaura para esta lista com "Restaurar ordem padrão".
 */
export const DEFAULT_NAV_IDS: NavId[] = [
  'onboarding',
  'dashboard',
  'vagas',
  'pipeline',
  'candidatos',
  'cargos',
  'estrutura',
  'indicadores',
  'organograma',
  'integracoes',
  'superadmin',
  'agente-score',
]

const isActive = (path: string, pathname: string) =>
  pathname === path || (path !== '/' && pathname.startsWith(path))

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'onboarding',
    label: 'Onboarding da Empresa',
    path: '/onboarding',
    icon: Rocket,
    visible: (c) => c.isAdmin,
  },
  {
    id: 'dashboard',
    label: 'Painel Geral',
    path: '/',
    icon: LayoutDashboard,
    visible: () => true,
  },
  { id: 'vagas', label: 'Vagas', path: '/vagas', icon: Briefcase, visible: () => true },
  { id: 'pipeline', label: 'Pipeline', path: '/pipeline', icon: Columns3, visible: () => true },
  {
    id: 'candidatos',
    label: 'Banco de Candidatos',
    path: '/candidatos',
    icon: Users,
    visible: () => true,
  },
  {
    id: 'cargos',
    label: 'Cargos',
    path: '/cargos',
    icon: Boxes,
    // Admin/RH editam; recrutador/gestor têm leitura — todos veem.
    visible: () => true,
  },
  {
    id: 'estrutura',
    label: 'Estrutura',
    path: '/estrutura',
    icon: Building2,
    visible: () => true,
  },
  {
    id: 'indicadores',
    label: 'Indicadores',
    path: '/indicadores',
    icon: BarChart3,
    // Módulo licenciado à parte — o status é resolvido pelo chamador
    // (fetchIndicatorsLicensed) e chega aqui via ctx.indicatorsLicensed.
    visible: (c) => c.indicatorsLicensed === true,
  },
  {
    id: 'organograma',
    label: 'Organograma',
    path: '/organograma',
    icon: Network,
    visible: (c) => c.isAdmin || c.isRecruiter,
  },
  {
    id: 'integracoes',
    label: 'Integrações',
    path: '/integracoes',
    icon: Plug,
    visible: (c) => c.isAdmin,
  },
  {
    id: 'agente-score',
    label: 'Agente de Score',
    path: '/agente-score',
    icon: Bot,
    visible: () => true,
  },
  {
    id: 'superadmin',
    label: 'Superadmin',
    path: '/superadmin',
    icon: ShieldCheck,
    visible: (c) => c.isSuperadmin,
    tone: 'superadmin',
  },
]

/** Ordem padrão (ids) — os que o contexto NÃO pode ver são filtrados fora. */
export const defaultNavIdsFor = (ctx: NavVisibilityContext): NavId[] =>
  DEFAULT_NAV_IDS.filter((id) => {
    const item = NAV_ITEMS.find((n) => n.id === id)
    return item ? item.visible(ctx) : false
  })

/**
 * Aplica a preferência salva do usuário sobre a ordem padrão.
 * - Ids salvos que não existem mais ou que o usuário não pode ver → ignorados.
 * - Ids padrão que faltam na preferência → acrescentados no fim, na ordem padrão.
 */
export function applySavedOrder(saved: unknown, ctx: NavVisibilityContext): NavId[] {
  const all = defaultNavIdsFor(ctx)
  const allowed = new Set<string>(all)
  if (!Array.isArray(saved)) return all
  const ordered: NavId[] = []
  for (const raw of saved) {
    if (typeof raw === 'string' && allowed.has(raw)) {
      ordered.push(raw as NavId)
      allowed.delete(raw)
    }
  }
  // Itens permitidos mas ausentes da preferência (novos itens, preferência parcial)
  for (const id of all) {
    if (allowed.has(id)) ordered.push(id)
  }
  return ordered
}

/** Helper de rota ativa (mesma regra do Layout). */
export const navIsActive = isActive
