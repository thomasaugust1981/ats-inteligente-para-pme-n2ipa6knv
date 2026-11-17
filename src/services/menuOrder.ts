// Ordem do menu lateral POR USUÁRIO (menu_order JSON no próprio usuário —
// migração 0035). Persistência otimista: a UI reordena na hora e salva em
// segundo plano; se falhar, o aviso aparece discreto e a ordem revertida na
// próxima navegação (recarregamento).
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { NavId } from '@/lib/navModel'

/** Ordem salva do menu (lista de ids de rota). null = nunca personalizou. */
export type SavedMenuOrder = NavId[] | null

/** Lê a preferência salva do usuário logado. Falha = volta para null (padrão). */
export async function loadMenuOrder(): Promise<SavedMenuOrder> {
  try {
    const rec = await pb.collection('users').getOne(pb.authStore.record?.id || '')
    const raw = (rec as unknown as { menu_order?: unknown }).menu_order
    if (!Array.isArray(raw)) return null
    return raw.filter((x): x is NavId => typeof x === 'string') as NavId[]
  } catch (_) {
    return null
  }
}

/** Salva a nova ordem para o usuário logado. Idempotente (campo único JSON). */
export async function saveMenuOrder(order: NavId[]): Promise<void> {
  const id = pb.authStore.record?.id || ''
  if (!id) throw new Error('Usuário não autenticado.')
  await pb.collection('users').update(id, { menu_order: order })
}

/** Restaura (apaga) a preferência — volta ao DEFAULT_NAV_IDS. */
export async function resetMenuOrder(): Promise<void> {
  const id = pb.authStore.record?.id || ''
  if (!id) throw new Error('Usuário não autenticado.')
  await pb.collection('users').update(id, { menu_order: null })
}

/**
 * Módulo Indicadores é licenciado à parte — o status resolve a visibilidade do
 * item no menu. Erro = tratado como não licenciado (o item some, sem quebrar).
 */
export async function fetchIndicatorsLicensed(): Promise<boolean> {
  try {
    const res = await fetch(`${pb.buildUrl('')}/backend/v1/indicators/status`, {
      headers: { Authorization: pb.authStore.token },
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
