import pb from '@/lib/pocketbase/client'
import type { CargoApprovalEntry, Cargo } from '@/types/ats'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { parseCha } from '@/lib/cha'

/** Cargo como volta do PocketBase (cha como string JSON). */
export type CargoRaw = Omit<Cargo, 'cha'> & { cha: string | Record<string, unknown> | null }

function normalize(rec: CargoRaw): Cargo {
  return { ...(rec as unknown as Cargo), cha: parseCha(rec.cha) }
}

/** Ações server-side do ciclo de aprovação (hook cargo_server.js). */
export type CargoAction = 'submit' | 'approve' | 'reject' | 'convert'

export interface CargoActionPayload {
  cargo_id: string
  comment?: string
  purpose?: string
}

/**
 * Cargos (FASE 1 CHA + FASE 2 ciclo de aprovação) — CRUD isolado por organização.
 * A regra da coleção já filtra por org; o cliente envia org_id no create
 * (padrão companiesService). Transições de status/finalidade passam SEMPRE
 * pela rota server-side (hook cargo_server.js) — o cliente nunca altera
 * status/org_node_id direto.
 */
export const cargosService = {
  async listCargos(filter?: string, sort = '-created'): Promise<Cargo[]> {
    try {
      const records = await pb.collection('cargos').getFullList<CargoRaw>({ filter, sort })
      return records.map(normalize)
    } catch (err) {
      console.error('Erro ao listar cargos:', getErrorMessage(err))
      return []
    }
  },

  async getById(id: string): Promise<Cargo | null> {
    try {
      const rec = await pb.collection('cargos').getOne<CargoRaw>(id)
      return normalize(rec)
    } catch (_) {
      return null
    }
  },

  async create(data: Partial<Cargo>): Promise<Cargo> {
    const user = pb.authStore.record
    const payload = {
      ...data,
      cha: typeof data.cha === 'string' ? data.cha : JSON.stringify(data.cha || {}),
      org_id: String((user as { org_id?: string } | null)?.org_id || ''),
    }
    const created = await pb
      .collection('cargos')
      .create<CargoRaw>(payload as unknown as Record<string, unknown>)
    return normalize(created)
  },

  async update(id: string, data: Partial<Cargo>): Promise<Cargo> {
    // org_node_id e status NUNCA vêm do cliente — transições pela rota server-side
    const clean: Record<string, unknown> = { ...(data as Record<string, unknown>) }
    delete clean.org_node_id
    delete clean.status
    delete clean.purpose
    if (data.cha && typeof data.cha !== 'string') clean.cha = JSON.stringify(data.cha)
    const updated = await pb.collection('cargos').update<CargoRaw>(id, clean)
    return normalize(updated)
  },

  async delete(id: string): Promise<void> {
    await pb.collection('cargos').delete(id)
  },

  /** POST /backend/v1/cargos/action — transições do ciclo de aprovação. */
  async runAction(payload: CargoActionPayload): Promise<{ ok: boolean; cargo?: Cargo }> {
    const res = await pb.send('/backend/v1/cargos/action', {
      method: 'POST',
      body: payload as unknown as Record<string, unknown>,
    })
    return res as { ok: boolean; cargo?: Cargo }
  },

  /** Trilha de auditoria do cargo (cargo_approvals, mais recente primeiro). */
  async listApprovals(cargoId: string): Promise<CargoApprovalEntry[]> {
    try {
      return await pb
        .collection('cargo_approvals')
        .getFullList<CargoApprovalEntry>({ filter: `cargo_id="${cargoId}"`, sort: '-created' })
    } catch (err) {
      console.error('Erro ao carregar histórico do cargo:', getErrorMessage(err))
      return []
    }
  },
}
