/**
 * Mini-mockups em JSX/Tailwind das telas reais do produto — réplicas visuais
 * usadas pela página de demonstração /solucao. Nada aqui chama API: tudo é
 * conteúdo estático com números fictícios plausíveis.
 */
import React, { useState } from 'react'
import {
  Network,
  Building2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  FileText,
  ShieldCheck,
  Clock,
  Target,
  BarChart3,
  TrendingDown,
  MessageCircle,
  CalendarDays,
  Search,
  Database,
  Lock,
  KeyRound,
  Users,
  Briefcase,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MockupComponent = React.FC

// ------------------------------------------------------------------ helpers

const MiniWindow: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className,
}) => (
  <div className={cn('rounded-lg border bg-white shadow-sm overflow-hidden', className)}>
    <div className="flex items-center gap-1.5 border-b bg-slate-50 px-3 py-1.5">
      <span className="h-2 w-2 rounded-full bg-slate-300" />
      <span className="h-2 w-2 rounded-full bg-slate-300" />
      <span className="h-2 w-2 rounded-full bg-slate-300" />
      <span className="ml-2 text-[10px] font-medium text-slate-500 truncate">{title}</span>
    </div>
    <div className="p-3">{children}</div>
  </div>
)

const MiniBadge: React.FC<{ children: React.ReactNode; tone?: string }> = ({
  children,
  tone = 'border-sky-200 bg-sky-50 text-sky-700',
}) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap',
      tone,
    )}
  >
    {children}
  </span>
)

const ChaBlock: React.FC<{ label: string; items: string[]; weight: number }> = ({
  label,
  items,
  weight,
}) => (
  <div className="rounded border border-slate-200 p-1.5">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[9px] font-semibold text-slate-700">{label}</span>
      <span className="text-[9px] text-slate-400">peso {weight}</span>
    </div>
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <span key={it} className="rounded bg-slate-100 px-1 py-0.5 text-[8px] text-slate-600">
          {it}
        </span>
      ))}
    </div>
  </div>
)

// ------------------------------------------------------------------ 1. esteira

const FLOW_STEPS = [
  { key: 'organograma', label: 'Organograma' },
  { key: 'cargo', label: 'Cargo CHA' },
  { key: 'vaga', label: 'Vaga' },
  { key: 'carreiras', label: 'Carreiras' },
  { key: 'candidatura', label: 'Candidatura' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'erp', label: 'ERP' },
] as const

type FlowKey = (typeof FLOW_STEPS)[number]['key']

const FlowMockOrganograma = () => (
  <MiniWindow title="Organograma · Estrutura da empresa">
    <div className="flex items-center gap-1.5 mb-2">
      <Network className="h-3.5 w-3.5 text-sky-600" />
      <span className="text-[10px] font-semibold text-slate-700">Diretoria Comercial</span>
    </div>
    <div className="ml-4 space-y-1">
      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-700 flex items-center justify-between">
        <span>Gerente de Contas</span>
        <MiniBadge tone="border-emerald-200 bg-emerald-50 text-emerald-700">ocupada</MiniBadge>
      </div>
      <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] text-amber-800 font-medium flex items-center justify-between">
        <span className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Vendedor Externo — SP
        </span>
        <MiniBadge tone="border-amber-300 bg-amber-100 text-amber-800">vaga aberta</MiniBadge>
      </div>
      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-700 flex items-center justify-between">
        <span>Analista de Inside Sales</span>
        <MiniBadge tone="border-emerald-200 bg-emerald-50 text-emerald-700">ocupada</MiniBadge>
      </div>
    </div>
    <p className="mt-2 text-[9px] text-slate-400">
      clicar na posição vaga abre o fluxo de recrutamento dela
    </p>
  </MiniWindow>
)

