//
// FASE 1 do modelo CHA — estrutura de dados e utilidades compartilhadas
// entre /cargos (editor de cargo) e /vagas (herança de requisitos).
// A mesma regra de "comportamento observável" roda server-side em
// pocketbase/hooks/cha_validate.js — mantenha as duas em sinc.
//

export const CHA_LEVELS = ['junior', 'pleno', 'senior'] as const
export type ChaLevel = (typeof CHA_LEVELS)[number]

export const CHA_LEVEL_LABELS: Record<ChaLevel, string> = {
  junior: 'Júnior',
  pleno: 'Pleno',
  senior: 'Sênior',
}

/** Um requisito CHA: descrição, flag obrigatório/desejável e peso 1-5. */
export interface ChaItem {
  id: string
  description: string
  required: boolean
  weight: number // 1-5
}

/** Um dos três blocos: conhecimentos, habilidades, atitudes. */
export interface ChaBlock {
  items: ChaItem[]
}

/** JSON "cha" completo da coleção cargos. */
export type ChaData = Partial<Record<ChaBlockKey, ChaBlock>>
export type ChaBlockKey = 'conhecimentos' | 'habilidades' | 'atitudes'

export const CHA_BLOCK_KEYS: ChaBlockKey[] = ['conhecimentos', 'habilidades', 'atitudes']

export const CHA_BLOCK_META: Record<ChaBlockKey, { label: string; hint: string; icon: string }> = {
  conhecimentos: {
    label: 'Conhecimentos',
    hint: 'Formação mínima, certificações, idiomas, ferramentas, normas…',
    icon: 'BookOpen',
  },
  habilidades: {
    label: 'Habilidades',
    hint: 'Experiência na função, competências técnicas demonstráveis, complexidade das entregas…',
    icon: 'Wrench',
  },
  atitudes: {
    label: 'Atitudes',
    hint: 'Comportamentos observáveis — em vez de "proativo", "identifica e reporta desvios de processo sem supervisão".',
    icon: 'HeartHandshake',
  },
}

/** Requisitos EFETIVOS gravados em jobs.cha_requirements. */
export interface JobChaRequirements {
  cargo: ChaData | null // requisitos herdados do cargo (somente leitura no form)
  specific: ChaData // requisitos específicos da vaga (editáveis)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function emptyBlock(): ChaBlock {
  return { items: [] }
}

export function emptyCha(): ChaData {
  return {
    conhecimentos: emptyBlock(),
    habilidades: emptyBlock(),
    atitudes: emptyBlock(),
  }
}

export function emptySpecific(): ChaData {
  return emptyCha()
}

/** Valor inicial de jobs.cha_requirements (cargo vazio + specific vazio). */
export function emptyChaRequirements(): JobChaRequirements {
  return { cargo: null, specific: emptyCha() }
}

/**
 * Requisitos efetivos ao VINCULAR um cargo: herda o CHA do cargo como
 * base e zera os específicos (a vaga adiciona depois o que for próprio).
 */
export function buildChaRequirements(cargoCha: ChaData | null): JobChaRequirements {
  return {
    cargo: cargoCha ? parseCha(cargoCha) || parseCha(JSON.stringify(cargoCha)) : null,
    specific: emptyCha(),
  }
}

/** Alias curto usado por JobFormPage/ChaInheritCard. */
export function parseJobCha(raw: unknown): JobChaRequirements {
  return parseJobChaRequirements(raw) || emptyChaRequirements()
}

/**
 * Converte a descrição legada (values.requirements, texto livre em linhas)
 * em RASCUNHO dos requisitos específicos da vaga: cada linha não vazia vira
 * um item (obrigatório, peso 3) distribuído em rodízio pelos três blocos CHA.
 * É ponto de partida para revisão manual — não substitui a curadoria do RH.
 */
