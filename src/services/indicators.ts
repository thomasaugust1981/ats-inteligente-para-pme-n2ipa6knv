// Módulo Indicadores (licenciado à parte) — frontend do pacote 4.
// Consome as 6 rotas GET em pocketbase/hooks/indicators_server.js, todas atrás
// do guard de licença (403 "Módulo Indicadores não licenciado...").
// Todas aceitam ?from=&to= (ISO, padrão 90 dias); funnel-conversion e
// hired-source também aceitam ?job_id=.
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'

const BASE = '/backend/v1/indicators'

export const NOT_LICENSED_MESSAGE = 'Módulo Indicadores não licenciado para esta organização.'

/** Erro 403 = a org não tem licença ativa do módulo. */
export class NotLicensedError extends Error {
  constructor() {
    super(NOT_LICENSED_MESSAGE)
    this.name = 'NotLicensedError'
  }
}

export interface IndicatorsFilters {
  from?: string // ISO yyyy-mm-dd
  to?: string // ISO yyyy-mm-dd
  jobId?: string
}

function buildQuery(filters: IndicatorsFilters, withJob: boolean): string {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (withJob && filters.jobId) params.set('job_id', filters.jobId)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** GET autenticado nas rotas do hook — lança NotLicensedError em 403. */
async function indicatorsFetch<T>(
  route: string,
  filters: IndicatorsFilters,
  withJob: boolean,
): Promise<T> {
  const res = await fetch(`${pb.buildUrl('')}${BASE}/${route}${buildQuery(filters, withJob)}`, {
    headers: { Authorization: pb.authStore.token },
  })
  if (res.status === 403) throw new NotLicensedError()
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || 'Falha ao consultar os indicadores.')
  }
  return (await res.json()) as T
}

// ---------------------------------------------------------------- time-to-hire

export interface TimeToHireGroup {
  area?: string
  level?: string
  avg_days: number | null
  hires: number
}

export interface TimeToHireResponse {
  overall_avg_days: number | null
  by_area: TimeToHireGroup[]
  by_seniority: TimeToHireGroup[]
  hires_count: number
}

export const fetchTimeToHire = (f: IndicatorsFilters) =>
  indicatorsFetch<TimeToHireResponse>('time-to-hire', f, false)

// ----------------------------------------------------------- funnel-conversion

export interface FunnelStage {
  stage: string
  entered: number
  advanced: number
  conversion_pct: number
}

export interface FunnelConversionResponse {
  stages: FunnelStage[]
  overall: number
}

export const fetchFunnelConversion = (f: IndicatorsFilters) =>
  indicatorsFetch<FunnelConversionResponse>('funnel-conversion', f, true)

// ---------------------------------------------------------- offer-acceptance

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

export const fetchOfferAcceptance = (f: IndicatorsFilters) =>
  indicatorsFetch<OfferAcceptanceResponse>('offer-acceptance', f, false)

// -------------------------------------------------------------- hired-source

export interface HiredSourceItem {
  source: string
  count: number
  pct: number
}

export interface HiredSourceResponse {
  hires_count: number
  distribution: HiredSourceItem[]
}

export const fetchHiredSource = (f: IndicatorsFilters) =>
  indicatorsFetch<HiredSourceResponse>('hired-source', f, true)

// ------------------------------------------------------- first-response-time

export interface ResponseBucket {
  count: number
  pct: number
}

export interface FirstResponseJob {
  job_id: string
  job_title: string
  avg_hours: number | null
  applications: number
  unanswered: number
}

export interface FirstResponseTimeResponse {
  overall_avg_hours: number | null
  applications_count: number
  unanswered_count: number
  distribution: {
    lt_24h: ResponseBucket
    h_24_72: ResponseBucket
    gt_72h: ResponseBucket
  }
  by_job: FirstResponseJob[]
}

export const fetchFirstResponseTime = (f: IndicatorsFilters) =>
  indicatorsFetch<FirstResponseTimeResponse>('first-response-time', f, false)

// ---------------------------------------------------------- rejection-reasons

export interface RejectionItem {
  category: string
  label: string
  count: number
  pct: number
}

export interface RejectionReasonsResponse {
  rejections_count: number
  distribution: RejectionItem[]
}

export const fetchRejectionReasons = (f: IndicatorsFilters) =>
  indicatorsFetch<RejectionReasonsResponse>('rejection-reasons', f, false)

/** Rejeitada para exibição: lista de { label, value } com pct. */
export interface DistributionItem {
  label: string
  value: number
  pct: number
}

// -------------------------------------------------------------------- formatação

const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })

/** Número no padrão pt-BR (1 casa decimal quando houver quebra). */
export function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return nf1.format(v)
}

/** Percentual pt-BR com vírgula. */
export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return `${nf1.format(v)}%`
}

/** Data ISO (yyyy-mm-dd) formatada curta em pt-BR, ex.: 05/03. */
export function fmtDateShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

/** Intervalo do período no formato "de 05/03 a 03/06". */
export function fmtPeriodLabel(from?: string, to?: string): string {
  if (from && to) return `${fmtDateShort(from)} – ${fmtDateShort(to)}`
  if (from) return `a partir de ${fmtDateShort(from)}`
  if (to) return `até ${fmtDateShort(to)}`
  return 'últimos 90 dias'
}

/** Rótulo pt-BR do stage do funil (ids de DEFAULT_STAGES). */
export const STAGE_LABELS: Record<string, string> = {
  screening: 'Triagem',
  interview_hr: 'Entrevista RH',
  tech_interview: 'Entrevista Técnica',
  proposal: 'Proposta',
  hired: 'Contratado',
}
