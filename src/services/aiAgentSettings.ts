// Serviço de configuração do agente de score de IA (coleção ai_agent_settings).
// Registro global único; leitura para qualquer usuário autenticado, escrita
// apenas administrador (regras da coleção, migração 0013).

import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export interface AiAgentSettings {
  id: string
  enabled: boolean
  weight_technical: number
  weight_behavioral: number
  weight_cultural: number
  trigger_new_application: boolean
  trigger_stage_change: boolean
  trigger_disc_completed: boolean
  trigger_note_added: boolean
  updated: string
}

export const DEFAULT_AGENT_SETTINGS: Omit<AiAgentSettings, 'id' | 'updated'> = {
  enabled: true,
  weight_technical: 50,
  weight_behavioral: 30,
  weight_cultural: 20,
  trigger_new_application: true,
  trigger_stage_change: true,
  trigger_disc_completed: true,
  trigger_note_added: true,
}

/** Lê a configuração global do agente (um único registro). Falha → defaults. */
export async function getAgentSettings(): Promise<AiAgentSettings> {
  try {
    const record = await pb.collection('ai_agent_settings').getList<AiAgentSettings>(1, 1)
    if (record.items.length > 0) return record.items[0]
  } catch (err) {
    console.error('[aiAgentSettings] falha ao ler configuração:', getErrorMessage(err))
  }
  return { ...DEFAULT_AGENT_SETTINGS, id: '', updated: '' }
}

/** Salva a configuração (apenas administrador — regra server-side). */
export async function saveAgentSettings(
  settings: Omit<AiAgentSettings, 'id' | 'updated'> & { id?: string },
): Promise<AiAgentSettings> {
  const body = {
    enabled: settings.enabled,
    weight_technical: settings.weight_technical,
    weight_behavioral: settings.weight_behavioral,
    weight_cultural: settings.weight_cultural,
    trigger_new_application: settings.trigger_new_application,
    trigger_stage_change: settings.trigger_stage_change,
    trigger_disc_completed: settings.trigger_disc_completed,
    trigger_note_added: settings.trigger_note_added,
  }
  if (settings.id) {
    return (await pb.collection('ai_agent_settings').update(settings.id, body)) as AiAgentSettings
  }
  return (await pb.collection('ai_agent_settings').create(body)) as AiAgentSettings
}
