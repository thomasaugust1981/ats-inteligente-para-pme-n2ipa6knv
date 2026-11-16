// Contexto de empresa ativa (multi-empresa): a empresa selecionada no seletor
// do topo filtra as telas do ATS (vagas, pipeline, candidatos, dashboard).
// Persistido por usuário no localStorage — a troca sobrevive a reload/logout.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { companiesService, type CompanyNode } from '@/services/companies'
import type { User } from '@/types/ats'

interface ActiveCompanyContextType {
  companies: CompanyNode[]
  activeCompany: CompanyNode | null
  activeCompanyId: string | null
  loading: boolean
  /** Troca a empresa ativa (persistida por usuário) — telas recarregam por key change. */
  setActiveCompany: (id: string) => void
  /** Recarrega a lista de empresas da organização (após criar/editar). */
  refreshCompanies: () => Promise<void>
  /** Versão que muda a cada troca de empresa — telas usam como dependência. */
  companyVersion: number
}

const ActiveCompanyContext = createContext<ActiveCompanyContextType | undefined>(undefined)

const storageKeyFor = (userId: string) => `active_company_${userId}`

export const ActiveCompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth()
  const [companies, setCompanies] = useState<CompanyNode[]>([])
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [companyVersion, setCompanyVersion] = useState(0)

  const orgId = String((user as (User & { org_id?: string }) | null)?.org_id || '')

  const loadCompanies = useCallback(async () => {
    if (!orgId) {
      setCompanies([])
      return
    }
    setLoading(true)
    try {
      const list = await companiesService.listMyCompanies()
      setCompanies(list)
      setActiveCompanyId((current) => {
        const stored = storedIdFor(user?.id)
        const stillExists = (id: string | null) => (id ? list.some((c) => c.id === id) : false)
        if (stillExists(current)) return current
        if (stillExists(stored)) return stored
        // Preferência inicial: a matriz; sem matriz, a primeira empresa.
        const matriz = list.find((c) => c.company_type === 'matriz')
        return (matriz || list[0])?.id || null
      })
    } catch (_) {
      setCompanies([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, user?.id])

  // Recarrega a lista quando o usuário/org muda (login, logout, troca de conta).
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setCompanies([])
      setActiveCompanyId(null)
      return
    }
    void loadCompanies()
  }, [user, authLoading, loadCompanies])

  // Persiste a escolha por usuário
  useEffect(() => {
    if (user?.id && activeCompanyId) {
      try {
        window.localStorage.setItem(storageKeyFor(user.id), activeCompanyId)
      } catch (_) {
        // localStorage indisponível — segue sem persistir
      }
    }
  }, [user?.id, activeCompanyId])

  const setActiveCompany = useCallback((id: string) => {
    setActiveCompanyId((current) => {
      if (current === id) return current
      setCompanyVersion((v) => v + 1)
      return id
    })
  }, [])

  const refreshCompanies = useCallback(async () => {
    await loadCompanies()
  }, [loadCompanies])

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || null

  return (
    <ActiveCompanyContext.Provider
      value={{
        companies,
        activeCompany,
        activeCompanyId,
        loading,
        setActiveCompany,
        refreshCompanies,
        companyVersion,
      }}
    >
      {children}
    </ActiveCompanyContext.Provider>
  )
}

function storedIdFor(userId?: string): string | null {
  if (!userId) return null
  try {
    return window.localStorage.getItem(storageKeyFor(userId))
  } catch (_) {
    return null
  }
}

export const useActiveCompany = () => {
  const context = useContext(ActiveCompanyContext)
  if (!context) {
    throw new Error('useActiveCompany deve ser usado dentro de um ActiveCompanyProvider')
  }
  return context
}

/** Filtro PocketBase da empresa ativa para listagens (retorna undefined sem empresa). */
export function useCompanyFilter(): string | undefined {
  const { activeCompanyId } = useActiveCompany()
  return activeCompanyId ? `company_id = "${activeCompanyId}"` : undefined
}
