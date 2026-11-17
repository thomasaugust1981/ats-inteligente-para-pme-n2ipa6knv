//
// Indicadores — cálculo 100% NO CLIENTE via API padrão do PocketBase SDK.
//
// Por que não /backend/v1/indicators/*: rotas custom fora de /api/ dão 401 em
// runtime (e.auth não popula — ver menuOrder.ts). Aqui lemos as coleções brutas
// (applications, jobs, audit_logs) com o SDK autenticado e replicamos as regras
// de cálculo do hook indicators_server.js (manter as duas em sinc).
//

import pb from '@/lib/pocketbase/client'
import { resolveOrgId } from '@/services/menuOrder'

export type IndicatorsFilters = { from: string; to: string; jobId?: string }

export class NotLicensedError extends Error {
  constructor() {
    super('Módulo Indicadores não licenciado para esta organização.')
    this.name = 'NotLicensedError'
  }
}

export const STAGE_LABELS: Record<string, string> = {
  screening: 'Triagem',
  interview_hr: 'Entrevista RH',
  tech_interview: 'Entrevista técnica',
  proposal: 'Proposta',
  hired: 'Contratado',
  rejected: 'Reprovado',
}

const SOURCE_LABELS: Record<string, string> = {
  google_for_jobs: 'Google for Jobs',
  direct_link: 'Link direto',
  whatsapp: 'WhatsApp',
  referral: 'Indicação',
  linkedin: 'LinkedIn',
  other: 'Outros',
  suggested: 'Sugerido (IA)',
}

export const REJECTION_CATEGORY_LABELS: Record<string, string> = {
  perfil_tecnico: 'Perfil técnico',
  pretensao_salarial: 'Pretensão salarial',
  fit_cultura: 'Fit / Cultura',
  desistencia_candidato: 'Desistência do candidato',
  outros: 'Outros',
}

export const FUNNEL_STAGES = ['screening', 'interview_hr', 'tech_interview', 'proposal', 'hired']

export interface TimeToHireGroup {
  area?: string | null
  level?: string | null
  avg_days: number
  hires: number
}
export interface TimeToHireResponse {
  hires_count: number
  overall_avg_days: number
  by_area: TimeToHireGroup[]
  by_seniority: TimeToHireGroup[]
}
export interface FunnelStage {
  stage: string
  entered: number
  advanced: number
  conversion_pct: number
}
export interface FunnelConversionResponse {
  overall: number
  stages: FunnelStage[]
}
export interface OfferArea {
  area: string
  made: number
  accepted: number
  rate_pct: number
}
export interface OfferAcceptanceResponse {
  offers_made: number
  offers_accepted: number
  acceptance_rate_pct: number
  by_area: OfferArea[]
}
export interface HiredSourceCount {
  source: string
  count: number
  pct: number
}
export interface HiredSourceResponse {
  hires_count: number
  distribution: HiredSourceCount[]
}
export interface ResponseBucket {
  count: number
  pct: number
}
export interface FirstResponseTimeResponse {
  applications_count: number
  unanswered_count: number
  overall_avg_hours: number
  distribution: { lt_24h: ResponseBucket; h_24_72: ResponseBucket; gt_72h: ResponseBucket }
}
export interface RejectionCategory {
  category: string
  label: string
  count: number
  pct: number
}
export interface RejectionReasonsResponse {
  rejections_count: number
  distribution: RejectionCategory[]
}

export interface IndicatorsData {
  tth: TimeToHireResponse
  funnel: FunnelConversionResponse
  offer: OfferAcceptanceResponse
  source: HiredSourceResponse
  response: FirstResponseTimeResponse
  rejection: RejectionReasonsResponse
}

// ------------------------------------------------------------------ helpers

type Rec = Record<string, unknown>

function ts(v: unknown): number | null {
  if (!v) return null
  const t = new Date(String(v).replace(' ', 'T')).getTime()
  return Number.isNaN(t) ? null : t
}

function periodBounds(from: string, to: string): { fromTs: number; toTs: number } {
  const fromTs = ts(`${from}T00:00:00`) ?? 0
  const toTs = ts(`${to}T23:59:59.999`) ?? Date.now()
  return { fromTs, toTs }
}

function avg(list: number[]): number {
  if (list.length === 0) return 0
  return list.reduce((a, b) => a + b, 0) / list.length
}

function pctOf(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 1000) / 10
}

