//
// FASE 2 do fluxo Organograma → Cargo → Vaga — trilha de aprovação do cargo
// (coleção cargo_approvals) e posições do organograma VIGENTE.
//
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { CargoApprovalEntry } from '@/types/ats'

/** Uma posição (org_nodes) do organograma vigente, para seleção na criação do cargo. */
export interface OrgPosition {
  id: string
  node_key: string
  name: string
  role_title?: string
  area?: string
  manager?: string
  location?: string
  status?: string
  is_new_position?: boolean
}

/** Entrada da trilha como volta do PocketBase (org_id como string após expand). */
type ApprovalRaw = CargoApprovalEntry & { org_id?: string }

export const cargoApprovalsService = {
  /** Trilha completa de um cargo (mais antiga primeiro). */
  async listForCargo(cargoId: string): Promise<CargoApprovalEntry[]> {
    try {
      return await pb
        .collection('cargo_approvals')
        .getFullList<CargoApprovalEntry>({ filter: `cargo_id = "${cargoId}"`, sort: 'created' })
    } catch (err) {
      console.error('Erro ao carregar trilha do cargo:', getErrorMessage(err))
      return []
    }
  },

  /** Trilha da organização (mais nova primeiro) — painel de auditoria. */
  async listForOrg(limit = 100): Promise<CargoApprovalEntry[]> {
    try {
      return await pb
        .collection('cargo_approvals')
        .getList<CargoApprovalEntry>(1, limit, {
          sort: '-created',
        })
        .then((r) => r.items)
    } catch (err) {
      console.error('Erro ao carregar auditoria de cargos:', getErrorMessage(err))
      return []
    }
  },
}

/**
 * Posições do organograma VIGENTE (versão APROVADA mais recente da
 * organização). Fonte: espelho org_nodes publicado pelo hook de aprovação
 * (org_versions_server) — posições ativas apenas. Fallback: org_nodes ativos
 * quando a org ainda não tem versão APROVADA.
 */
export const orgPositionsService = {
  async listActive(): Promise<OrgPosition[]> {
    const user = pb.authStore.record as { org_id?: string } | null
    const orgId = String(user?.org_id || '')
    try {
      const filter = orgId ? `org_id = "${orgId}" && status = "ativo"` : 'status = "ativo"'
      const nodes = await pb.collection('org_nodes').getFullList<{
        id: string
        node_key: string
        name: string
        role_title?: string
        area?: string
        manager?: string
        location?: string
        status?: string
        is_new_position?: boolean
      }>({ filter, sort: 'name', requestKey: null })
      return nodes.map((n) => ({
        id: n.id,
        node_key: n.node_key,
        name: n.name,
        role_title: n.role_title || '',
        area: n.area || '',
        manager: n.manager || '',
        location: n.location || '',
        status: n.status || '',
        is_new_position: !!n.is_new_position,
      }))
    } catch (err) {
      console.error('Erro ao carregar posições do organograma:', getErrorMessage(err))
      return []
    }
  },
}
