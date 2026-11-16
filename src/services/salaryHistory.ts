//
// FASE 3 do modelo CHA — histórico de alteração de faixa salarial do cargo.
// Os registros são gravados EXCLUSIVAMENTE pelo hook server-side
// (pocketbase/hooks/salary_history.js) no update de cargos; aqui é só leitura.
//
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'

/** Um registro do histórico: campo alterado, anterior → novo, autor e data. */
export interface SalaryHistoryEntry {
  id: string
  cargo_id: string
  field: 'salary_min' | 'salary_med' | 'salary_max' | string
  old_value: number | null
  new_value: number | null
  changed_by?: string
  changed_by_name?: string
  created: string
  expand?: {
    changed_by?: { id: string; name?: string; email?: string }
  }
}

export const SALARY_FIELD_LABELS: Record<string, string> = {
  salary_min: 'Mínimo',
  salary_med: 'Médio',
  salary_max: 'Máximo',
}

export const salaryHistoryService = {
  /** Histórico de um cargo, mais recente primeiro (hook já filtra por org via regra). */
  async listByCargo(cargoId: string): Promise<SalaryHistoryEntry[]> {
    try {
      return await pb.collection('salary_history').getFullList<SalaryHistoryEntry>({
        filter: `cargo_id="${cargoId}"`,
        sort: '-created',
        expand: 'changed_by',
      })
    } catch (err) {
      console.error('Erro ao carregar histórico de faixa salarial:', getErrorMessage(err))
      return []
    }
  },
}
