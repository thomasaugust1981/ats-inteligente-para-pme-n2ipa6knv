// Ordem do menu lateral POR USUÁRIO (menu_order JSON no próprio usuário —
// migração 0035). Persistência otimista: a UI reordena na hora e salva em
// segundo plano; se falhar, o aviso aparece discreto e a ordem revertida na
// próxima navegação (recarregamento).
//
// Leitura e gravação usam a API PADRÃO do SDK (pb.collection('users')), lendo/
// escrevendo o campo menu_order do registro do PRÓPRIO usuário autenticado.
//
// NOTA: as rotas custom GET/POST /backend/v1/menu-order (hook
// pocketbase/hooks/menu_order_server.js) e GET /backend/v1/indicators/status
// (hook modules_license.js) EXISTEM e continuam no backend, mas ficaram FORA do
// caminho crítico do menu: em rotas custom fora de /api/ o e.auth não popula
// nesta máquina e a autenticação responde 401 mesmo com token válido no
// authStore (o SDK padrão responde 200 com o mesmo token). Se o 401 das rotas
// custom for corrigido no backend, elas podem voltar a ser usadas aqui.
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

/** Extrai e valida a ordem salva do campo menu_order do usuário. */
function parseMenuOrder(raw: unknown): SavedMenuOrder {
  if (!Array.isArray(raw)) return null
  const order = raw.filter(isNavId) as NavId[]
  return order.length > 0 ? order : null
}

/** Lê a preferência salva do usuário logado. Falha = volta para null (padrão). */
export async function loadMenuOrder(): Promise<SavedMenuOrder> {
  if (!pb.authStore.isValid || !pb.authStore.record?.id) return null
  try {
    // Renova o registro do authStore para garantir menu_order atualizado.
    await pb
      .collection('users')
      .authRefresh()
      .catch(() => undefined)
    return parseMenuOrder(pb.authStore.record?.menu_order)
  } catch (_) {
    return parseMenuOrder(pb.authStore.record?.menu_order)
  }
}

/** Salva a nova ordem para o usuário logado. Idempotente (campo único JSON). */
export async function saveMenuOrder(order: NavId[]): Promise<void> {
  const userId = pb.authStore.record?.id
  if (!pb.authStore.isValid || !userId) {
    throw new Error('Usuário não autenticado.')
  }
  await withFreshToken(() => pb.collection('users').update(userId, { menu_order: order }))
}

/** Restaura (apaga) a preferência — volta ao DEFAULT_NAV_IDS. */
export async function resetMenuOrder(): Promise<void> {
  const userId = pb.authStore.record?.id
  if (!pb.authStore.isValid || !userId) {
    throw new Error('Usuário não autenticado.')
  }
  await withFreshToken(() => pb.collection('users').update(userId, { menu_order: null }))
}

/**
 * Módulo Indicadores é licenciado à parte — decide a visibilidade do item no
 * menu. Lê DIRETO da coleção org_modules (regra: leitura da própria org) via
 * API padrão do SDK — a rota custom /backend/v1/indicators/status está fora do
 * caminho crítico por causa do 401 de auth em rotas fora de /api/.
 *
 * Tratamento de erro: registro não encontrado (404) = não licenciado (false);
 * erro de permissão/auth = fail-open (true) — o item aparece no menu e a
 * própria página /indicadores mostra o estado de não licenciado se as rotas de
 * dados falharem; a licença real é sempre aplicada no backend, o menu é só
 * conveniência.
 */
export async function fetchIndicatorsLicensed(): Promise<boolean> {
  if (!pb.authStore.isValid) return false
  const orgId = pb.authStore.record?.org_id
  if (typeof orgId !== 'string' || !orgId) return false
  try {
    const rec = await pb.collection('org_modules').getFirstListItem<{
      licensed?: boolean
      licensed_until?: string | null
    }>(`org_id = "${orgId}" && module = "indicadores"`)
    if (rec?.licensed !== true) return false
    const until = rec.licensed_until
    if (until && new Date(until).getTime() < Date.now()) return false
    return true
  } catch (err) {
    const status =
      (err as { status?: number; response?: { status?: number } })?.status ??
      (err as { response?: { status?: number } })?.response?.status
    // 404 do PocketBase = registro ausente → não licenciado.
    if (status === 404) return false
    // Permissão/auth ou outro erro → fail-open (a página aplica a licença real).
    return true
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
        ? 'Não foi possível gravar a ordem do menu (registro não encontrado).'
        : status === 500
          ? 'Erro do servidor ao gravar a ordem.'
          : undefined
  return label || (err instanceof Error ? err.message : String(err))
}
