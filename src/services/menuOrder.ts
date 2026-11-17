// Ordem do menu lateral POR USUÁRIO (users.menu_order — migração 0035).
// Leitura/gravação pela rota dedicada /backend/v1/menu-order
// (pocketbase/hooks/menu_order_server.js): o servidor grava no registro do
// PRÓPRIO usuário autenticado — sem PATCH /api/collections/users/records/{id},
// que em produção voltava 404 (PocketBase responde 404 quando a regra esconde
// o registro ou o token do authStore está stale). Persistência otimista: a UI
// reordena na hora e salva em segundo plano; se falhar, o aviso aparece
// discreto e a ordem revertida na próxima navegação (recarregamento).
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { NavId } from '@/lib/navModel'

/** Ordem salva do menu (lista de ids de rota). null = nunca personalizou. */
export type SavedMenuOrder = NavId[] | null

const MENU_ORDER_ROUTE = '/backend/v1/menu-order'

/** Token atual do authStore (header Authorization das rotas do hook). */
function authHeader(): Record<string, string> {
  return { Authorization: pb.authStore.token }
}

/**
 * Renova o token do authStore uma vez (404 de regra em PATCH/GET de record
 * costuma ser token stale) e devolve true se renovou.
 */
async function refreshAuthOnce(): Promise<boolean> {
  try {
    await pb.collection('users').authRefresh()
    return true
  } catch (_) {
    return false
  }
}

/** Lê a preferência salva do usuário logado. Falha = volta para null (padrão). */
export async function loadMenuOrder(): Promise<SavedMenuOrder> {
  if (!pb.authStore.record?.id) return null
  const read = async (): Promise<SavedMenuOrder> => {
    const res = await fetch(pb.buildUrl(MENU_ORDER_ROUTE), { headers: authHeader() })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { menu_order?: unknown }
    if (!Array.isArray(data.menu_order)) return null
    return data.menu_order.filter((x): x is NavId => typeof x === 'string')
  }
  try {
    return await read()
  } catch (_) {
    // token stale → renova e tenta mais uma vez
    if (await refreshAuthOnce()) {
      try {
        return await read()
      } catch (_) {
        return null
      }
    }
    return null
  }
}

/** Salva a nova ordem para o usuário logado. Idempotente (campo único JSON). */
export async function saveMenuOrder(order: NavId[]): Promise<void> {
  if (!pb.authStore.record?.id) throw new Error('Usuário não autenticado.')
  const send = async (): Promise<void> => {
    const res = await fetch(pb.buildUrl(MENU_ORDER_ROUTE), {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu_order: order }),
    })
    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const data = (await res.json()) as { error?: string }
        if (data?.error) message = data.error
      } catch (_) {
        /* corpo não-JSON: mantém o HTTP status */
      }
      throw new Error(message)
    }
  }
  try {
    await send()
  } catch (err) {
    // token stale → renova e tenta mais uma vez antes de desistir
    if (await refreshAuthOnce()) await send()
    else throw err
  }
}

/** Restaura (apaga) a preferência — volta ao DEFAULT_NAV_IDS. */
export async function resetMenuOrder(): Promise<void> {
  await saveMenuOrder([])
}

/**
 * Módulo Indicadores é licenciado à parte — o status resolve a visibilidade do
 * item no menu. Erro = tratado como não licenciado (o item some, sem quebrar).
 */
export async function fetchIndicatorsLicensed(): Promise<boolean> {
  try {
    const res = await fetch(`${pb.buildUrl('')}/backend/v1/indicators/status`, {
      headers: authHeader(),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { licensed?: boolean }
    return data.licensed === true
  } catch (_) {
    return false
  }
}

export function menuOrderErrorMessage(err: unknown): string {
  return getErrorMessage(err)
}
