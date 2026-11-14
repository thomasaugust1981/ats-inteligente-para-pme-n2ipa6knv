import { useEffect, useState, useCallback } from 'react'
import {
  getLatestScore,
  listScores,
  recalcScore,
  type AiScoreRecord,
  type ScoreResult,
} from '@/services/aiScore'

type ScoreStatus = 'loading' | 'ready' | 'empty' | 'insufficient' | 'error'

interface AiScoreState {
  status: ScoreStatus
  latest: AiScoreRecord | null
  history: AiScoreRecord[]
  message?: string
  error?: string
}

/**
 * Carrega o último score + histórico da candidatura e expõe `recalculate`
 * (gatilho manual e reuso nos gatilhos automáticos de etapa/DISC/comentário).
 */
export function useAiScore(applicationId?: string | null) {
  const [state, setState] = useState<AiScoreState>({ status: 'loading', latest: null, history: [] })
  const [recalculating, setRecalculating] = useState(false)

  const refresh = useCallback(async (appId: string) => {
    setState((s) => ({ ...s, status: 'loading' }))
    try {
      const [latest, history] = await Promise.all([getLatestScore(appId), listScores(appId)])
      if (latest && latest.insufficient_data) {
        setState({
          status: 'insufficient',
          latest,
          history,
          message: 'Score ainda não calculado — dados insuficientes.',
        })
      } else if (latest) {
        setState({ status: 'ready', latest, history })
      } else {
        setState({
          status: 'empty',
          latest: null,
          history,
          message: 'Score ainda não calculado — dados insuficientes.',
        })
      }
    } catch (err) {
      setState({
        status: 'error',
        latest: null,
        history: [],
        error: err instanceof Error ? err.message : 'Erro ao carregar o score.',
      })
    }
  }, [])

  useEffect(() => {
    if (!applicationId) {
      setState({
        status: 'empty',
        latest: null,
        history: [],
        message: 'Score ainda não calculado — dados insuficientes.',
      })
      return
    }
    refresh(applicationId)
  }, [applicationId, refresh])

  /** Recalcula sob demanda (botão manual ou gatilho automático — sempre consultivo). */
  const recalculate = useCallback(
    async (
      trigger: Parameters<typeof recalcScore>[1] = 'manual',
    ): Promise<{ result: ScoreResult; history: AiScoreRecord[] } | null> => {
      if (!applicationId) return null
      setRecalculating(true)
      try {
        const { result, history } = await recalcScore(applicationId, trigger)
        if (result.insufficient_data) {
          setState({
            status: 'insufficient',
            latest: null,
            history,
            message: result.message || 'Score ainda não calculado — dados insuficientes.',
          })
        } else {
          const latest: AiScoreRecord = {
            id: result.id || '',
            application_id: applicationId,
            candidate_id: '',
            score: result.score,
            justification: result.justification,
            score_technical: result.score_technical,
            score_behavioral: result.score_behavioral,
            score_cultural: result.score_cultural,
            trigger,
            created: result.created,
          }
          setState({ status: 'ready', latest, history })
        }
        return { result, history }
      } catch (err) {
        setState((s) => ({
          ...s,
          status: 'error',
          error: err instanceof Error ? err.message : 'Erro ao recalcular o score.',
        }))
        return null
      } finally {
        setRecalculating(false)
      }
    },
    [applicationId],
  )

  return { ...state, recalculating, refresh, recalculate }
}

/** Formata a data de um cálculo (pt-BR). */
export function formatScoreDate(value?: string): string {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch (_) {
    return value
  }
}
