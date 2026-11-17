import pb from '@/lib/pocketbase/client'

/**
 * Token expirado/stale → renova o authStore (authRefresh) e repete a chamada.
 *
 * O PocketBase responde 404 (não 401/403) quando o TOKEN ESTÁ STALE e a regra
 * da coleção esconde o registro (comportamento observado em PATCH de
 * companies/{id} e users/{id}: "The requested resource wasn't found"). Este
 * helper é o padrão do fix do menu (v0.0.84) generalizado para qualquer
 * escrita/leitura crítica via API padrão do SDK.
 */
export async function withFreshToken<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const status =
      (err as { status?: number; response?: { status?: number } })?.status ??
      (err as { response?: { status?: number } })?.response?.status
    if (status !== 0 && status !== 400 && status !== 401 && status !== 403 && status !== 404) {
      throw err
    }
    if (!pb.authStore.isValid || !pb.authStore.record?.id) throw err
    try {
      await pb.collection('users').authRefresh()
    } catch (_) {
      throw err
    }
    return fn()
  }
}
