// Estado global da configuração do agente de score de IA, compartilhado por
// badge (pipeline), painel (perfil) e página de configuração. Lê uma única vez
// do banco (ai_agent_settings) e permite atualizar localmente após salvar.

import { useEffect, useState, useCallback, useContext, createContext, type ReactNode } from 'react'
import {
  getAgentSettings,
  DEFAULT_AGENT_SETTINGS,
  type AiAgentSettings,
} from '@/services/aiAgentSettings'
import pb from '@/lib/pocketbase/client'

interface AiAgentSettingsContextType {
  settings: AiAgentSettings
  loading: boolean
  refresh: () => Promise<void>
  applyLocal: (s: AiAgentSettings) => void
}

const AiAgentSettingsContext = createContext<AiAgentSettingsContextType | undefined>(undefined)

export function AiAgentSettingsProvider({ children }: { children: ReactNode }) {
  // Config POR ORGANIZAÇÃO (0029): recarrega quando a org do usuário muda.
  const orgId = String((pb.authStore.record as Record<string, unknown> | null)?.org_id || '')
  const [settings, setSettings] = useState<AiAgentSettings>({
    ...DEFAULT_AGENT_SETTINGS,
    id: '',
    org_id: orgId,
    updated: '',
  })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const s = await getAgentSettings()
    setSettings(s)
    setLoading(false)
  }, [])

  const applyLocal = useCallback((s: AiAgentSettings) => setSettings(s), [])

  useEffect(() => {
    refresh()
  }, [refresh, orgId])

  return (
    <AiAgentSettingsContext.Provider value={{ settings, loading, refresh, applyLocal }}>
      {children}
    </AiAgentSettingsContext.Provider>
  )
}

export function useAiAgentSettings() {
  const ctx = useContext(AiAgentSettingsContext)
  if (!ctx) throw new Error('useAiAgentSettings deve ser usado dentro de AiAgentSettingsProvider')
  return ctx
}