const FlowMockCargo = () => (
  <MiniWindow title="Cargo · Vendedor Externo — Sênior">
    <div className="flex items-center gap-1.5 mb-2">
      <Building2 className="h-3.5 w-3.5 text-sky-600" />
      <span className="text-[10px] font-semibold text-slate-700">Modelo CHA do cargo</span>
      <MiniBadge tone="border-violet-200 bg-violet-50 text-violet-700">
        faixa R$ 4.200–6.500
      </MiniBadge>
    </div>
    <div className="space-y-1.5">
      <ChaBlock label="Conhecimento" items={['CRM', 'Funil de vendas', 'Negociação']} weight={5} />
      <ChaBlock label="Habilidade" items={['Prospecção ativa', 'Demonstração']} weight={4} />
      <ChaBlock label="Atitude" items={['Resiliência', 'Orientação a meta']} weight={5} />
    </div>
    <p className="mt-2 text-[9px] text-slate-400">
      a vaga herda estes requisitos — o recrutador não recomeça do zero
    </p>
  </MiniWindow>
)

const FlowMockVaga = () => (
  <MiniWindow title="Vaga · Vendedor Externo — SP">
    <div className="flex items-center gap-1.5 mb-2">
      <Briefcase className="h-3.5 w-3.5 text-sky-600" />
      <span className="text-[10px] font-semibold text-slate-700">Requisitos herdados do cargo</span>
    </div>
    <div className="space-y-1">
      {[
        'CRM e funil de vendas — herdado do cargo',
        'Prospecção ativa — herdado',
        'Resiliência — herdado',
      ].map((r) => (
        <div
          key={r}
          className="flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-700"
        >
          <Lock className="h-3 w-3 text-slate-400" />
          {r}
        </div>
      ))}
    </div>
    <div className="mt-2 flex items-center gap-1.5">
      <MiniBadge>presencial · SP</MiniBadge>
      <MiniBadge tone="border-emerald-200 bg-emerald-50 text-emerald-700">publicada</MiniBadge>
    </div>
  </MiniWindow>
)

const FlowMockCarreiras = () => (
  <MiniWindow title="Carreiras · página pública da empresa">
    <div className="rounded bg-sky-600 px-3 py-2 text-white">
      <p className="text-[11px] font-semibold">Grupo Vetra</p>
      <p className="text-[9px] text-sky-100">Vagas abertas — 3 posições</p>
    </div>
    <div className="mt-2 space-y-1">
      <div className="rounded border border-slate-200 px-2 py-1 text-[10px] flex items-center justify-between">
        <span className="text-slate-700">Vendedor Externo — SP</span>
        <MiniBadge>Google for Jobs</MiniBadge>
      </div>
      <div className="rounded border border-slate-200 px-2 py-1 text-[10px] flex items-center justify-between">
        <span className="text-slate-700">Analista de Inside Sales</span>
        <MiniBadge>Google for Jobs</MiniBadge>
      </div>
    </div>
    <p className="mt-2 text-[9px] text-slate-400">
      cada vaga tem link próprio e é indexada no Google
    </p>
  </MiniWindow>
)

const FlowMockCandidatura = () => (
  <MiniWindow title="Candidatura · formulário do candidato">
    <div className="space-y-1.5">
      {[
        { label: 'Nome completo', value: 'Marina Duarte', ai: true },
        { label: 'E-mail', value: 'marina.duarte@email.com', ai: true },
        { label: 'Telefone', value: '(11) 98765-4321', ai: true },
        { label: 'Última empresa', value: 'Transportadora Rota Sul', ai: true },
      ].map((f) => (
        <div key={f.label} className="flex items-center justify-between gap-2">
          <span className="text-[9px] text-slate-500 w-24 shrink-0">{f.label}</span>
          <span className="flex-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-800 truncate">
            {f.value}
          </span>
          {f.ai && (
            <MiniBadge tone="border-violet-200 bg-violet-50 text-violet-700">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              IA
            </MiniBadge>
          )}
        </div>
      ))}
      <div className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1">
        <ShieldCheck className="h-3 w-3 text-emerald-600" />
        <span className="text-[9px] text-emerald-700">
          Consentimento LGPD registrado — 05/02, 14:32
        </span>
      </div>
    </div>
  </MiniWindow>
)