function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Categorização por palavras-chave — mesma ordem do hook indicators_server.js. */
export function categorizeRejection(text: string): string {
  const t = norm(text)
  if (!t) return 'outros'
  if (
    t.includes('desist') ||
    t.includes('nao compareceu') ||
    t.includes('no show') ||
    t.includes('sem resposta') ||
    t.includes('sem retorno') ||
    t.includes('abandon') ||
    t.includes('recusou') ||
    t.includes('outra proposta') ||
    t.includes('aceitou outra') ||
    t.includes('contratado em outro')
  ) {
    return 'desistencia_candidato'
  }
  if (
    t.includes('salario') ||
    t.includes('pretensao') ||
    t.includes('remuneracao') ||
    t.includes('caro') ||
    t.includes('acima do budget') ||
    t.includes('orcamento') ||
    t.includes('financeir')
  ) {
    return 'pretensao_salarial'
  }
  if (
    t.includes('fit') ||
    t.includes('cultur') ||
    t.includes('comportament') ||
    t.includes('valores')
  ) {
    return 'fit_cultura'
  }
  if (
    t.includes('tecnico') ||
    t.includes('experiencia') ||
    t.includes('requisito') ||
    t.includes('qualificacao') ||
    t.includes('conhecimento') ||
    t.includes('competencia') ||
    t.includes('curriculo') ||
    t.includes('prova') ||
    t.includes('teste') ||
    t.includes('skill')
  ) {
    return 'perfil_tecnico'
  }
  return 'outros'
}

// ------------------------------------------------------------------ carregamento

interface RawApp extends Rec {
  id: string
  job_id: string
  status: string
  stage_id: string
  source: string
  rejection_reason?: string
  created: string
  stage_updated_at?: string
}
interface RawLog extends Rec {
  id: string
  application_id?: string
  to_stage?: string
  reason?: string
  details?: string
  created: string
}
interface RawJob extends Rec {
  id: string
  department?: string
  seniority?: string
  opened_at?: string
  created: string
}

/**
 * Busca tudo com a API padrão do SDK (autenticada) e calcula os 6 indicadores
 * no cliente. Lança erro em falha de rede/permission — a página mostra o
 * estado de erro com "Tentar de novo".
 */
