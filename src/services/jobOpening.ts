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
  status?: string
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

/** Lista as posições do organograma (para checagem de pré-condições em /cargos). */
export async function listOrgNodes(): Promise<InheritanceNode[]> {
  try {
    return await pb.collection('org_nodes').getFullList<InheritanceNode>({ sort: 'name' })
  } catch (err) {
    console.error('Erro ao carregar posições do organograma:', getErrorMessage(err))
    return []
  }
}

/** Cargo com o mínimo necessário para validar a abertura de vaga. */
export interface OpeningCargoLike {
  id: string
  status?: string | null
  purpose?: string | null
  salary_min?: number | null
  salary_defined?: boolean
  org_node_id?: string | null
}

/** Lê o vínculo cargo → posição do organograma (campo pode não estar no tipo Cargo). */
export const cargoNodeId = (cargo: unknown): string =>
  String((cargo as { org_node_id?: string | null })?.org_node_id || '')

/** Uma pré-condição para habilitar o botão "Abrir vaga". */
export interface OpeningPrecondition {
  id: string
  label: string
  ok: boolean
  /** O que falta, em linguagem do usuário. */
  missing: string
  /** Rota onde a pendência é resolvida (vazio = resolvida na própria /cargos). */
  resolveTo?: string
}

/**
 * Pré-condições bloqueantes para abrir vaga a partir de um cargo:
 * posição APROVADA no organograma vigente, cargo APROVADO, finalidade
 * PREENCHIMENTO e faixa salarial definida.
 */
export function checkOpeningPreconditions(
  cargo: OpeningCargoLike,
  node: InheritanceNode | null,
): OpeningPrecondition[] {
  const hasSalary =
    cargo.salary_defined === true || (cargo.salary_min != null && String(cargo.salary_min) !== '')
  return [
    {
      id: 'posicao',
      label: 'Posição aprovada no organograma vigente',
      ok: Boolean(node) && String(node?.status || 'ativo') !== 'inativo',
      missing: 'vincule o cargo a uma posição ativa do organograma vigente',
      resolveTo: '/organograma',
    },
    {
      id: 'cargo',
      label: 'Cargo aprovado',
      ok: String(cargo.status || '') === 'APROVADO',
      missing: 'conclua o ciclo de aprovação do cargo',
      resolveTo: '/cargos',
    },
    {
      id: 'finalidade',
      label: 'Finalidade “Preenchimento imediato”',
      ok: String(cargo.purpose || '') === 'PREENCHIMENTO',
      missing: 'converta a finalidade do cargo para Preenchimento imediato',
      resolveTo: '',
    },
    {
      id: 'faixa',
      label: 'Faixa salarial definida',
      ok: hasSalary,
      missing: 'preencha a faixa salarial do cargo',
      resolveTo: '/cargos',
    },
  ]
}

/** Todas as pré-condições atendidas? */
export function canOpenJob(cargo: OpeningCargoLike, node: InheritanceNode | null): boolean {
  return checkOpeningPreconditions(cargo, node).every((p) => p.ok)
}

// ---------------------------------------------------------------------------
// Snapshots de auditoria gravados pelo hook jobs_server no create da vaga
// ---------------------------------------------------------------------------

export interface CargoSnapshotData {
  cargo_id?: string
  titulo?: string
  nivel?: string
  area?: string
  finalidade?: string
  status?: string
  faixa_salarial?: { min?: number | null; med?: number | null; max?: number | null }
  cha_resumido?: { conhecimentos?: number; habilidades?: number; atitudes?: number }
  aprovado_em?: string
  aprovado_por?: string
  snapshot_em?: string
}

export interface OrganogramaSnapshotData {
  posicao_id?: string
  node_key?: string
  nome?: string
  area?: string
  gestor?: string
  centro_custo?: string
  company?: string
  versao?: { numero?: number; status?: string; label?: string } | null
  snapshot_em?: string
}

export interface OpeningAuditData {
  cargoSnapshot: CargoSnapshotData | null
  organogramaSnapshot: OrganogramaSnapshotData | null
  openedAt: string
  openedBy: string
  headcount: number | null
  deadline: string
  urgent: boolean
}

/** Extrai os snapshots de auditoria de um registro de vaga (JSON string ou objeto). */
export function parseOpeningAudit(job: unknown): OpeningAuditData {
  const raw = (job || {}) as Record<string, unknown>
  const tryParse = (v: unknown): Record<string, unknown> | null => {
    if (!v) return null
    if (typeof v === 'object') return v as Record<string, unknown>
    try {
      const parsed = JSON.parse(String(v))
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch (_) {
      return null
    }
  }
  return {
    cargoSnapshot: tryParse(raw.cargo_snapshot) as CargoSnapshotData | null,
    organogramaSnapshot: tryParse(raw.organograma_snapshot) as OrganogramaSnapshotData | null,
    openedAt: String(raw.opened_at || ''),
    openedBy: String(raw.opened_by || ''),
    headcount: raw.headcount != null && raw.headcount !== '' ? Number(raw.headcount) : null,
    deadline: String(raw.deadline || ''),
    urgent: Boolean(raw.urgent),
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
