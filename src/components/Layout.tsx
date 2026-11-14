import React from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  Briefcase,
  Users,
  LayoutDashboard,
  Columns3,
  LogOut,
  ExternalLink,
  Building2,
  ShieldCheck,
  Menu,
  X,
  UserCheck,
  Rocket,
  Network,
  Bot,
} from 'lucide-react'
import { useAiAgentSettings } from '@/hooks/use-ai-agent-settings'
import { onboardingService } from '@/services/onboarding'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'

const Layout: React.FC = () => {
  const { user, role, signOut, isManager, isAdmin, isRecruiter } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Agente de Score de IA: item dedicado, visível a todos os papéis autenticados
  const { settings: agentSettings } = useAiAgentSettings()

  // Rotas públicas que não usam o sidebar administrativo
  const isPublicRoute =
    location.pathname.startsWith('/carreiras') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/verificar-email') ||
    location.pathname.startsWith('/redefinir-senha')

  React.useEffect(() => {
    if (!isPublicRoute && !user) {
      navigate('/login')
    }
  }, [isPublicRoute, user, navigate])

  if (isPublicRoute) {
    return <Outlet />
  }

  if (!user) {
    return null
  }
  const handleLogout = () => {
    signOut()
    navigate('/login')
  }

  const navItems = [
    { label: 'Painel Geral', path: '/', icon: LayoutDashboard },
    { label: 'Vagas', path: '/vagas', icon: Briefcase },
    { label: 'Pipeline', path: '/pipeline', icon: Columns3 },
    { label: 'Banco de Candidatos', path: '/candidatos', icon: Users },
  ]

  // Organograma: módulo standalone para admin e recrutador
  const showOrganograma = isAdmin || isRecruiter

  // Administradores podem retomar o onboarding pelo painel
  const showOnboardingLink = isAdmin

  const getRoleLabel = () => {
    if (isAdmin) return 'Administrador'
    if (isManager) return 'Gestor Solicitante'
    return 'Recrutador'
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            AT
          </div>
          <div className="overflow-hidden">
            <h2 className="font-bold text-sm tracking-tight text-white truncate">
              ATS Inteligente PME
            </h2>
            <p className="text-[11px] text-slate-400 truncate">
              {user.company_name || 'Vanguard Soluções'}
            </p>
          </div>
        </div>

        {/* Info do usuário logado */}
        <div className="p-4 mx-3 my-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sky-600/30 text-sky-400 flex items-center justify-center text-xs font-bold border border-sky-500/40">
            {user.name ? user.name.substring(0, 2).toUpperCase() : 'US'}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-semibold text-white truncate">{user.name || user.email}</p>
            <span className="text-[10px] text-sky-400 font-medium block">{getRoleLabel()}</span>
          </div>
        </div>

        {/* Links de navegação */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {showOnboardingLink && (
            <Link
              to="/onboarding"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                location.pathname === '/onboarding'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-amber-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Rocket className="w-4 h-4" />
              <span>Onboarding da Empresa</span>
            </Link>
          )}
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
          {showOrganograma && (
            <Link
              to="/organograma"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                location.pathname.startsWith('/organograma')
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Network className="w-4 h-4" />
              <span>Organograma</span>
            </Link>
          )}
          <Link
            to="/agente-score"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
              location.pathname.startsWith('/agente-score')
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Agente de Score</span>
            <span
              className={`ml-auto w-2 h-2 rounded-full ${
                agentSettings.enabled ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
              title={agentSettings.enabled ? 'Agente ativado' : 'Agente desativado'}
            />
          </Link>
        </nav>

        {/* Atalhos inferiores: Página de Carreiras & Logout */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          <Link
            to="/carreiras"
            target="_blank"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              Página de Carreiras
            </span>
            <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">
              Pública
            </Badge>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 h-9"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair do Sistema
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold text-sm">
            AT
          </div>
          <span className="font-bold text-sm">ATS PME</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-slate-300 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Menu Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 text-white p-4 border-b border-slate-800 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-300 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          {showOrganograma && (
            <Link
              to="/organograma"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-300 hover:text-white"
            >
              Organograma
            </Link>
          )}
          <Link
            to="/agente-score"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-slate-300 hover:text-white flex items-center gap-2"
          >
            <Bot className="w-4 h-4" />
            Agente de Score
            <span
              className={`ml-auto w-2 h-2 rounded-full ${
                agentSettings.enabled ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
          </Link>
          <Link
            to="/carreiras"
            target="_blank"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-sky-400"
          >
            Ver Página de Carreiras
          </Link>
          <button onClick={handleLogout} className="w-full text-left py-2 text-sm text-rose-400">
            Sair
          </button>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
