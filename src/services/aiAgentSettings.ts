// Serviço de configuração do agente de score de IA (coleção ai_agent_settings).
// Config POR ORGANIZAÇÃO (migração 0029): cada organização tem sua própria
// config (org_id no authStore do usuário logado); regras server-side (0029)
// só deixam a org ver/editar a própria config. Provedor de IA (BYOK, 0014):
// ai_provider + modelo + chave write-only — o backend NUNCA devolve ai_api_key;
// o frontend exibe apenas ai_key_last4 + ai_key_updated_at. A gravação da chave
// e o teste de conexão passam pelas rotas admin em /backend/v1/ai-provider/*.

import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export type AiProvider = 'native' | 'openai' | 'gemini'

export interface AiAgentSettings {
  id: string
  org_id: string
  enabled: boolean
  weight_technical: number
  weight_behavioral: number
  weight_cultural: number
  trigger_new_application: boolean
  trigger_stage_change: boolean
  trigger_disc_completed: boolean
  trigger_note_added: boolean
  ai_provider: AiProvider
  ai_model: string
  ai_key_last4: string
  ai_key_updated_at: string
  updated: string
}

export const DEFAULT_AGENT_SETTINGS: Omit<AiAgentSettings, 'id' | 'org_id' | 'updated'> = {
  enabled: true,
  weight_technical: 50,
  weight_behavioral: 30,
  weight_cultural: 20,
  trigger_new_application: true,
  trigger_stage_change: true,
  trigger_disc_completed: true,
  trigger_note_added: true,
  ai_provider: 'native',
  ai_model: '',
  ai_key_last4: '',
  ai_key_updated_at: '',
}

export const PROVIDER_MODEL_PLACEHOLDER: Record<AiProvider, string> = {
  native: '—',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
}

function currentOrgId(): string {
  const me = pb.authStore.record as (Record<string, unknown> & { org_id?: string }) | null
  return String(me?.org_id || '')
}

/** Lê a configuração do agente da organização do usuário logado. Falha → defaults. */
export async function getAgentSettings(): Promise<AiAgentSettings> {
  try {
    const orgId = currentOrgId()
    const filter = pb.filter('org_id = {:oid}', { oid: orgId })
    const record = await pb
      .collection('ai_agent_settings')
      .getFirstListItem<AiAgentSettings>(filter)
    return {
      ...record,
      org_id: String((record as unknown as Record<string, unknown>).org_id || orgId),
      ai_provider: (record.ai_provider || 'native') as AiProvider,
      ai_model: record.ai_model || '',
      ai_key_last4: record.ai_key_last4 || '',
      ai_key_updated_at: record.ai_key_updated_at || '',
    }
  } catch (err) {
    // 404 esperado (org ainda sem config) — não loga como erro.
    if (!String(getErrorMessage(err)).includes('404')) {
      console.error('[aiAgentSettings] falha ao ler configuração:', getErrorMessage(err))
    }
    return { ...DEFAULT_AGENT_SETTINGS, id: '', org_id: currentOrgId(), updated: '' }
  }
}

/** Salva a configuração da organização do usuário logado (apenas admin). */
export async function saveAgentSettings(
  settings: Omit<AiAgentSettings, 'id' | 'updated'> & { id?: string },
): Promise<AiAgentSettings> {
  const orgId = String(settings.org_id || currentOrgId())
  const body = {
    org_id: orgId,
    enabled: settings.enabled,
    weight_technical: settings.weight_technical,
    weight_behavioral: settings.weight_behavioral,
    weight_cultural: settings.weight_cultural,
    trigger_new_application: settings.trigger_new_application,
    trigger_stage_change: settings.trigger_stage_change,
    trigger_disc_completed: settings.trigger_disc_completed,
    trigger_note_added: settings.trigger_note_added,
    ai_provider: settings.ai_provider || 'native',
    ai_model: settings.ai_model || '',
  }
  if (settings.id) {
    return (await pb.collection('ai_agent_settings').update(settings.id, body)) as AiAgentSettings
  }
  return (await pb.collection('ai_agent_settings').create(body)) as AiAgentSettings
}

/** Grava a chave do provedor (write-only, somente admin) — org do usuário logado. */
export async function saveProviderKey(
  provider: AiProvider,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; ai_key_last4: string; ai_key_updated_at: string }> {
  const res = await pb.send('/backend/v1/ai-provider/key', {
    method: 'POST',
    body: { provider, api_key: apiKey, model },
  })
  return {
    ok: !!res.ok,
    ai_key_last4: res.ai_key_last4 || '',
    ai_key_updated_at: res.ai_key_updated_at || '',
  }
}

/** Testa a conexão com o provedor (somente admin) — antes de salvar. */
export async function testProviderConnection(
  provider: AiProvider,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await pb.send('/backend/v1/ai-provider/test', {
    method: 'POST',
    body: { provider, api_key: apiKey, model },
  })
  return { ok: !!res.ok, message: res.message || '', error: res.error || '' }
}
