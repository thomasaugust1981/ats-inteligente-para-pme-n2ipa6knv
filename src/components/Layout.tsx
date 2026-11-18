import React from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { LogOut, ExternalLink, Menu, X } from 'lucide-react'
import { onboardingService } from '@/services/onboarding'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SuperadminPasswordBanner } from '@/components/SuperadminPasswordBanner'
import CompanySelector from '@/components/CompanySelector'
import { SidebarNav } from '@/components/SidebarNav'
import { useAiAgentSettings } from '@/hooks/use-ai-agent-settings'
import { useState, useEffect } from 'react'

const Layout: React.FC = () => {
  const { user, signOut, isManager, isAdmin, isRecruiter, isSuperadmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // Estado do Agente de Score (bolinha verde/cinza no item do menu)
  const { settings: agentSettings } = useAiAgentSettings()
  const isPublicRoute =
    location.pathname.startsWith('/carreiras') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/verificar-email') ||
    location.pathname.startsWith('/redefinir-senha')

  useEffect(() => {
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

  const getRoleLabel = () => {
    if (isSuperadmin) return 'Super Admin'
    if (isAdmin) return 'Administrador'
    if (isManager) return 'Gestor Solicitante'
    return 'Recrutador'
  }

  // Contexto de visibilidade compartilhado com o SidebarNav (mesmos critérios).
  const navCtx = {
    isAdmin,
    isRecruiter,
    isManager,
    isSuperadmin,
    agentEnabled: agentSettings.enabled,
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            T
          </div>
          <div className="overflow-hidden">
            <h2 className="font-bold text-sm tracking-tight text-white truncate">Talent</h2>
            <p className="text-[11px] text-slate-400 truncate">
              {user.company_name || 'Vanguard Soluções'}
            </p>
          </div>
        </div>

        {/* Seletor de empresa ativa (multi-empresa) */}
        <div className="px-3 mt-3">
          <CompanySelector />
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

        {/* Links de navegação — drag-and-drop, ordem por usuário */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          <SidebarNav ctx={navCtx} />
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
            T
          </div>
          <span className="font-bold text-sm">Talent</span>
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
          <SidebarNav ctx={navCtx} onNavigate={() => setMobileMenuOpen(false)} />
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
      {/* /Menu Mobile Dropdown */}

      {/* Conteúdo Principal */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <SuperadminPasswordBanner />
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
