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
import { withFreshToken } from '@/lib/pocketbase/freshToken'
import type { NavId } from '@/lib/navModel'

/** Ordem salva do menu (lista de ids de rota). null = nunca personalizou. */
export type SavedMenuOrder = NavId[] | null

const isNavId = (v: unknown): v is NavId => typeof v === 'string' && v.length > 0 && v.length <= 64

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

/** Resolve a organização do usuário: campo do record ou a 1ª org do banco. */
export async function resolveOrgId(): Promise<string | null> {
  const recordOrgId = pb.authStore.record?.org_id
  if (typeof recordOrgId === 'string' && recordOrgId) return recordOrgId
  if (!pb.authStore.isValid) return null
  try {
    const orgs = await pb.collection('organizations').getList(1, 1)
    return orgs.items[0]?.id || null
  } catch (_) {
    return null
  }
}

/**
 * Módulo Indicadores é licenciado à parte — decide a visibilidade do item no
 * menu. Lê DIRETO da coleção org_modules (regra: leitura da própria org) via
 * API padrão do SDK — a rota custom /backend/v1/indicators/status está fora do
 * caminho crítico por causa do 401 de auth em rotas fora de /api/.
 *
 * Tratamento de erro (o menu é só conveniência — a licença real é sempre
 * aplicada no backend): registro não encontrado OU qualquer falha na consulta
 * (auth/permissão/rede) = fail-open (true). Retorna false APENAS quando a
 * consulta responde com um registro cujo licensed é false ou cujo
 * licensed_until já venceu — aí o item sai do menu de verdade.
 *
 * IMPORTANTE: a leitura passa por withFreshToken — o PocketBase responde 404
 * (não 403/401) quando o TOKEN ESTÁ STALE e a regra da coleção esconde o
 * registro (mesmo comportamento já visto no PATCH de users/{id}). Sem o
 * refresh+retry, um token vencido fazia getFirstListItem devolver 404 e o
 * código abaixo classificava como "org sem licença", escondendo o item
 * Indicadores silenciosamente após F5 (sem nenhum erro no console).
 */
export async function fetchIndicatorsLicensed(): Promise<boolean> {
  // FAIL-OPEN também sem token: quem chama isto (SidebarNav / página de
  // indicadores) só renderiza para usuário logado; um authStore momentaneamente
  // vazio (hidratação, logout em andamento) NÃO deve esconder o item em
  // silêncio — era o único caminho que retornava false sem rede e sem erro.
  if (!pb.authStore.isValid) return true
  const orgId = await resolveOrgId()
  if (!orgId) return true // sem org identificável → fail-open (não bloqueia o item)
  try {
    const rec = await withFreshToken(() =>
      pb.collection('org_modules').getFirstListItem<{
        licensed?: boolean
        licensed_until?: string | null
      }>(`org_id = "${orgId}" && module = "indicadores"`),
    )
    if (rec?.licensed !== true) return false
    const until = rec.licensed_until
    if (until && new Date(until).getTime() < Date.now()) return false
    return true
  } catch (err) {
    const status =
      (err as { status?: number; response?: { status?: number } })?.status ??
      (err as { response?: { status?: number } })?.response?.status
    // 404 aqui = licença realmente inexistente para a org (o withFreshToken já
    // renovou um token stale e tentou de novo). O superadmin ainda não criou
    // a licença para esta org → item fora do menu, como esperado.
    if (status === 404) return false
    // Qualquer outro erro (auth, permissão, rede) → fail-open: o item aparece
    // no menu e a própria página /indicadores aplica a licença real.
    return true
  }
}

/** Marcador da versão do bundle (uma linha por carregamento da página). */
export function logBundleVersion(): void {
  try {
    // eslint-disable-next-line no-console
    console.info('[menuOrder] bundle v0.0.86 — fetchIndicatorsLicensed com fail-open total')
  } catch (_) {
    /* noop */
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