const FlowMockPipeline = () => (
  <MiniWindow title="Pipeline · Vendedor Externo — SP">
    <div className="grid grid-cols-4 gap-1.5">
      {[
        { stage: 'Triagem', n: 12, tone: 'border-slate-200' },
        { stage: 'Entrevista RH', n: 5, tone: 'border-slate-200' },
        { stage: 'Proposta', n: 2, tone: 'border-sky-300 bg-sky-50' },
        { stage: 'Contratado', n: 1, tone: 'border-emerald-300 bg-emerald-50' },
      ].map((c) => (
        <div key={c.stage} className={cn('rounded border p-1.5', c.tone)}>
          <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wide">
            {c.stage}
          </p>
          <p className="text-[11px] font-bold text-slate-800">{c.n}</p>
        </div>
      ))}
    </div>
    <div className="mt-1.5 rounded border border-slate-200 px-2 py-1 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[8px] font-bold text-sky-700">
          MD
        </span>
        <span className="text-[10px] text-slate-700">Marina Duarte</span>
      </div>
      <MiniBadge tone="border-violet-200 bg-violet-50 text-violet-700">score 87</MiniBadge>
    </div>
  </MiniWindow>
)

const FlowMockErp = () => (
  <MiniWindow title="Contratação concluída · integração ERP">
    <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 mb-2 flex items-center gap-1.5">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      <span className="text-[10px] font-medium text-emerald-800">
        Marina Duarte — contratada em 05/03
      </span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-center">
        <p className="text-[9px] text-slate-500">ATS</p>
        <p className="text-[10px] font-semibold text-slate-800">dados do contratado</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
      <div className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-center">
        <p className="text-[9px] text-slate-500">Goldway ERP</p>
        <p className="text-[10px] font-semibold text-slate-800">cadastro profissional</p>
      </div>
    </div>
    <p className="mt-2 text-[9px] text-slate-400">
      sem recadastramento manual — o RH não digita o mesmo dado duas vezes
    </p>
  </MiniWindow>
)

const FLOW_MOCKS: Record<FlowKey, React.FC> = {
  organograma: FlowMockOrganograma,
  cargo: FlowMockCargo,
  vaga: FlowMockVaga,
  carreiras: FlowMockCarreiras,
  candidatura: FlowMockCandidatura,
  pipeline: FlowMockPipeline,
  erp: FlowMockErp,
}

/** Ponto 1 — esteira navegável etapa por etapa, cada etapa com seu mini-mockup. */
const FlowStepper: React.FC = () => {
  const [step, setStep] = useState<FlowKey>('organograma')
  const idx = FLOW_STEPS.findIndex((s) => s.key === step)
  const Active = FLOW_MOCKS[step]
  return (
    <div className="space-y-3">
      {/* trilha clicável */}
      <div className="flex flex-wrap items-center gap-1">
        {FLOW_STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 && <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />}
            <button
              type="button"
              onClick={() => setStep(s.key)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                s.key === step
                  ? 'border-sky-500 bg-sky-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700',
              )}
            >
              {s.label}
            </button>
          </React.Fragment>
        ))}
      </div>
      {/* mockup da etapa ativa */}
      <div className="max-w-md">
        <Active />
      </div>
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={idx === 0}
          onClick={() => setStep(FLOW_STEPS[Math.max(0, idx - 1)].key)}
        >
          <ArrowRight className="h-3.5 w-3.5 mr-1 rotate-180" />
          Anterior
        </Button>
        <span className="text-[11px] text-slate-400">
          etapa {idx + 1} de {FLOW_STEPS.length} · {FLOW_STEPS[idx].label}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={idx === FLOW_STEPS.length - 1}
          onClick={() => setStep(FLOW_STEPS[Math.min(FLOW_STEPS.length - 1, idx + 1)].key)}
        >
          Próxima
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ 2. recrutador

