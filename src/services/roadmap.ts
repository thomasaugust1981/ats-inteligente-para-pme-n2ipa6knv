import pb from '@/lib/pocketbase/client'
import { SESSION_EXPIRED_MESSAGE, withFreshToken } from '@/lib/pocketbase/freshToken'

export interface RoadmapItem {
  id: string
  org_id: string
  title: string
  description?: string
  done: boolean
  created_by?: string
  created: string
  updated: string
}

const SORT = '-created'

/**
 * Escritas do roadmap. Diferente do withFreshToken genérico, aqui o PocketBase
 * responde 400 "Failed to create record." quando a regra de create nega — e o
 * token stale faz exatamente isso (o authStore parece válido localmente, mas o
 * servidor não resolve @request.auth). Por isso: em 400/401/403/404 renova a
 * sessão (authRefresh) e repete a escrita UMA vez. Se continuar falhando, o erro
 * sobe para o card, que mostra toast.
 */
async function writeWithSessionRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const e = err as { status?: number; response?: { status?: number } } | null
    const status = e?.status ?? e?.response?.status ?? 0
    if (status !== 400 && status !== 401 && status !== 403 && status !== 404) throw err
    console.error('[roadmap] escrita recusada com', status, '— renovando sessão e tentando de novo')
    try {
      await pb.collection('users').authRefresh()
    } catch {
      pb.authStore.clear()
      throw new Error(SESSION_EXPIRED_MESSAGE)
    }
    return fn()
  }
}

/**
 * O org_id usado nas escritas/leituras vem da sessão RENOVADA (não do estado
 * do React, que pode ter sido capturado antes). A regra de create (0041) exige
 * body.org_id = @request.auth.org_id: se o cliente mandar uma org defasada, o
 * PocketBase nega com 400 "Failed to create record." em toda tentativa.
 */
async function freshOrgId(fallback: string): Promise<string> {
  try {
    await pb.collection('users').authRefresh()
  } catch {
    // mantém a sessão local; a escrita falha de forma visível se o token não servir
  }
  return String(pb.authStore.record?.org_id || fallback || '')
}

export function sortRoadmapItems(items: RoadmapItem[]): RoadmapItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return a.created < b.created ? 1 : a.created > b.created ? -1 : 0
  })
}

export const roadmapService = {
  sort: sortRoadmapItems,

  async list(orgId: string): Promise<RoadmapItem[]> {
    return withFreshToken(async () => {
      const org = await freshOrgId(orgId)
      const records = await pb.collection('roadmap_items').getFullList({
        filter: `org_id = "${org}"`,
        sort: SORT,
      })
      return records as unknown as RoadmapItem[]
    })
  },

  async create(payload: {
    org_id: string
    title: string
    description?: string
    created_by?: string
  }): Promise<RoadmapItem> {
    return withFreshToken(() =>
      writeWithSessionRetry(async () => {
        const org = await freshOrgId(payload.org_id)
        if (!org) throw new Error('Sua organização não foi identificada. Faça login novamente.')
        const record = await pb.collection('roadmap_items').create({ ...payload, org_id: org })
        return record as unknown as RoadmapItem
      }),
    )
  },

  async setDone(id: string, done: boolean): Promise<RoadmapItem> {
    return withFreshToken(() =>
      writeWithSessionRetry(async () => {
        const record = await pb.collection('roadmap_items').update(id, { done })
        return record as unknown as RoadmapItem
      }),
    )
  },

  async remove(id: string): Promise<void> {
    await withFreshToken(() =>
      writeWithSessionRetry(async () => {
        await pb.collection('roadmap_items').delete(id)
      }),
    )
  },
}
