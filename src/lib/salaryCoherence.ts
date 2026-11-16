//
// FASE 3 do modelo CHA — coerência da faixa salarial entre níveis do mesmo
// título/área. Aviso (não bloqueia o salvamento): a faixa de um nível mais
// alto não pode ficar inteira abaixo da de um nível mais baixo.
//

import { CHA_LEVELS, CHA_LEVEL_LABELS, type ChaLevel } from '@/lib/cha'
import type { Cargo } from '@/types/ats'

export interface SalaryRange {
  min: number | null
  med: number | null
  max: number | null
}

export interface SalaryAlert {
  /** Nível do cargo sendo editado (texto comparado) */
  level: ChaLevel
  /** Nível do irmão que quebra a ordem */
  otherLevel: ChaLevel
  message: string
}

/** Média da faixa (usa os três pontos; faltante cai no que existir). */
function rangeMid(r: SalaryRange): number | null {
  const pts = [r.min, r.med, r.max].filter(
    (v): v is number => v != null && Number.isFinite(Number(v)),
  )
  if (pts.length === 0) return null
  return pts.reduce((a, b) => a + b, 0) / pts.length
}

/** "irmãos": mesmo título (ou mesma área, quando o título não se repete). */
export function siblingCargos(
  all: Cargo[],
  current: { id?: string; title: string; area?: string; level?: string },
): Cargo[] {
  const titleNorm = (current.title || '').trim().toLowerCase()
  const areaNorm = (current.area || '').trim().toLowerCase()
  return all.filter((c) => {
    if (current.id && c.id === current.id) return false
    if (!c.level) return false
    const sameTitle = titleNorm && (c.title || '').trim().toLowerCase() === titleNorm
    const sameArea = areaNorm && areaNorm && (c.area || '').trim().toLowerCase() === areaNorm
    return sameTitle || sameArea
  })
}

/**
 * Compara a faixa do cargo com a de cada irmão: incoerente quando o nível
 * atual é MAIS alto e a faixa inteira (ponto mais alto) fica abaixo da faixa
 * do irmão mais baixo — ou o contrário. Sem irmãos com faixa: sem alerta.
 */
export function salaryCoherenceAlerts(
  current: { level?: string; title: string; area?: string; id?: string },
  currentRange: SalaryRange,
  all: Cargo[],
): SalaryAlert[] {
  const curMid = rangeMid(currentRange)
  const curTop = currentRange.max ?? currentRange.med ?? currentRange.min
  if (curMid == null && curTop == null) return []
  const curLevelIdx = CHA_LEVELS.indexOf((current.level || '') as ChaLevel)
  if (curLevelIdx < 0) return []

  const alerts: SalaryAlert[] = []
  const siblings = siblingCargos(all, current)
  for (const sib of siblings) {
    const sibLevelIdx = CHA_LEVELS.indexOf((sib.level || '') as ChaLevel)
    if (sibLevelIdx < 0 || sibLevelIdx === curLevelIdx) continue
    const sibRange: SalaryRange = {
      min: sib.salary_min ?? null,
      med: sib.salary_med ?? null,
      max: sib.salary_max ?? null,
    }
    const sibMid = rangeMid(sibRange)
    const sibTop = sibRange.max ?? sibRange.med ?? sibRange.min
    if (sibMid == null && sibTop == null) continue

    // Faixa atual inteira abaixo da do irmão de nível mais baixo?
    if (sibLevelIdx < curLevelIdx && curTop != null && sibMid != null && curTop < sibMid) {
      alerts.push({
        level: (current.level || '') as ChaLevel,
        otherLevel: sib.level as ChaLevel,
        message: `Faixa inteira abaixo da de ${sib.title} (${CHA_LEVEL_LABELS[sib.level as ChaLevel]}), que tem médio de ${BRLfmt(sibMid)}.`,
      })
    }
    // Faixa atual inteira acima da do irmão de nível mais alto?
    if (sibLevelIdx > curLevelIdx && sibTop != null && curMid != null && curMid > sibTop) {
      alerts.push({
        level: (current.level || '') as ChaLevel,
        otherLevel: sib.level as ChaLevel,
        message: `Faixa inteira acima da de ${sib.title} (${CHA_LEVEL_LABELS[sib.level as ChaLevel]}), que vai até ${BRLfmt(sibTop)}.`,
      })
    }
  }
  return alerts
}

const BRLfmt = (n: number): string =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
