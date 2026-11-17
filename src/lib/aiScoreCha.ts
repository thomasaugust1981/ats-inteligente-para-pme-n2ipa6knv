// Leitura do bloco CHA do snapshot em ai_scores (gravado server-side por
// pocketbase/hooks/cha_score.js) — usado por AiScorePanel e AiScoreBadge para
// mostrar a contribuição CHA na dimensão técnica do score.

export interface ChaSnapshotItem {
  requisito: string
  bloco: string
  nota: number
  peso: number
  evidencia: string
}

export interface ChaSnapshotData {
  evaluation_id: string
  weighted_score: number
  block_scores: Record<string, number>
  blocks_detail: Record<string, ChaSnapshotItem[]>
  low_grades: Array<{
    requisito: string
    bloco: string
    nota: number
    evidencia: string
  }>
}

export interface AiScoreSnapshot {
  weights_used?: { technical?: number; behavioral?: number; cultural?: number }
  weights_source?: string
  technical_source?: string
  cha_evaluation?: ChaSnapshotData | null
}

const BLOCK_LABELS: Record<string, string> = {
  conhecimentos: 'Conhecimentos',
  habilidades: 'Habilidades',
  atitudes: 'Atitudes',
}

export const CHA_BLOCK_LABELS = BLOCK_LABELS

export const CHA_BLOCK_ORDER = ['conhecimentos', 'habilidades', 'atitudes'] as const

/** Extrai (com shape tolerante) o bloco CHA do snapshot de um score. */
export function chaFromSnapshot(snapshot: unknown): ChaSnapshotData | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const snap = snapshot as AiScoreSnapshot
  if (snap.technical_source !== 'cha' || !snap.cha_evaluation) return null
  const cha = snap.cha_evaluation
  if (!cha.block_scores || typeof cha.block_scores !== 'object') return null
  return cha
}
