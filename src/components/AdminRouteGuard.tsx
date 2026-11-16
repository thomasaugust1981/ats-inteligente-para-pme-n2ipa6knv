import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Guarda da rota /integracoes: só passa admin da organização ou superadmin
 * (mesmo padrão visual da guarda do /superadmin).
 */
export const AdminRouteGuard: React.FC = () => {
  const { user, loading, isAdmin, isSuperadmin } = useAuth()
  const location = useLocation()

  if (loading) return null

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (!isAdmin && !isSuperadmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-rose-200">
          <CardContent className="flex flex-col items-center text-center gap-3 py-10">
            <ShieldAlert className="w-12 h-12 text-rose-500" />
            <h1 className="text-xl font-bold text-slate-900">Acesso negado</h1>
            <p className="text-sm text-slate-500">
              O painel de integrações é exclusivo de administradores. Se você acredita que deveria
              ter acesso, fale com o administrador da sua organização.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href="/">Voltar ao painel</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <Outlet />
}

export default AdminRouteGuard
