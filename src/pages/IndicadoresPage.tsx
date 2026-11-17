import React, { useEffect, useState, useCallback } from 'react'
import {
  BarChart3,
  Building2,
  Lock,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  Clock,
  FileText,
  Target,
  Route,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { resolveOrgId, fetchIndicatorsLicensed } from '@/services/menuOrder'
import { useActiveCompany } from '@/hooks/use-active-company'
import { jobsService } from '@/services/jobs'
import type { Job } from '@/types/ats'
import {
  fetchIndicatorsData,
  fmtNum,
  fmtPct,
  STAGE_LABELS,
  type IndicatorsData,
} from '@/services/indicatorsClient'
import {
  DistributionBarList,
  PeriodShortcuts,
  SectionCard,
  getAlertColor,
} from './indicadores/IndicatorsShared'

type PeriodPreset = 30 | 60 | 90

const PERIOD_PRESETS: { days: PeriodPreset; label: string }[] = [
  { days: 30, label: '30 dias' },
  { days: 60, label: '60 dias' },
  { days: 90, label: '90 dias' },
]

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * /indicadores — pacote 4. Dados calculados NO CLIENTE (services/
 * indicatorsClient.ts) via API padrão do SDK — as rotas custom
 * /backend/v1/indicators/* dão 401 em runtime (e.auth não popula fora de
 * /api/). Guard de licença: fetchIndicatorsLicensed (fail-open, v0.0.86).
 */
export const IndicadoresPage: React.FC = () => {
  const { activeCompanyId, companyVersion } = useActiveCompany()
  const [licensed, setLicensed] = useState<boolean | null>(null)
  const [orgName, setOrgName] = useState<string>('')
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [periodDays, setPeriodDays] = useState<PeriodPreset | 'custom'>(90)
  const [from, setFrom] = useState(isoDaysAgo(90))
  const [to, setTo] = useState(isoToday())
  const [jobId, setJobId] = useState('')
  const [data, setData] = useState<IndicatorsData | null>(null)
  const [empty, setEmpty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // ---------------------------------------------------------------- licença (fail-open)
  useEffect(() => {
    let cancelled = false
    setStatusLoading(true)
    void (async () => {
      const [lic, orgId] = await Promise.all([fetchIndicatorsLicensed(), resolveOrgId()])
      let name = ''
      if (orgId) {
        try {
          const org = await pb.collection('organizations').getOne<{ name?: string }>(orgId)
          name = String(org?.name || '')
        } catch (_) {
          name = ''
        }
      }
      if (!cancelled) {
        setLicensed(lic)
        setOrgName(name)
        setStatusLoading(false)
      }
    })().catch(() => {
      if (!cancelled) {
        // Fail-open: erro ao checar licença NUNCA esconde a página inteira.
        setLicensed(true)
        setStatusLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // ---------------------------------------------------------------- vagas para o filtro
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const filter = activeCompanyId ? `company_id = "${activeCompanyId}"` : undefined
        const list = await jobsService.listJobs(filter)
        if (!cancelled) setJobs(list)
      } catch (_) {
        if (!cancelled) setJobs([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeCompanyId, companyVersion])

  // ---------------------------------------------------------------- dados dos indicadores
  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const result = await fetchIndicatorsData({ from, to, jobId: jobId || undefined })
      setData(result)
      const anyData =
        result.tth.hires_count > 0 ||
        result.funnel.stages.some((s) => s.entered > 0) ||
        result.offer.offers_made > 0 ||
        result.rejection.rejections_count > 0 ||
        result.response.applications_count > 0
      setEmpty(!anyData)
    } catch (err) {
      setData(null)
      setEmpty(false)
      setLoadError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [from, to, jobId])

  useEffect(() => {
    if (!statusLoading) void loadAll()
  }, [statusLoading, loadAll])

  const applyPeriod = (days: PeriodPreset) => {
    setPeriodDays(days)
    setFrom(isoDaysAgo(days))
    setTo(isoToday())
  }

  if (statusLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <PageHeader orgName={orgName} licensed={null} />
        <LoadingSkeleton />
      </div>
    )
  }

  if (!licensed) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <PageHeader orgName={orgName} licensed={false} />
        <EmptyState
          icon={Lock}
          title="Módulo Indicadores não licenciado"
          description="O módulo de Indicadores é licenciado à parte. Fale com o time comercial da plataforma para contratar — depois que a licença for liberada, os indicadores da sua operação de recrutamento aparecem aqui automaticamente."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader orgName={orgName} licensed={true} />
      <FilterBar
        periodDays={periodDays}
        from={from}
        to={to}
        jobId={jobId}
        jobs={jobs}
        onPeriod={applyPeriod}
        onFrom={(v) => {
          setPeriodDays('custom')
          setFrom(v)
        }}
        onTo={(v) => {
          setPeriodDays('custom')
          setTo(v)
        }}
        onJob={setJobId}
        onRefresh={loadAll}
        loading={loading}
      />
      {loading ? (
        <LoadingSkeleton />
      ) : loadError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span>{loadError}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => void loadAll()}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      ) : empty || !data ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhuma candidatura no período"
          description={`Não houve movimento no funil entre ${fmtDate(from)} e ${fmtDate(
            to,
          )}. Ajuste o período ou registre candidaturas para ver os indicadores.`}
        />
      ) : (
        <div className="space-y-6">
          <TimeToHireSection data={data.tth} />
          <FunnelSection data={data.funnel} />
          <OfferAcceptanceSection data={data.offer} />
          <HiredSourceSection data={data.source} />
          <FirstResponseSection data={data.response} />
          <RejectionReasonsSection data={data.rejection} />
        </div>
      )}
    </div>
  )
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

// ---------------------------------------------------------------- filtros

const FilterBar: React.FC<{
  periodDays: PeriodPreset | 'custom'
  from: string
  to: string
  jobId: string
  jobs: Job[]
  onPeriod: (d: PeriodPreset) => void
  onFrom: (v: string) => void
  onTo: (v: string) => void
  onJob: (v: string) => void
  onRefresh: () => void
  loading: boolean
}> = ({ periodDays, from, to, jobId, jobs, onPeriod, onFrom, onTo, onJob, onRefresh, loading }) => (
  <Card>
    <CardContent className="pt-4 flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <p className="text-[11px] text-slate-500 font-medium">Período</p>
        <PeriodShortcuts
          presets={PERIOD_PRESETS.map((p) => p.days)}
          value={periodDays === 'custom' ? null : periodDays}
          onSelect={(d) => onPeriod(d as PeriodPreset)}
          getLabel={(d) => PERIOD_PRESETS.find((p) => p.days === d)?.label || String(d)}
        />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] text-slate-500 font-medium">De</p>
        <Input
          type="date"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] text-slate-500 font-medium">Até</p>
        <Input
          type="date"
          value={to}
          onChange={(e) => onTo(e.target.value)}
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1 min-w-[220px]">
        <p className="text-[11px] text-slate-500 font-medium">Vaga</p>
        <Select value={jobId || 'all'} onValueChange={(v) => onJob(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as vagas</SelectItem>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
        Atualizar
      </Button>
    </CardContent>
  </Card>
)

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4">
    <Skeleton className="h-36 w-full" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-48 w-full" />
  </div>
)

// ---------------------------------------------------------------- time to hire

const TimeToHireSection: React.FC<{ data: IndicatorsData['tth'] }> = ({ data }) => {
  const empty = data.hires_count === 0
  return (
    <SectionCard
      title="Time to Hire"
      subtitle="Por que essa vaga está aberta há dois meses: dias entre a abertura e a contratação."
      icon={<Clock className="w-4 h-4" />}
    >
      {empty ? (
        <EmptyHint />
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold text-slate-900">{fmtNum(data.overall_avg_days)}</span>
            <span className="text-sm text-slate-500">
              dias em média · {data.hires_count} contratações
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DistributionBarList
              title="Por área"
              items={(data.by_area || []).map((g) => ({
                label: g.area || 'Sem área',
                value: g.avg_days ?? 0,
                pct: null,
                suffix: 'd',
                hint: `${g.hires} contratações`,
              }))}
            />
            <DistributionBarList
              title="Por senioridade"
              items={(data.by_seniority || []).map((g) => ({
                label: g.level || 'Não informado',
                value: g.avg_days ?? 0,
                pct: null,
                suffix: 'd',
                hint: `${g.hires} contratações`,
              }))}
            />
          </div>
        </>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------- funil

const FunnelSection: React.FC<{ data: IndicatorsData['funnel'] }> = ({ data }) => {
  const empty = data.stages.every((s) => s.entered === 0)
  const stages = data.stages

  // Sinal: transição com conversão claramente abaixo da média das outras.
  let alert: { from: string; to: string; pct: number; gap: number } | null = null
  const transitions = stages.slice(0, -1)
  if (transitions.length >= 2) {
    const avg = transitions.reduce((acc, t) => acc + t.conversion_pct, 0) / transitions.length
    const worst = transitions.reduce((a, b) => (b.conversion_pct < a.conversion_pct ? b : a))
    const gap = avg - worst.conversion_pct
    if (gap >= 15) {
      const fromIdx = stages.indexOf(worst)
      alert = {
        from: STAGE_LABELS[worst.stage] || worst.stage,
        to: STAGE_LABELS[stages[fromIdx + 1]?.stage] || '',
        pct: worst.conversion_pct,
        gap,
      }
    }
  }

  return (
    <SectionCard
      title="Funil de conversão"
      subtitle="Onde os candidatos param: percentual de avanço em cada etapa do pipeline."
      icon={<Route className="w-4 h-4" />}
    >
      {empty ? (
        <EmptyHint />
      ) : (
        <>
          {alert && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <TrendingDown className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
              <span>
                <strong>
                  Maior perda entre {alert.from} e {alert.to}
                </strong>{' '}
                — só {fmtPct(alert.pct)} avança ({fmtNum(alert.gap)} p.p. abaixo da média das demais
                transições).
              </span>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            {stages.map((s) => {
              const isWorst =
                alert !== null &&
                transitions.some((t) => t.stage === s.stage && t.conversion_pct === alert!.pct)
              return (
                <div key={s.stage} className="flex items-center gap-3">
                  <div className="w-36 text-xs text-slate-600 shrink-0">
                    {STAGE_LABELS[s.stage] || s.stage}
                  </div>
                  <div className="flex-1 h-6 bg-slate-100 rounded relative overflow-hidden">
                    <div
                      className={`h-full rounded transition-all ${
                        isWorst && s.conversion_pct > 0 ? getAlertColor() : 'bg-sky-500'
                      }`}
                      style={{ width: `${Math.min(100, s.conversion_pct)}%` }}
                    />
                  </div>
                  <div className="w-32 text-right text-xs shrink-0">
                    <span className="font-medium text-slate-800">{fmtPct(s.conversion_pct)}</span>
                    <span className="text-slate-400">
                      {' '}
                      · {s.advanced}/{s.entered}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Conversão média das transições: {fmtPct(data.overall)}.
          </p>
        </>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------- aceite

const OfferAcceptanceSection: React.FC<{ data: IndicatorsData['offer'] }> = ({ data }) => {
  const empty = data.offers_made === 0
  return (
    <SectionCard
      title="Taxa de aceite de proposta"
      subtitle="Das propostas enviadas, quantas viraram contratação — se o problema é negociação."
      icon={<Target className="w-4 h-4" />}
    >
      {empty ? (
        <EmptyHint />
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold text-slate-900">
              {fmtPct(data.acceptance_rate_pct)}
            </span>
            <span className="text-sm text-slate-500">
              {data.offers_accepted} de {data.offers_made} propostas aceitas
            </span>
          </div>
          <DistributionBarList
            title="Por área"
            items={(data.by_area || []).map((a) => ({
              label: a.area,
              value: a.rate_pct,
              pct: a.rate_pct,
              suffix: '%',
              hint: `${a.accepted}/${a.made} aceitas`,
            }))}
          />
        </>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------- origem

const HiredSourceSection: React.FC<{ data: IndicatorsData['source'] }> = ({ data }) => {
  const empty = data.hires_count === 0
  return (
    <SectionCard
      title="Origem do contratado"
      subtitle="Qual canal traz currículo e qual traz contratação — não são necessariamente o mesmo."
      icon={<FileText className="w-4 h-4" />}
    >
      {empty ? (
        <EmptyHint />
      ) : (
        <DistributionBarList
          title="Canais"
          items={(data.distribution || []).map((d) => ({
            label: d.source,
            value: d.count,
            pct: d.pct,
            suffix: '',
            hint: `${d.count} contratações`,
          }))}
        />
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------- primeira resposta

const FirstResponseSection: React.FC<{ data: IndicatorsData['response'] }> = ({ data }) => {
  const empty = data.applications_count === 0
  const dist = data.distribution
  return (
    <SectionCard
      title="Tempo de primeira resposta"
      subtitle="100% calculável dentro do ATS: horas entre a candidatura e o primeiro movimento de etapa."
      icon={<Clock className="w-4 h-4" />}
    >
      {empty ? (
        <EmptyHint />
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold text-slate-900">
              {fmtNum(data.overall_avg_hours)}
            </span>
            <span className="text-sm text-slate-500">
              horas em média · {data.applications_count} candidaturas
              {data.unanswered_count > 0 && ` · ${data.unanswered_count} sem movimento`}
            </span>
          </div>
          <DistributionBarList
            title="Distribuição"
            items={[
              { label: 'Menos de 24h', bucket: dist?.lt_24h },
              { label: 'De 24h a 72h', bucket: dist?.h_24_72 },
              { label: 'Mais de 72h', bucket: dist?.gt_72h },
            ].map(({ label, bucket }) => ({
              label,
              value: bucket?.count ?? 0,
              pct: bucket?.pct ?? 0,
              suffix: '',
              hint: `${bucket?.count ?? 0} candidaturas`,
            }))}
          />
        </>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------- motivos

const RejectionReasonsSection: React.FC<{ data: IndicatorsData['rejection'] }> = ({ data }) => {
  const empty = data.rejections_count === 0
  return (
    <SectionCard
      title="Motivos de reprovação"
      subtitle="Mostra se o problema é atração, triagem ou negociação — distribuição das justificativas registradas."
      icon={<AlertTriangle className="w-4 h-4" />}
    >
      {empty ? (
        <EmptyHint />
      ) : (
        <DistributionBarList
          title="Categorias"
          items={(data.distribution || []).map((d) => ({
            label: d.label,
            value: d.count,
            pct: d.pct,
            suffix: '',
            hint: `${d.count} reprovações`,
          }))}
        />
      )}
    </SectionCard>
  )
}

const EmptyHint: React.FC = () => (
  <p className="text-sm text-slate-400 text-center py-6">sem dados no período selecionado</p>
)

/** Cabeçalho comum: título, subtítulo com a organização e selo de licença. */
const PageHeader: React.FC<{
  orgName: string
  licensed: boolean | null
}> = ({ orgName, licensed }) => (
  <div className="flex items-center justify-between pb-2 border-b">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-sky-600" />
        Indicadores
      </h1>
      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
        <Building2 className="w-3.5 h-3.5" />
        {orgName || 'Sua organização'}
      </p>
    </div>
    {licensed && (
      <Badge
        variant="outline"
        className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50"
      >
        Licenciado
      </Badge>
    )}
  </div>
)

export default IndicadoresPage
