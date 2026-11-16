import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { superadminService } from '@/services/superadmin'
import { AlertTriangle } from 'lucide-react'

/**
 * Banner global de segurança: aparece em qualquer tela do app quando o
 * usuário logado é o seed superadmin@ats.local e a senha ainda é a padrão
 * da migração 0018 (SUPERADMIN_DEFAULT_PASSWORD em services/superadmin.ts).
 * A troca em si é feita no painel /superadmin ("Alterar minha senha").
 */
export const SuperadminPasswordBanner: React.FC = () => {
  const { user } = useAuth()
  const [usingDefault, setUsingDefault] = useState(false)

  useEffect(() => {
    if (!superadminService.isSuperadminSeed(user)) return
    let cancelled = false
    superadminService.isUsingDefaultPassword().then((v) => {
      if (!cancelled) setUsingDefault(v)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  if (!usingDefault) return null

  return (
    <div className="mx-3 mt-3 md:mx-8 md:mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
      <p className="text-sm text-amber-900">
        <span className="font-semibold">Segurança: </span>
        você ainda usa a senha padrão do superadmin — troque-a no{' '}
        <a href="/superadmin" className="underline font-medium hover:text-amber-700">
          painel Superadmin
        </a>
        .
      </p>
    </div>
  )
}

export default SuperadminPasswordBanner
