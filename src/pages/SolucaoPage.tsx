/**
 * Página de demonstração comercial — /solucao
 *
 * Conteúdo 100% estático (números fictícios plausíveis), zero chamadas de API.
 * O visitante escolhe ativamente um dos 6 pontos e cada ponto mostra RÉPLICAS
 * VISUAIS das telas do produto (mini-mockups em JSX/Tailwind, não screenshots).
 * O ponto ativo é refletido na querystring (?ponto=1..6) para entrada direta.
 */
import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Sparkles,
  Columns3,
  BarChart3,
  Plug,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Presentation,
  GanttChartSquare,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { MOCKUPS, type MockupComponent } from './solucao/mockups'

type PointId = 1 | 2 | 3 | 4 | 5 | 6

const POINTS: {
  id: PointId
  title: string
  tagline: string
  icon: LucideIcon
}[] = [
  {
    id: 1,
    title: 'O fluxo completo',
    tagline: 'Da vaga no organograma ao cadastro no ERP, sem remontar nada à mão',
    icon: GanttChartSquare,
  },
  {
    id: 2,
    title: 'Para quem opera o R&S',
    tagline: 'Pipeline, score IA e lembretes — o dia a dia do recrutador',
    icon: Columns3,
  },
  {
    id: 3,
    title: 'Para o candidato',
    tagline: 'Candidatura em minutos, currículo lido por IA, consentimento LGPD',
    icon: Sparkles,
  },
  {
    id: 4,
    title: 'Para o gestor',
    tagline: 'Indicadores que apontam o gargalo, trilha de aprovação da estrutura',
    icon: BarChart3,
  },
  {
    id: 5,
    title: 'Integrações',
    tagline: 'ERP Goldway, WhatsApp, Google Calendar e Google for Jobs',
    icon: Plug,
  },
  {
    id: 6,
    title: 'Governança',
    tagline: 'Auditoria, exclusão LGPD real, multi-empresa e licenciamento',
    icon: ShieldCheck,
  },
]

const POINT_COPY: Record<PointId, { headline: string; paragraph: string }> = {
  1: {
    headline: 'Um processo só, da estrutura ao ERP',
    paragraph:
      'A vaga nasce do cargo certo, no lugar certo da organização — e termina com o contratado cadastrado no ERP que a empresa já usa. Nada de planilha paralela, nada de recadastramento.',
  },
  2: {
    headline: 'O recrutador para de garimpar e começa a decidir',
    paragraph:
      'O pipeline mostra quem está em cada etapa, o agente de IA justifica cada nota com base nos requisitos da vaga e os lembretes impedem que candidato fique sem resposta.',
  },
  3: {
    headline: 'Candidatura que o candidato termina — e confia',
    paragraph:
      'Ele sobe o PDF, a IA preenche os campos e ele só revisa. O consentimento LGPD fica registrado com data e hora, e a vaga aparece onde ele procura: no Google.',
  },
  4: {
    headline: 'Número que aponta o gargalo, não só descreve o funil',
    paragraph:
      'O gestor vê em que etapa os candidatos travam, quanto tempo leva cada contratação e quem aprovou cada mudança de estrutura — sem pedir relatório a ninguém.',
  },
  5: {
    headline: 'Conectado ao que a empresa já usa',
    paragraph:
      'Contratou? O cadastro profissional vai para o ERP Goldway. Entrevista cai no Calendar, o recrutador fala por WhatsApp e a vaga é indexada no Google — sem copiar e colar.',
  },
  6: {
    headline: 'Governança que sobrevive à auditoria',
    paragraph:
      'Cada visualização de currículo, movimento de etapa e reprovação fica registrado. A exclusão LGPD remove o candidato e tudo que depende dele, por organização e por licença de módulo.',
  },
}

