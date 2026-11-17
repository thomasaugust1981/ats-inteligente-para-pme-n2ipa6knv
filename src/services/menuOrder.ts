// Ordem do menu lateral POR USUÁRIO (menu_order JSON no próprio usuário —
// migração 0035). Persistência otimista: a UI reordena na hora e salva em
// segundo plano; se falhar, o aviso aparece discreto e a ordem revertida na
// próxima navegação (recarregamento).
//
// Gravação e leitura passam pelas rotas dedicadas do hook
// pocketbase/hooks/menu_order_server.js (GET/POST /backend/v1/menu-order), que
// escrevem no registro do PRÓPRIO usuário autenticado — evita o 404 de
// PocketBase do PATCH direto em /api/collections/users/records/{id} (regra de
// update do users negando aparece como 404, e token expirado no authStore idem).
import pb from '@/lib/pocketbase/client'
import type { NavId } from '@/lib/navModel'

/** Ordem salva do menu (lista de ids de rota). null = nunca personalizou. */
export type SavedMenuOrder = NavId[] | null

const isNavId = (v: unknown): v is NavId => typeof v === 'string' && v.length > 0 && v.length <= 64

/** Token expirado/stale → renova o authStore (authRefresh) e revalida. */
async function withFreshToken<T>(fn: () => Promise<T>): Promise<T> {
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

/** Lê a preferência salva do usuário logado. Falha = volta para null (padrão). */
export async function loadMenuOrder(): Promise<SavedMenuOrder> {
  try {
    const res = await withFreshToken(() => pb.send('/backend/v1/menu-order', {}))
    const raw = (res as { menu_order?: unknown } | undefined)?.menu_order
    if (!Array.isArray(raw)) return null
    return raw.filter(isNavId) as NavId[]
  } catch (_) {
    return null
  }
}

/** Salva a nova ordem para o usuário logado. Idempotente (campo único JSON). */
export async function saveMenuOrder(order: NavId[]): Promise<void> {
  if (!pb.authStore.isValid || !pb.authStore.record?.id) {
    throw new Error('Usuário não autenticado.')
  }
  await withFreshToken(() =>
    pb.send('/backend/v1/menu-order', {
      method: 'POST',
      body: { menu_order: order },
    }),
  )
}

/** Restaura (apaga) a preferência — volta ao DEFAULT_NAV_IDS. */
export async function resetMenuOrder(): Promise<void> {
  if (!pb.authStore.isValid || !pb.authStore.record?.id) {
    throw new Error('Usuário não autenticado.')
  }
  await withFreshToken(() =>
    pb.send('/backend/v1/menu-order', {
      method: 'POST',
      body: { menu_order: null },
    }),
  )
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
  const status =
    (err as { status?: number })?.status ??
    (err as { response?: { status?: number } })?.response?.status
  const label =
    status === 401
      ? 'Sessão expirada — faça login novamente.'
      : status === 404
        ? 'Serviço de ordem do menu indisponível (rota não encontrada).'
        : status === 500
          ? 'Erro do servidor ao gravar a ordem.'
          : undefined
  return label || (err instanceof Error ? err.message : String(err))
}