const PipelineKanbanMock: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className="grid grid-cols-3 gap-2">
    {[
      {
        stage: 'Triagem',
        cards: [
          { initials: 'RJ', name: 'Rafael Jesuíno', score: 74 },
          { initials: 'CL', name: 'Carla Lima', score: 61 },
        ],
      },
      {
        stage: 'Entrevista RH',
        cards: [{ initials: 'MD', name: 'Marina Duarte', score: 87 }],
      },
      { stage: 'Proposta', cards: [] },
    ].map((col) => (
      <div key={col.stage} className="rounded-md border border-slate-200 bg-slate-50 p-1.5">
        <p className="mb-1 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          {col.stage}
          <span className="text-slate-400">{col.cards.length}</span>
        </p>
        <div className="space-y-1">
          {col.cards.map((c) => (
            <div key={c.name} className="rounded border border-slate-200 bg-white p-1.5">
              <div className="flex items-center gap-1">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[8px] font-bold text-sky-700">
                  {c.initials}
                </span>
                <span className="text-[9px] font-medium text-slate-800 truncate">{c.name}</span>
              </div>
              {!compact && (
                <MiniBadge tone="border-violet-200 bg-violet-50 text-violet-700">
                  IA {c.score}
                </MiniBadge>
              )}
            </div>
          ))}
          {col.cards.length === 0 && (
            <p className="py-2 text-center text-[9px] text-slate-300">vazio</p>
          )}
        </div>
      </div>
    ))}
  </div>
)

