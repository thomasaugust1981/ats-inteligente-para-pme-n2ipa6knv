/**
 * Sugestão de CHA por IA — chama POST /backend/v1/cha/suggest (hook
 * cha_suggest.js) com o token de sessão atual (withFreshToken). A resposta é
 * uma SUGESTÃO editável — quem grava é o formulário, depois da revisão.
 */
import pb from '@/lib/pocketbase/client'
import { withFreshToken } from '@/lib/pocketbase/freshToken'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { ChaData } from '@/lib/cha'
import { CHA_BLOCK_KEYS, emptyBlock } from '@/lib/cha'

export interface ChaSuggestionResult {
  provider_used: string
  suggestion: ChaData
}

interface RawItem {
  description?: string
  required?: boolean
  weight?: number
}

const normalizeBlock = (list: unknown) => {
  const src = Array.isArray(list) ? list : []
  return {
    items: src
      .map((it) => {
        const obj = (it || {}) as RawItem
        const description = String(obj.description || '').trim()
        if (!description) return null
        let weight = Number(obj.weight)
        if (!Number.isFinite(weight)) weight = 3
        weight = Math.min(5, Math.max(1, Math.round(weight)))
        return { description, required: obj.required === true, weight }
      })
      .filter((it): it is NonNullable<typeof it> => it !== null),
  }
}

/** Pede a sugestão de CHA para a IA — devolve ChaData pronto para o formulário. */
export const fetchChaSuggestion = async (params: {
  title: string
  area?: string
  level?: string
  mission?: string
}): Promise<ChaSuggestionResult> => {
  return withFreshToken(async () => {
    try {
      const res = await pb.send<Record<string, unknown>>('/backend/v1/cha/suggest', {
        method: 'POST',
        // o SDK envia o token do authStore automaticamente
        body: JSON.stringify({
          title: params.title,
          area: params.area || '',
          level: params.level || '',
          mission: params.mission || '',
        }),
      })
      const raw = (res.suggestion || {}) as Record<string, unknown>
      const suggestion = {} as ChaData
      for (const key of CHA_BLOCK_KEYS) {
        suggestion[key] = {
          items: normalizeBlock(raw[key]).items.map((it) => ({ ...it, id: crypto.randomUUID() })),
        }
      }
      return { provider_used: String(res.provider_used || 'native'), suggestion }
    } catch (err) {
      const msg = getErrorMessage(err)
      throw new Error(
        msg.includes('Autenticação')
          ? 'Sessão expirada — faça login novamente para usar a sugestão de IA.'
          : msg,
      )
    }
  })
}

/** ChaData vazio para reiniciar o formulário. */
export const emptyChaData = (): ChaData => {
  const out = {} as ChaData
  for (const key of CHA_BLOCK_KEYS) out[key] = emptyBlock()
  return out
}