const FOOTER_LINKS = [
  { to: '/organograma', label: 'Organograma' },
  { to: '/vagas', label: 'Vagas' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/indicadores', label: 'Indicadores' },
  { to: '/integracoes', label: 'Integrações' },
]

const clampPoint = (raw: string | null): PointId => {
  const n = Number(raw)
  return n >= 1 && n <= 6 ? (n as PointId) : 1
}

export const SolucaoPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('ponto')
  const selected: PointId | null = raw === null ? null : clampPoint(raw)

  const [videoOpen, setVideoOpen] = useState(false)

  const openPoint = (id: PointId) => setSearchParams({ ponto: String(id) }, { replace: false })
  const closePoint = () => setSearchParams({}, { replace: false })

  const active = selected ? POINTS.find((p) => p.id === selected)! : null
  const copy = selected ? POINT_COPY[selected] : null
  const Mockup: MockupComponent | null = selected ? MOCKUPS[selected] : null

  const prev = selected && selected > 1 ? selected - 1 : null
  const next = selected && selected < 6 ? selected + 1 : null

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-8">
      {/* ---------------- Hero ---------------- */}
      <section className="rounded-xl border bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-700">
            <Presentation className="w-3.5 h-3.5" />
            Demonstração comercial
          </span>
          <span className="text-[11px] text-slate-400">
            dados de exemplo — nenhuma informação real é exibida aqui
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 max-w-3xl">
          Você não contrata um funil de vagas — contrata o processo de R&amp;S inteiro, amarrado à
          estrutura da empresa e ao ERP que já usa.
        </h1>
        <p className="mt-3 text-sm text-slate-600 max-w-2xl">
          Escolha um dos 6 pontos abaixo para ver a tela correspondente em ação.
        </p>
      </section>

      {/* ---------------- Grade dos 6 pontos ---------------- */}
      <section className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {POINTS.map((p) => {
            const Icon = p.icon
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => openPoint(p.id)}
                className={cn(
                  'group text-left rounded-xl border bg-white p-5 transition-all hover:shadow-md hover:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                  selected === p.id && 'border-sky-400 ring-2 ring-sky-100 shadow-sm',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-100">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {p.id} · ponto
                  </span>
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">{p.title}</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{p.tagline}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-600">
                  Ver demonstração
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ---------------- Seção ativa ---------------- */}
      {active && copy && Mockup && (
        <section className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{copy.headline}</h2>
              <p className="mt-1 text-sm text-slate-600 max-w-3xl">{copy.paragraph}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={closePoint} className="shrink-0">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Fechar
            </Button>
          </div>

          <Mockup />

          {/* navegação anterior/próximo */}
          <div className="flex items-center justify-between pt-2">
            {prev ? (
              <Button variant="outline" size="sm" onClick={() => openPoint(prev as PointId)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                {POINTS[prev - 1].title}
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button variant="outline" size="sm" onClick={() => openPoint(next as PointId)}>
                {POINTS[next - 1].title}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            ) : (
              <span />
            )}
          </div>
        </section>
      )}

      {/* ---------------- Rodapé / CTA ---------------- */}
      <section className="rounded-xl border bg-slate-50 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900">Ver na prática</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Abra as telas reais do produto — os exemplos acima são réplicas delas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FOOTER_LINKS.map((l) => (
              <Button key={l.to} asChild variant="outline" size="sm">
                <Link to={l.to}>
                  {l.label}
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-slate-400" />
                </Link>
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-6 border-t pt-4">
          <Button variant="outline" size="sm" onClick={() => setVideoOpen(true)}>
            <Sparkles className="w-4 h-4 mr-1.5 text-amber-500" />
            Agendar demonstração guiada
          </Button>
        </div>
      </section>

      {/* ---------------- Modal "assistir demo" ---------------- */}
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Demonstração guiada
            </DialogTitle>
            <DialogDescription>
              Aqui entraria o vídeo de demonstração do produto. Espaço reservado para o time
              comercial inserir o conteúdo final.
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video w-full rounded-md border bg-slate-900 flex items-center justify-center">
            <span className="text-sm text-slate-400">vídeo da demonstração</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SolucaoPage