/** Ponto 2 — para quem opera o R&S. */
const RecruiterMock = () => (
  <div className="space-y-3">
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <MiniWindow title="Pipeline · Vendedor Externo — SP">
        <PipelineKanbanMock />
      </MiniWindow>
      <MiniWindow title="Score IA · Marina Duarte">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-slate-800">Nota geral</span>
          <span className="text-[11px] font-bold text-sky-700">87 / 100</span>
        </div>
        <div className="space-y-1">
          {[
            { dim: 'Técnico (peso 5)', val: 92 },
            { dim: 'Comportamental (peso 3)', val: 81 },
            { dim: 'Cultural (peso 2)', val: 78 },
          ].map((d) => (
            <div key={d.dim} className="flex items-center gap-2">
              <span className="w-28 text-[9px] text-slate-600 shrink-0">{d.dim}</span>
              <div className="h-3 flex-1 rounded bg-slate-100">
                <div className="h-full rounded bg-violet-500" style={{ width: `${d.val}%` }} />
              </div>
              <span className="w-7 text-right text-[9px] font-medium text-slate-700">{d.val}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-1.5">
          <p className="text-[9px] leading-snug text-slate-600">
            <Sparkles className="mr-0.5 inline h-2.5 w-2.5 text-violet-500" />
            Justificativa: experiência com CRM e funil estruturado atende aos requisitos herdados do
            cargo; sem vivência em ciclo de venda externa longa.
          </p>
        </div>
      </MiniWindow>
    </div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <MiniWindow title="Currículo estruturado · campos extraídos pela IA">
        <div className="space-y-1">
          {[
            ['Cargo atual', 'Consultora de Vendas'],
            ['Senioridade', 'Pleno'],
            ['Skills', 'CRM · Prospecção · Fechamento'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-20 shrink-0 text-[9px] text-slate-500">{k}</span>
              <span className="flex-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-800">
                {v}
              </span>
              <MiniBadge tone="border-violet-200 bg-violet-50 text-violet-700">IA</MiniBadge>
            </div>
          ))}
        </div>
      </MiniWindow>
      <MiniWindow title="Lembretes de etapa">
        <div className="space-y-1">
          {[
            { who: 'Carla Lima', what: 'aguardando retorno desde 28/02', tone: 'amber' as const },
            { who: 'Rafael Jesuíno', what: 'entrevista RH amanhã, 10h', tone: 'sky' as const },
          ].map((r) => (
            <div
              key={r.who}
              className={cn(
                'flex items-start gap-1.5 rounded border px-2 py-1',
                r.tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50',
              )}
            >
              <Clock
                className={cn(
                  'h-3 w-3 mt-0.5',
                  r.tone === 'amber' ? 'text-amber-600' : 'text-sky-600',
                )}
              />
              <span className="text-[9px] leading-snug text-slate-700">
                <strong>{r.who}</strong> — {r.what}
              </span>
            </div>
          ))}
          <p className="text-[9px] text-slate-400">
            o sistema cobra a etapa — o recrutador não decora fila
          </p>
        </div>
      </MiniWindow>
    </div>
  </div>
)

// ------------------------------------------------------------------ 3. candidato

/** Ponto 3 — para o candidato. */
const CandidateMock = () => {
  const [phase, setPhase] = useState<'upload' | 'extracting' | 'done'>('upload')
  const label =
    phase === 'upload'
      ? 'Suba seu currículo em PDF'
      : phase === 'extracting'
        ? 'Lendo seu currículo…'
        : 'Revise os dados'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MiniWindow title="Candidatura pública · Vendedor Externo">
          <p className="text-[11px] font-semibold text-slate-800">{label}</p>
          <button
            type="button"
            onClick={() => {
              setPhase('extracting')
              window.setTimeout(() => setPhase('done'), 1200)
            }}
            className={cn(
              'mt-2 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed px-3 py-4 text-[10px] font-medium transition-colors',
              phase === 'upload'
                ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
                : 'border-slate-200 bg-slate-50 text-slate-500',
            )}
          >
            {phase === 'upload' ? (
              <>
                <UploadCloud className="h-4 w-4" />
                Enviar PDF do currículo
              </>
            ) : phase === 'extracting' ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse text-violet-500" />
                extraindo informações…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                currículo lido — revise abaixo
              </>
            )}
          </button>
          <p className="mt-1.5 text-[9px] text-slate-400">
            clique no campo acima para simular a extração
          </p>
        </MiniWindow>
        <MiniWindow title="Dados preenchidos pela IA">
          <div className="space-y-1">
            {[
              ['Nome', 'Marina Duarte'],
              ['E-mail', 'marina.duarte@email.com'],
              ['Telefone', '(11) 98765-4321'],
              ['Skills', 'CRM · Prospecção'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="w-14 shrink-0 text-[9px] text-slate-500">{k}</span>
                <span
                  className={cn(
                    'flex-1 rounded border px-1.5 py-0.5 text-[9px] transition-colors',
                    phase === 'done'
                      ? 'border-slate-200 bg-slate-50 text-slate-800'
                      : 'border-dashed border-slate-200 text-slate-300',
                  )}
                >
                  {phase === 'done' ? v : 'aguardando currículo…'}
                </span>
                {phase === 'done' && (
                  <MiniBadge tone="border-violet-200 bg-violet-50 text-violet-700">IA</MiniBadge>
                )}
              </div>
            ))}
          </div>
        </MiniWindow>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MiniWindow title="Consentimento LGPD">
          <div className="flex items-start gap-1.5 rounded border border-emerald-200 bg-emerald-50 p-2">
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-emerald-600" />
            <p className="text-[9px] leading-snug text-emerald-800">
              Autorizo o tratamento dos meus dados para este processo seletivo, conforme a LGPD.
              <br />
              <span className="font-medium">Registrado em 05/02/2025 às 14:32</span>
            </p>
          </div>
          <p className="mt-1.5 text-[9px] text-slate-400">
            o consentimento fica vinculado à candidatura, com data e hora
          </p>
        </MiniWindow>
        <MiniWindow title="Distribuição da vaga">
          <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 p-2">
            <Search className="h-4 w-4 text-sky-600" />
            <div>
              <p className="text-[10px] font-semibold text-slate-800">Google for Jobs</p>
              <p className="text-[9px] text-slate-500">sua vaga aparece na busca do Google</p>
            </div>
          </div>
          <p className="mt-1.5 text-[9px] text-slate-400">
            indexação automática, sem custo por clique
          </p>
        </MiniWindow>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ 4. gestor

const ManagerMock = () => {
  const funnel = [
    { label: 'Candidaturas', entered: 120, adv: 120, pct: 100 },
    { label: 'Triagem', entered: 120, adv: 58, pct: 48 },
    { label: 'Entrevista RH', entered: 58, adv: 8, pct: 14 },
    { label: 'Proposta', entered: 8, adv: 6, pct: 75 },
    { label: 'Contratados', entered: 6, adv: 5, pct: 83 },
  ]
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
            <BarChart3 className="h-3.5 w-3.5 text-sky-600" />
            Indicadores · últimos 90 dias
          </p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            {[
              { icon: Clock, label: 'Time to Hire', value: '23 dias', sub: 'média geral' },
              { icon: TrendingDown, label: 'Funil', value: '41%', sub: 'triagem → RH' },
              { icon: Target, label: 'Taxa de aceite', value: '72%', sub: '5 de 7 propostas' },
              { icon: Users, label: 'Origem', value: 'Indicação', sub: '38% dos contratados' },
              { icon: Clock, label: '1ª resposta', value: '18h', sub: 'média em dias úteis' },
              { icon: AlertCircle, label: 'Reprovações', value: '34', sub: 'top: técnico' },
            ].map((c) => (
              <div key={c.label} className="rounded-md border border-slate-200 p-2">
                <p className="flex items-center gap-1 text-[9px] font-medium text-slate-500">
                  <c.icon className="h-3 w-3 text-sky-600" />
                  {c.label}
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">{c.value}</p>
                <p className="text-[8px] text-slate-400">{c.sub}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
            <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>
              <strong>Gargalo detectado</strong> — queda de 38 p.p. da Triagem → Entrevista RH: só
              14% avançam, contra média de 52% nas demais transições.
            </span>
          </div>
        </CardContent>
      </Card>
      <MiniWindow title="Trilha de aprovação · nova posição na estrutura">
        <div className="space-y-1.5">
          {[
            {
              icon: FileText,
              who: 'Ana Prado (RH)',
              what: 'criou a posição Vendedor Externo — SP',
              when: '01/03, 09:12',
              tone: 'slate' as const,
            },
            {
              icon: CheckCircle2,
              who: 'Carlos Menezes (Diretor)',
              what: 'aprovou a posição',
              when: '01/03, 15:48',
              tone: 'emerald' as const,
            },
            {
              icon: XCircle,
              who: 'Comitê de Custos',
              what: 'rejeitou — "vaga duplicada na filial Osasco"',
              when: '02/03, 10:05',
              tone: 'red' as const,
            },
          ].map((e, i) => (
            <div key={i} className="flex items-start gap-2">
              <e.icon
                className={cn(
                  'mt-0.5 h-3.5 w-3.5 shrink-0',
                  e.tone === 'emerald'
                    ? 'text-emerald-500'
                    : e.tone === 'red'
                      ? 'text-red-500'
                      : 'text-slate-400',
                )}
              />
              <div className="flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1">
                <p className="text-[10px] text-slate-800">
                  <strong>{e.who}</strong> {e.what}
                </p>
                <p className="text-[8px] text-slate-400">{e.when}</p>
              </div>
            </div>
          ))}
        </div>
      </MiniWindow>
    </div>
  )
}

// ------------------------------------------------------------------ 5. integrações

const IntegrationFlowMock: React.FC<{
  icon: LucideIcon
  name: string
  steps: string[]
}> = ({ icon: Icon, name, steps }) => (
  <div className="rounded-md border border-slate-200 bg-white p-2">
    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
      <Icon className="h-3.5 w-3.5 text-sky-600" />
      {name}
    </p>
    <div className="flex flex-wrap items-center gap-1">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          {i > 0 && <ArrowRight className="h-3 w-3 text-slate-300" />}
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-700">
            {s}
          </span>
        </React.Fragment>
      ))}
    </div>
  </div>
)

/** Ponto 5 — integrações. */
const IntegrationsMock = () => (
  <div className="space-y-3">
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <MiniWindow title="Goldway ERP · contratação → cadastro">
        <IntegrationFlowMock
          icon={Database}
          name="Goldway ERP"
          steps={['contratado no pipeline', 'ficha profissional', 'cadastro no ERP']}
        />
        <p className="mt-1.5 text-[9px] text-slate-400">
          exportação com validação de campos essenciais antes do envio
        </p>
      </MiniWindow>
      <MiniWindow title="WhatsApp · mensagem ao candidato">
        <IntegrationFlowMock
          icon={MessageCircle}
          name="WhatsApp"
          steps={['convite de entrevista', 'mensagem pronta por etapa', 'envio 1 clique']}
        />
        <p className="mt-1.5 text-[9px] text-slate-400">
          templates por etapa — sem digitar mensagem repetida
        </p>
      </MiniWindow>
      <MiniWindow title="Google Calendar · entrevistas">
        <IntegrationFlowMock
          icon={CalendarDays}
          name="Google Calendar"
          steps={['entrevista marcada', 'evento criado', 'convite ao candidato']}
        />
      </MiniWindow>
      <MiniWindow title="Google for Jobs · distribuição">
        <IntegrationFlowMock
          icon={Search}
          name="Google for Jobs"
          steps={['vaga publicada', 'estrutura indexada', 'candidatura 1 clique']}
        />
      </MiniWindow>
    </div>
    <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-[11px] text-sky-800">
      <KeyRound className="h-3.5 w-3.5 shrink-0" />
      cada conexão usa credencial própria do usuário conectado — nada de senha de colega emprestada
    </div>
  </div>
)

// ------------------------------------------------------------------ 6. governança

/** Ponto 6 — governança. */
const GovernanceMock = () => (
  <div className="space-y-3">
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <MiniWindow title="Trilha de auditoria">
        <div className="space-y-1">
          {[
            ['Marina Duarte', 'visualizou o currículo de Rafael Jesuíno', '05/03, 11:20'],
            ['Ana Prado', 'moveu Carla Lima para Entrevista RH', '05/03, 10:02'],
            [
              'Carlos Menezes',
              'reprovou João Rocha — motivo: salário acima da faixa',
              '04/03, 17:44',
            ],
          ].map(([who, what, when]) => (
            <div key={`${who}-${what}`} className="flex items-start gap-1.5">
              <FileText className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
              <p className="text-[9px] leading-snug text-slate-700">
                <strong>{who}</strong> {what}
                <span className="block text-[8px] text-slate-400">{when}</span>
              </p>
            </div>
          ))}
        </div>
      </MiniWindow>
      <MiniWindow title="Exclusão LGPD real (cascata)">
        <div className="rounded border border-red-200 bg-red-50 p-2">
          <p className="flex items-center gap-1 text-[10px] font-semibold text-red-800">
            <ShieldCheck className="h-3 w-3" />
            Excluir candidato: João Rocha
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {['candidato', 'currículo', 'scores IA', 'avaliações CHA', 'DISC'].map((t) => (
              <React.Fragment key={t}>
                {t !== 'candidato' && <ArrowRight className="h-2.5 w-2.5 text-red-300" />}
                <span className="rounded border border-red-200 bg-white px-1 py-0.5 text-[8px] text-red-700">
                  {t}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-[9px] text-slate-400">
          a exclusão remove o candidato e tudo que depende dele — sem órfãos no banco
        </p>
      </MiniWindow>
      <MiniWindow title="Isolamento por organização">
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { name: 'Grupo Vetra', jobs: '3 vagas · 42 candidatos', tone: 'border-slate-200' },
            { name: 'Vetra Filial SP', jobs: '1 vaga · 9 candidatos', tone: 'border-slate-200' },
          ].map((o) => (
            <div key={o.name} className={cn('rounded border p-1.5', o.tone)}>
              <p className="flex items-center gap-1 text-[9px] font-semibold text-slate-700">
                <Building2 className="h-3 w-3 text-slate-400" />
                {o.name}
              </p>
              <p className="text-[8px] text-slate-400">{o.jobs}</p>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[9px] text-slate-400">
          cada organização só enxerga os próprios dados — matriz e filiais compartilham o sistema,
          não os candidatos
        </p>
      </MiniWindow>
      <MiniWindow title="Licenciamento por módulo">
        <div className="space-y-1">
          {[
            ['Pipeline & Vagas', true],
            ['Indicadores', true],
            ['Agente de Score IA', false],
          ].map(([mod, on]) => (
            <div
              key={String(mod)}
              className="flex items-center justify-between rounded border border-slate-200 px-2 py-1"
            >
              <span className="text-[9px] text-slate-700">{mod}</span>
              <MiniBadge
                tone={
                  on
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-100 text-slate-500'
                }
              >
                {on ? 'licenciado' : 'não licenciado'}
              </MiniBadge>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[9px] text-slate-400">
          módulo sem licença fica invisível no menu e bloqueado no backend
        </p>
      </MiniWindow>
    </div>
  </div>
)

// ------------------------------------------------------------------ mapa

export const MOCKUPS: Record<number, MockupComponent> = {
  1: FlowStepper,
  2: RecruiterMock,
  3: CandidateMock,
  4: ManagerMock,
  5: IntegrationsMock,
  6: GovernanceMock,
}
