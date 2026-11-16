//
// FASE 2 do modelo CHA — tipos, cálculo do score ponderado e serviço da
// coleção cha_evaluations. As notas 1-5 com evidência obrigatória (<3) são
// revalidadas no hook server-side (pocketbase/hooks/cha_evaluations.js) —
// aqui é a mesma régua, para o cliente avisar antes do submit.
//

import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  CHA_BLOCK_KEYS,
  CHA_BLOCK_META,
  type ChaBlockKey,
  type JobChaRequirements,
} from '@/lib/cha'

/** Um requisito efetivo (do cargo + da vaga) já achatado para avaliação. */
export interface ChaEvalItem {
  key: string // id do ChaItem na vaga
  block: ChaBlockKey
  description: string
  weight: number // 1-5 (peso do requisito)
  grade: number // 1-5 (nota do candidato)
  evidence: string // obrigatória quando grade < 3
}

/** grades[] tal como gravado na coleção cha_evaluations. */
export interface ChaGradesPayload {
  items: ChaEvalItem[]
}

export interface ChaEvaluation {
  id: string
  job_id: string
  application_id: string
  grades: string | ChaGradesPayload | null
  weighted_score: number
  block_scores: string | Record<string, number> | null
  evaluator: string
  org_id: string
  created: string
  updated: string
  expand?: Record<string, unknown>
}

function parseJson<T>(raw: unknown): T | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as T
  if (typeof raw !== 'string' || !raw) return null
  try {
    return JSON.parse(raw) as T
  } catch (_) {
    return null
  }
}

/**
 * Lista achatada dos requisitos efetivos da vaga, na MESMA ordem do hook
 * server-side (cargo antes de specific; blocos na ordem conhecimentos →
 * habilidades → atitudes). Vaga sem CHA (ou cha_requirements vazio) → lista
 * vazia → a ficha simplesmente não aparece.
 */
export function flattenJobRequirements(req: JobChaRequirements | null): ChaEvalItem[] {
  const items: ChaEvalItem[] = []
  if (!req) return items
  for (const part of [req.cargo, req.specific]) {
    if (!part) continue
    for (const block of CHA_BLOCK_KEYS) {
      for (const it of part[block]?.items || []) {
        items.push({
          key: it.id,
          block,
          description: it.description,
          weight: it.weight,
          grade: 0,
          evidence: '',
        })
      }
    }
  }
  return items
}

/** Parse tolerante do JSON "grades" gravado. */
export function parseGrades(raw: unknown): ChaEvalItem[] {
  const payload = parseJson<ChaGradesPayload>(raw)
  if (!payload || !Array.isArray(payload.items)) return []
  return payload.items.map((it) => ({
    key: String(it?.key || ''),
    block: (CHA_BLOCK_KEYS as string[]).includes(String(it?.block))
      ? (String(it.block) as ChaBlockKey)
      : 'conhecimentos',
    description: String(it?.description || ''),
    weight: Math.min(5, Math.max(1, Math.round(Number(it?.weight) || 3))),
    grade: Math.min(5, Math.max(1, Math.round(Number(it?.grade) || 1))),
    evidence: String(it?.evidence || ''),
  }))
}

/** Score ponderado 0-100 = soma(nota × peso) / soma(peso × 5) × 100. */
export function weightedScore(items: ChaEvalItem[]): number {
  let weighted = 0
  let max = 0
  for (const it of items) {
    if (it.grade < 1) continue // requisito ainda não avaliado
    weighted += it.grade * it.weight
    max += it.weight * 5
  }
  if (max === 0) return 0
  return Math.round((weighted / max) * 1000) / 10
}

/** Score 0-100 por bloco (mesma fórmula). */
export function blockScores(items: ChaEvalItem[]): Record<ChaBlockKey, number> {
  const out = {} as Record<ChaBlockKey, number>
  for (const block of CHA_BLOCK_KEYS) {
    const blockItems = items.filter((it) => it.block === block)
    out[block] = weightedScore(blockItems)
  }
  return out
}

/** Validação client-side espelhando o hook server-side. */
export function validateGrades(items: ChaEvalItem[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const it of items) {
    const label = it.description || it.key
    if (!Number.isInteger(it.grade) || it.grade < 1 || it.grade > 5) {
      errors[it.key] = `A nota de "${label}" deve ser de 1 a 5.`
      continue
    }
    if (it.grade < 3 && !it.evidence.trim()) {
      errors[it.key] = `Nota ${it.grade} em "${label}" exige evidência/observação justificando.`
    }
  }
  return errors
}

/** Um requisito conta como avaliado quando tem nota válida (1-5). */
export function allGraded(items: ChaEvalItem[]): boolean {
  return items.length > 0 && items.every((it) => it.grade >= 1 && it.grade <= 5)
}

export const CHA_EVAL_BLOCK_LABELS: Record<ChaBlockKey, string> = {
  conhecimentos: CHA_BLOCK_META.conhecimentos.label,
  habilidades: CHA_BLOCK_META.habilidades.label,
  atitudes: CHA_BLOCK_META.atitudes.label,
}

export const chaEvaluationService = {
  /** Ficha da candidatura (editável — uma por candidatura) ou null. */
  async getByApplication(applicationId: string): Promise<ChaEvaluation | null> {
    try {
      const rec = await pb
        .collection('cha_evaluations')
        .getFirstListItem<ChaEvaluation>(`application_id = "${applicationId}"`)
      return rec
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 404) return null
      console.error('[chaEvaluation] falha ao buscar ficha:', getErrorMessage(err))
      return null
    }
  },

  /** Todas as fichas de uma vaga (para o comparativo lado a lado). */
  async listByJob(jobId: string): Promise<ChaEvaluation[]> {
    try {
      return await pb.collection('cha_evaluations').getFullList<ChaEvaluation>({
        filter: `job_id = "${jobId}"`,
        sort: '-weighted_score',
      })
    } catch (err) {
      console.error('[chaEvaluation] falha ao listar fichas da vaga:', getErrorMessage(err))
      return []
    }
  },

  /** Cria ou atualiza a ficha da candidatura (idempotente — upsert por aplicação). */
  async save(applicationId: string, jobId: string, items: ChaEvalItem[]): Promise<ChaEvaluation> {
    const grades: ChaGradesPayload = { items }
    const existing = await chaEvaluationService.getByApplication(applicationId)
    if (existing) {
      return await pb.collection('cha_evaluations').update<ChaEvaluation>(existing.id, {
        grades,
        job_id: jobId,
      })
    }
    return await pb.collection('cha_evaluations').create<ChaEvaluation>({
      job_id: jobId,
      application_id: applicationId,
      grades,
    })
  },
}
