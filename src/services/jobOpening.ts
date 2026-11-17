//
// FASE 3 do fluxo Organograma → Cargo → Vaga — herança cargo → vaga.
// Carrega o cargo de origem e a posição do organograma para exibir os campos
// herdados em modo SOMENTE-LEITURA no formulário da vaga (o hook jobs_server
// grava os snapshots no create; aqui só lemos a origem).
//
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { Cargo } from '@/types/ats'

/** Posição (org_nodes) herdada pelo cargo de origem. */
export interface InheritanceNode {
  id: string
  name: string
  node_key?: string
  area?: string
  manager?: string
  manager_id?: string
  cost_center?: string
  location?: string
}

/** Cargo de origem + posição herdada (quando o cargo tem org_node_id). */
export interface CargoInheritance {
  cargo: Cargo
  node: InheritanceNode | null
}

/** Carrega cargo e posição do organograma para a abertura de vaga. */
export async function loadCargoInheritance(cargoId: string): Promise<CargoInheritance | null> {
  try {
    const cargo = await pb.collection('cargos').getOne<Cargo>(cargoId)
    let node: InheritanceNode | null = null
    const nodeId = String(cargo.org_node_id || '')
    if (nodeId) {
      try {
        node = await pb.collection('org_nodes').getOne<InheritanceNode>(nodeId)
      } catch (err) {
        console.error('Erro ao carregar posição do organograma:', getErrorMessage(err))
      }
    }
    return { cargo, node }
  } catch (err) {
    console.error('Erro ao carregar cargo de origem:', getErrorMessage(err))
    return null
  }
}

/** Formatador de moeda para faixa salarial herdada (padrão das demais telas). */
export const formatBRL = (v?: number | null) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(v)
