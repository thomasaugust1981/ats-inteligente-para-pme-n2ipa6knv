import pb from '@/lib/pocketbase/client'
import { withFreshToken } from '@/lib/pocketbase/freshToken'

/**
 * Scorecard de entrevista (coleção "interview_scorecards", migração 0051).
 * Avaliação estruturada por candidatura + etapa: três notas 1–5 (técnica,
 * comunicação, cultura), comentários e recomendação (avançar/reprovar/contratar).
 *
 * 100% API padrão do PocketBase SDK com withFreshToken — rotas /backend/v1/*
 * NÃO são usadas no caminho crítico (dão 401 em runtime: e.auth não popula
 * fora de /api/). Isolamento por org é garantido pelas regras da coleção.
 */

export type ScorecardRecommendation = 'avançar' | 'reprovar' | 'contratar'

export interface InterviewScorecard {
  id: string
  org_id?: string
  application_id: string
  job_id?: string
  stage?: string
  interviewer?: string
  interviewed_at?: string
  score_technical?: number | null
  score_communication?: number | null
  score_culture?: number | null
  comments?: string
  recommendation?: ScorecardRecommendation | ''
  created: string
  updated: string
  expand?: {
    interviewer?: { id: string; name: string; email: string }
  }
}

export const SCORECARD_RECOMMENDATIONS: { value: ScorecardRecommendation; label: string }[] = [
  { value: 'avançar', label: 'Avançar no processo' },
  { value: 'reprovar', label: 'Reprovar' },
  { value: 'contratar', label: 'Contratar' },
]

/** Média simples das três notas (null quando nenhuma nota está preenchida). */
export function scorecardAverage(
  card: Pick<InterviewScorecard, 'score_technical' | 'score_communication' | 'score_culture'>,
): number | null {
  const notes = [card.score_technical, card.score_communication, card.score_culture]
  const filled = notes.filter((n) => typeof n === 'number' && n > 0)
  if (filled.length === 0) return null
  return filled.reduce((a, b) => a + (b || 0), 0) / filled.length
}

/** Média formatada em pt-BR ("4,3 / 5"); "—" quando não há notas. */
export function formatScorecardAverage(
  card: Pick<InterviewScorecard, 'score_technical' | 'score_communication' | 'score_culture'>,
): string {
  const avg = scorecardAverage(card)
  if (avg === null) return '—'
  return `${avg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`
}

export interface ScorecardInput {
  application_id: string
  job_id?: string
  stage?: string
  interviewer?: string
  interviewed_at?: string
  score_technical?: number | null
  score_communication?: number | null
  score_culture?: number | null
  comments?: string
  recommendation?: ScorecardRecommendation | ''
}

export const interviewScorecardsService = {
  /** Lista os scorecards de uma candidatura (mais recentes primeiro). */
  async listByApplication(applicationId: string): Promise<InterviewScorecard[]> {
    return await withFreshToken(() =>
      pb.collection('interview_scorecards').getFullList<InterviewScorecard>({
        filter: `application_id = "${applicationId}"`,
        sort: '-created',
        expand: 'interviewer',
      }),
    )
  },

  /** Busca o scorecard de uma candidatura numa etapa específica (ou null). */
  async findForApplicationStage(
    applicationId: string,
    stage: string,
  ): Promise<InterviewScorecard | null> {
    const rows = await withFreshToken(() =>
      pb.collection('interview_scorecards').getList<InterviewScorecard>(1, 1, {
        filter: `application_id = "${applicationId}" && stage = "${stage}"`,
        sort: '-updated',
      }),
    )
    return rows.items[0] || null
  },

  /** Cria ou atualiza o scorecard da candidatura+etapa. */
  async save(input: ScorecardInput, existingId?: string): Promise<InterviewScorecard> {
    const user = pb.authStore.record as (Record<string, unknown> & { org_id?: string }) | null
    if (!pb.authStore.isValid || !user?.org_id) {
      throw new Error('Autenticação necessária.')
    }
    const payload = {
      org_id: user.org_id,
      ...input,
    }
    if (existingId) {
      return await withFreshToken(() =>
        pb.collection('interview_scorecards').update<InterviewScorecard>(existingId, payload),
      )
    }
    return await withFreshToken(() =>
      pb.collection('interview_scorecards').create<InterviewScorecard>(payload),
    )
  },
}