export async function fetchIndicatorsData(filters: IndicatorsFilters): Promise<IndicatorsData> {
  const orgId = await resolveOrgId()
  if (!orgId) throw new Error('Organização não identificada.')

  const { fromTs, toTs } = periodBounds(filters.from, filters.to)

  const [apps, jobs, logs] = await Promise.all([
    pb.collection('applications').getFullList<RawApp>({ filter: `org_id = "${orgId}"` }),
    pb.collection('jobs').getFullList<RawJob>({}),
    pb
      .collection('audit_logs')
      .getFullList<RawLog>({ filter: `org_id = "${orgId}" && to_stage != ""` }),
  ])

  const jobsById = new Map(jobs.map((j) => [j.id, j]))

  // Trilha de auditoria por candidatura (ordenada por created — o SDK já traz
  // a lista; reordenamos por segurança).
  const logsByApp = new Map<string, RawLog[]>()
  for (const log of logs) {
    const appId = String(log.application_id || '')
    if (!appId) continue
    const list = logsByApp.get(appId) || []
    list.push(log)
    logsByApp.set(appId, list)
  }
  for (const list of logsByApp.values()) {
    list.sort((a, b) => (ts(a.created) ?? 0) - (ts(b.created) ?? 0))
  }

  /** Etapas que a candidatura alcançou (logs + etapa atual + triagem). */
  function reachedStages(app: RawApp): Set<string> {
    const set = new Set<string>(['screening'])
    for (const log of logsByApp.get(app.id) || []) {
      const st = String(log.to_stage || '')
      if (st) set.add(st)
    }
    if (app.stage_id) set.add(String(app.stage_id))
    if (app.status === 'hired') set.add('hired')
    return set
  }

  function jobOf(app: RawApp): RawJob | undefined {
    return jobsById.get(String(app.job_id))
  }

  function areaOf(app: RawApp): string {
    return String(jobOf(app)?.department || '') || 'Sem área'
  }

  function seniorityOf(app: RawApp): string {
    return String(jobOf(app)?.seniority || '') || 'Não informado'
  }

  // Aplicar filtro de vaga do filtro da UI.
  const scoped = filters.jobId ? apps.filter((a) => String(a.job_id) === filters.jobId) : apps

  // ------------------------------------------------------------ time to hire
  const hireDays: number[] = []
  const tthByArea = new Map<string, number[]>()
  const tthBySeniority = new Map<string, number[]>()
  for (const app of scoped) {
    if (app.status !== 'hired') continue
    const hireLogs = (logsByApp.get(app.id) || []).filter((l) => l.to_stage === 'hired')
    const hireTs =
      ts(hireLogs[hireLogs.length - 1]?.created) ?? ts(app.stage_updated_at) ?? ts(app.updated)
    if (hireTs === null || hireTs < fromTs || hireTs > toTs) continue
    const job = jobOf(app)
    const openedTs = ts(job?.opened_at) ?? ts(job?.created) ?? ts(app.created)
    if (openedTs === null) continue
    const days = Math.max(0, Math.round(((hireTs - openedTs) / 86400000) * 10) / 10)
    hireDays.push(days)
    const area = areaOf(app)
    tthByArea.set(area, [...(tthByArea.get(area) || []), days])
    const lvl = seniorityOf(app)
    tthBySeniority.set(lvl, [...(tthBySeniority.get(lvl) || []), days])
  }
  const tth: TimeToHireResponse = {
    hires_count: hireDays.length,
    overall_avg_days: Math.round(avg(hireDays) * 10) / 10,
    by_area: [...tthByArea.entries()]
      .map(([area, list]) => ({
        area,
        hires: list.length,
        avg_days: Math.round(avg(list) * 10) / 10,
      }))
      .sort((a, b) => b.hires - a.hires),
    by_seniority: [...tthBySeniority.entries()]
      .map(([level, list]) => ({
        level,
        hires: list.length,
        avg_days: Math.round(avg(list) * 10) / 10,
      }))
      .sort((a, b) => b.hires - a.hires),
  }

  // ------------------------------------------------------------ funil
  // Candidaturas criadas no período.
  const funnelApps = scoped.filter((a) => {
    const c = ts(a.created)
    return c !== null && c >= fromTs && c <= toTs
  })
  const enteredCount = new Map<string, number>()
  const advancedCount = new Map<string, number>()
  for (const stage of FUNNEL_STAGES) {
    enteredCount.set(stage, 0)
    advancedCount.set(stage, 0)
  }
  for (const app of funnelApps) {
    const reached = reachedStages(app)
    for (let i = 0; i < FUNNEL_STAGES.length; i++) {
      const stage = FUNNEL_STAGES[i]
      if (!reached.has(stage)) continue
      enteredCount.set(stage, (enteredCount.get(stage) || 0) + 1)
      const next = FUNNEL_STAGES[i + 1]
      if (next && reached.has(next)) {
        advancedCount.set(stage, (advancedCount.get(stage) || 0) + 1)
      }
    }
  }
  const stages: FunnelStage[] = FUNNEL_STAGES.map((stage) => {
    const entered = enteredCount.get(stage) || 0
    const advanced = advancedCount.get(stage) || 0
    return { stage, entered, advanced, conversion_pct: pctOf(advanced, entered) }
  })
  const transitions = stages.slice(0, -1).filter((s) => s.entered > 0)
  const funnel: FunnelConversionResponse = {
    overall: Math.round(avg(transitions.map((s) => s.conversion_pct)) * 10) / 10,
    stages,
  }

  // ------------------------------------------------------------ aceite de proposta
  const offerByArea = new Map<string, { made: number; accepted: number }>()
  let offersMade = 0
  let offersAccepted = 0
  for (const app of scoped) {
    const reached = reachedStages(app)
    if (!reached.has('proposal')) continue
    // Data da proposta: log da etapa; fallback created da candidatura.
    const propLogs = (logsByApp.get(app.id) || []).filter((l) => l.to_stage === 'proposal')
    const propTs = ts(propLogs[propLogs.length - 1]?.created) ?? ts(app.created)
    if (propTs === null || propTs < fromTs || propTs > toTs) continue
    offersMade += 1
    const accepted = app.status === 'hired'
    if (accepted) offersAccepted += 1
    const area = areaOf(app)
    const cur = offerByArea.get(area) || { made: 0, accepted: 0 }
    cur.made += 1
    if (accepted) cur.accepted += 1
    offerByArea.set(area, cur)
  }
  const offer: OfferAcceptanceResponse = {
    offers_made: offersMade,
    offers_accepted: offersAccepted,
    acceptance_rate_pct: pctOf(offersAccepted, offersMade),
    by_area: [...offerByArea.entries()]
      .map(([area, v]) => ({
        area,
        made: v.made,
        accepted: v.accepted,
        rate_pct: pctOf(v.accepted, v.made),
      }))
      .sort((a, b) => b.made - a.made),
  }

  // ------------------------------------------------------------ origem do contratado
  const sourceCounts = new Map<string, number>()
  let hiredTotal = 0
  for (const app of scoped) {
    if (app.status !== 'hired') continue
    const hireLogs = (logsByApp.get(app.id) || []).filter((l) => l.to_stage === 'hired')
    const hireTs =
      ts(hireLogs[hireLogs.length - 1]?.created) ?? ts(app.stage_updated_at) ?? ts(app.updated)
    if (hireTs === null || hireTs < fromTs || hireTs > toTs) continue
    const label = SOURCE_LABELS[String(app.source || '')] || 'Não informado'
    sourceCounts.set(label, (sourceCounts.get(label) || 0) + 1)
    hiredTotal += 1
  }
  const source: HiredSourceResponse = {
    hires_count: hiredTotal,
    distribution: [...sourceCounts.entries()]
      .map(([src, count]) => ({ source: src, count, pct: pctOf(count, hiredTotal) }))
      .sort((a, b) => b.count - a.count),
  }

  // ------------------------------------------------------------ primeira resposta
  const firstResponseHours: number[] = []
  let unanswered = 0
  const buckets = { lt_24h: 0, h_24_72: 0, gt_72h: 0 }
  for (const app of funnelApps) {
    const appTs = ts(app.created)
    if (appTs === null) continue
    const transitionsApp = (logsByApp.get(app.id) || []).filter((l) => l.to_stage)
    const firstTs = transitionsApp.length > 0 ? ts(transitionsApp[0].created) : null
    if (firstTs === null) {
      unanswered += 1
      continue
    }
    const hours = Math.max(0, (firstTs - appTs) / 3600000)
    firstResponseHours.push(hours)
    if (hours < 24) buckets.lt_24h += 1
    else if (hours <= 72) buckets.h_24_72 += 1
    else buckets.gt_72h += 1
  }
  const respTotal = firstResponseHours.length + unanswered
  const response: FirstResponseTimeResponse = {
    applications_count: respTotal,
    unanswered_count: unanswered,
    overall_avg_hours: Math.round(avg(firstResponseHours) * 10) / 10,
    distribution: {
      lt_24h: { count: buckets.lt_24h, pct: pctOf(buckets.lt_24h, respTotal) },
      h_24_72: { count: buckets.h_24_72, pct: pctOf(buckets.h_24_72, respTotal) },
      gt_72h: { count: buckets.gt_72h, pct: pctOf(buckets.gt_72h, respTotal) },
    },
  }

  // ------------------------------------------------------------ motivos de reprovação
  const catCounts = new Map<string, number>()
  let rejectionsTotal = 0
  for (const log of logs) {
    if (log.to_stage !== 'rejected') continue
    const evtTs = ts(log.created)
    if (evtTs === null || evtTs < fromTs || evtTs > toTs) continue
    const app = apps.find((a) => a.id === String(log.application_id || ''))
    if (filters.jobId && (!app || String(app.job_id) !== filters.jobId)) continue
    const text =
      String(log.reason || '') || String(log.details || '') || String(app?.rejection_reason || '')
    const cat = categorizeRejection(text)
    catCounts.set(cat, (catCounts.get(cat) || 0) + 1)
    rejectionsTotal += 1
  }
  const rejection: RejectionReasonsResponse = {
    rejections_count: rejectionsTotal,
    distribution: Object.keys(REJECTION_CATEGORY_LABELS)
      .map((cat) => ({
        category: cat,
        label: REJECTION_CATEGORY_LABELS[cat],
        count: catCounts.get(cat) || 0,
        pct: pctOf(catCounts.get(cat) || 0, rejectionsTotal),
      }))
      .sort((a, b) => b.count - a.count),
  }

  return { tth, funnel, offer, source, response, rejection }
}

// ------------------------------------------------------------------ formatação

export function fmtNum(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function fmtPct(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}
