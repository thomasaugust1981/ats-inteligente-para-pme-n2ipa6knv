import pb from '@/lib/pocketbase/client'
import type { Cargo } from '@/types/ats'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { parseCha } from '@/lib/cha'

/** Cargo como volta do PocketBase (cha como string JSON). */
export type CargoRaw = Omit<Cargo, 'cha'> & { cha: string | Record<string, unknown> | null }

function normalize(rec: CargoRaw): Cargo {
  return { ...(rec as unknown as Cargo), cha: parseCha(rec.cha) }
}

/**
 * Cargos (FASE 1 do modelo CHA) — CRUD isolado por organização.
 * A regra da coleção já filtra por org; o cliente envia org_id no create
 * (padrão companiesService) — o backfill das migrações 0018/0024/0025 mantém
 * o campo nos registros antigos.
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
    const clean: Record<string, unknown> = { ...(data as Record<string, unknown>) }
    if (data.cha && typeof data.cha !== 'string') clean.cha = JSON.stringify(data.cha)
    const updated = await pb.collection('cargos').update<CargoRaw>(id, clean)
    return normalize(updated)
  },

  async delete(id: string): Promise<void> {
    await pb.collection('cargos').delete(id)
  },
}