export function legacyToChaDraft(values: { requirements?: string }): ChaData {
  const draft = emptyCha()
  const lines = String(values?.requirements || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean)
  lines.forEach((line, idx) => {
    const key = CHA_BLOCK_KEYS[idx % CHA_BLOCK_KEYS.length]
    draft[key]!.items.push(chaItem(line, true, 3))
  })
  return draft
}

export function chaItem(description = '', required = true, weight = 3): ChaItem {
  return {
    id: `cha_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    description,
    required,
    weight,
  }
}

/** Parse tolerante do JSON "cha" (string ou objeto; nunca lança). */
export function parseCha(raw: unknown): ChaData | null {
  let data: unknown = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch (_) {
      return null
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const out = emptyCha()
  let hasAny = false
  for (const key of CHA_BLOCK_KEYS) {
    const block = (data as Record<string, unknown>)[key]
    if (block && typeof block === 'object' && !Array.isArray(block)) {
      const items = (block as { items?: unknown }).items
      if (Array.isArray(items)) {
        out[key] = {
          items: items.map((it) => {
            const o = (it || {}) as Record<string, unknown>
            return {
              id: String(o.id || chaItem().id),
              description: String(o.description || o.descricao || ''),
              required: Boolean(o.required),
              weight: clampWeight(Number(o.weight)),
            }
          }),
        }
        if (items.length > 0) hasAny = true
      }
    }
  }
  return hasAny ? out : null
}

function clampWeight(n: number): number {
  if (!Number.isFinite(n)) return 3
  return Math.min(5, Math.max(1, Math.round(n)))
}

/** Parse tolerante de jobs.cha_requirements. */
export function parseJobChaRequirements(raw: unknown): JobChaRequirements | null {
  let data: unknown = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch (_) {
      return null
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const o = data as Record<string, unknown>
  return {
    cargo: parseCha(o.cargo),
    specific: parseCha(o.specific) || emptyCha(),
  }
}

/** Blocos efetivos = cargo (herdado) + específicos da vaga, mesclados. */
export function mergeEffective(cargo: ChaData | null, specific: ChaData): ChaData {
  const out = emptyCha()
  for (const key of CHA_BLOCK_KEYS) {
    out[key] = {
      items: [...(cargo?.[key]?.items || []), ...(specific[key]?.items || [])],
    }
  }
  return out
}

/** Um bloco está completo quando tem pelo menos 1 requisito. */
export function isBlockComplete(block: ChaBlock | undefined): boolean {
  return Boolean(block && block.items.length > 0)
}

/** Publicação exige os três blocos com ≥1 requisito. */
export function chaComplete(cha: ChaData): boolean {
  return CHA_BLOCK_KEYS.every((key) => isBlockComplete(cha[key]))
}

/**
 * Atitude deve ser um comportamento OBSERVÁVEL — não um adjetivo isolado.
 * Mesma heurística do hook server-side cha_validate.js.
 */
export function isObservableBehavior(text: string): boolean {
  const t = String(text || '').trim()
  if (!t) return false
  const words = t.split(/\s+/)
  if (
    words.length <= 2 &&
    !/\b(identify|alcan|entreg|execut|report|comunic|cumpr|atend|resolve|negoci|coorden|organiz|planej|demonstr|mant|contribu|colabor|acompanh|aplic|oper|control|regist|atualiz|confer|valid)\w*/i.test(
      t,
    )
  ) {
    return false
  }
  return /\b\w+(ar|er|ir|ando|endo|a|e)\b/i.test(t) && words.length >= 3
}

/** Lista de atitudes que quebram a regra (para marcar em vermelho no form). */
export function invalidAttitudes(block: ChaBlock | undefined): number[] {
  if (!block) return []
  return block.items
    .map((it, idx) => (it.description.trim() && !isObservableBehavior(it.description) ? idx : -1))
    .filter((idx) => idx >= 0)
}

/** Rótulos de peso (exibidos no editor). */
export const WEIGHT_LABELS: Record<number, string> = {
  1: '1 — Básico',
  2: '2 — Desejável forte',
  3: '3 — Importante',
  4: '4 — Muito importante',
  5: '5 — Essencial',
}
