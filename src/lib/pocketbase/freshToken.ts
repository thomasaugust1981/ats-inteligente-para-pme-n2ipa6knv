import pb from '@/lib/pocketbase/client'

/**
 * Token expirado/stale → renova o authStore (authRefresh) e repete a chamada.
 *
 * O PocketBase responde 404 (não 401/403) quando a REGRA da coleção esconde o
 * registro — e a regra esconde o registro sempre que o auth não resolve
 * (token ausente, expirado ou de outra instância). Comportamento observado no
 * PATCH de companies/{id} no onboarding: "The requested resource wasn't found"
 * mesmo com o registro existente e a org do usuário correta.
 *
 * Estratégia:
 * 1. Pré-voo — sem token válido em memória, tenta authRefresh ANTES de enviar
 *    a escrita (evita gastar a tentativa só para descobrir o 404).
 * 2. Em 401/403/404 → authRefresh + 1 retry. O refresh é deduplicado: chamadas
 *    concorrentes compartilham a mesma promessa (o PocketBase mantém tokens
 *    antigos válidos, então não há corrida de invalidação).
 * 3. Se o refresh falha, o token está morto de verdade: limpa o authStore e
 *    falha com mensagem ACIONÁVEL ("faça login novamente") em vez do 404
 *    críptico — o app então reautentica e a escrita passa.
 */
export const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Faça login novamente para continuar.'

let refreshingPromise: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  if (!refreshingPromise) {
    refreshingPromise = pb
      .collection('users')
      .authRefresh()
      .then(() => true)
      .catch(() => {
        // Token morto (expirado/inválido): limpa o store para forçar novo login
        // em vez de repetir o mesmo 404 a cada clique.
        pb.authStore.clear()
        return false
      })
      .finally(() => {
        refreshingPromise = null
      })
  }
  return refreshingPromise
}

function statusOf(err: unknown): number {
  const e = err as { status?: number; response?: { status?: number } } | null
  return e?.status ?? e?.response?.status ?? 0
}

export async function withFreshToken<T>(fn: () => Promise<T>): Promise<T> {
  // Pré-voo: auth não resolvido em memória → tenta renovar antes de enviar.
  if ((!pb.authStore.isValid || !pb.authStore.record?.id) && !(await refreshSession())) {
    throw new Error(SESSION_EXPIRED_MESSAGE)
  }

  try {
    return await fn()
  } catch (err) {
    const status = statusOf(err)
    // 400 NÃO dispara refresh: é erro de validação do payload, retry não muda nada.
    if (status !== 401 && status !== 403 && status !== 404) throw err
    console.error('[withFreshToken] escrita/leitura falhou com', status, '— renovando sessão')
    if (!(await refreshSession())) {
      throw new Error(SESSION_EXPIRED_MESSAGE)
    }
    return fn()
  }
}
