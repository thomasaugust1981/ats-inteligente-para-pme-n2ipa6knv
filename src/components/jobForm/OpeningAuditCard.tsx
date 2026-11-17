import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, Lock } from 'lucide-react'
import { parseOpeningAudit } from '@/services/jobOpening'
import type { Job } from '@/types/ats'

const fmtDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

const fmtDate = (iso?: string) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—'

const KEY_LABELS: Record<string, string> = {
  cargo_id: 'ID do cargo',
  titulo: 'Título',
  nivel: 'Nível',
  area: 'Área',
  finalidade: 'Finalidade',
  status: 'Status',
  faixa_salarial: 'Faixa salarial',
  cha_resumido: 'Requisitos CHA',
  aprovado_em: 'Aprovado em',
  aprovado_por: 'Aprovado por',
  posicao_id: 'ID da posição',
  node_key: 'Chave da posição',
  nome: 'Nome',
  gestor: 'Gestor',
  centro_custo: 'Centro de custo',
  company: 'Empresa',
  versao: 'Versão do organograma',
  min: 'Mínimo',
  med: 'Médio',
  max: 'Máximo',
  conhecimentos: 'Conhecimentos',
  habilidades: 'Habilidades',
  atitudes: 'Atitudes',
  numero: 'Número',
  label: 'Rótulo',
}

const humanizeKey = (key: string) => KEY_LABELS[key] || key.replace(/_/g, ' ')

const formatValue = (value: unknown): string => {
  if (value == null || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}

const SnapshotRows: React.FC<{ data: Record<string, unknown> }> = ({ data }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    {Object.entries(data).map(([key, value]) => (
      <div key={key} className="rounded border border-slate-200 bg-white p-2">
        <p className="text-[10px] uppercase tracking-wide text-slate-400">{humanizeKey(key)}</p>
        <p className="text-xs font-medium text-slate-800 break-words">{formatValue(value)}</p>
      </div>
    ))}
  </div>
)

/** FASE 3: seção "Auditoria da abertura" — snapshots JSON (cargo + organograma)
 *  gravados pelo hook jobs_server.js no create da vaga aberta a partir de cargo. */
export const OpeningAuditCard: React.FC<{ job: Job }> = ({ job }) => {
  const audit = parseOpeningAudit(job)
  const hasAny = Boolean(audit.cargoSnapshot || audit.organogramaSnapshot || audit.openedAt)
  if (!hasAny) return null

  return (
    <Card className="bg-white border-sky-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-sky-600" />
          Auditoria da abertura
        </CardTitle>
        <CardDescription className="text-xs">
          Registro imutável do estado do cargo e do organograma no momento em que a vaga foi aberta
          ( snapshots gravados pelo servidor — somente leitura).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
          <span>
            Aberta em <strong>{fmtDateTime(audit.openedAt)}</strong>
          </span>
          {audit.openedBy && (
            <span>
              por <strong>{audit.openedBy}</strong>
            </span>
          )}
          {audit.headcount != null && (
            <Badge variant="outline" className="text-[10px]">
              {audit.headcount} posição(ões)
            </Badge>
          )}
          {audit.deadline && (
            <Badge variant="outline" className="text-[10px]">
              Contratação até {fmtDate(audit.deadline)}
            </Badge>
          )}
          {audit.urgent && (
            <Badge className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
              Urgente
            </Badge>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            <Lock className="w-3 h-3" /> Snapshot do cargo
          </p>
          {audit.cargoSnapshot ? (
            <SnapshotRows data={audit.cargoSnapshot as Record<string, unknown>} />
          ) : (
            <p className="text-xs text-slate-500">
              Sem snapshot de cargo — vaga criada sem vínculo de abertura.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            <Lock className="w-3 h-3" /> Snapshot do organograma
          </p>
          {audit.organogramaSnapshot ? (
            <SnapshotRows data={audit.organogramaSnapshot as Record<string, unknown>} />
          ) : (
            <p className="text-xs text-slate-500">
              Sem snapshot de organograma — vaga criada sem vínculo de abertura.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default OpeningAuditCard
