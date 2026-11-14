// Serviço de score de IA (consultivo) do candidato.
// Chama o hook /backend/v1/candidates/score (rota autenticada do pb_hooks) que
// usa o agente nativo 'candidate-scorer', grava em ai_scores (auditoria) e
// devolve score + justificativa + dimensões. Consulta o histórico em ai_scores.

import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export interface AiScoreDimensions {
  score_technical?: number | null
  score_behavioral?: number | null
  score_cultural?: number | null
}

export interface AiScoreRecord extends AiScoreDimensions {
  id: string
  application_id: string
  candidate_id: string
  job_id?: string
  trigger?: string
  score: number
  justification: string
  insufficient_data?: boolean
  snapshot?: unknown
  created: string
}

export interface ScoreResult extends AiScoreDimensions {
  id?: string
  score: number
  justification: string
  insufficient_data: boolean
  message?: string
  created: string
}

/** Pede um recálculo do score ao backend (agente nativo). Consultivo — nunca altera o status da candidatura. */
export async function calculateScore(
  applicationId: string,
  trigger:
    | 'manual'
    | 'stage_change'
    | 'disc_completed'
    | 'note_added'
    | 'stage_comment'
    | 'application_created' = 'manual',
): Promise<ScoreResult> {
  const res = await fetch(`${pb.buildUrl('')}/backend/v1/candidates/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({ application_id: applicationId, trigger }),
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(payload?.error || 'Falha ao calcular o score de IA.')
  }
  return payload as ScoreResult
}

/** Histórico de cálculos (auditoria) — mais recente primeiro. */
export async function listScores(applicationId: string, limit = 10): Promise<AiScoreRecord[]> {
  try {
    return await pb
      .collection('ai_scores')
      .getList<AiScoreRecord>(1, limit, {
        filter: `application_id = "${applicationId}"`,
        sort: '-created',
      })
      .then((r) => r.items)
  } catch (err) {
    console.error('[aiScore] falha ao listar histórico de scores:', getErrorMessage(err))
    return []
  }
}

/** Último score válido (não-insuficiente) da candidatura, ou null. */
export async function getLatestScore(applicationId: string): Promise<AiScoreRecord | null> {
  const items = await listScores(applicationId, 1)
  return items.length > 0 ? items[0] : null
}

/** Recalcula e refresca o histórico — usado pelo botão manual e pelos gatilhos. */
export async function recalcScore(
  applicationId: string,
  trigger: Parameters<typeof calculateScore>[1] = 'manual',
) {
  const result = await calculateScore(applicationId, trigger)
  const history = await listScores(applicationId)
  return { result, history }
}
