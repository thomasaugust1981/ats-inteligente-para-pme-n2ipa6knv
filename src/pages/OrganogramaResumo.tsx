/**
 * Resumo da estrutura — antiga página /estrutura, hoje aba "Resumo" em
 * /organograma. Lista as posições do organograma vigente cruzadas com cargos e
 * vagas em três listas: recrutamentos em andamento (link para o pipeline),
 * posições com cargo estrutural e posições vagas.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Building2, Rocket, Search, Users } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { useActiveCompany } from '@/hooks/use-active-company'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { listOrgNodes } from '@/services/jobOpening'
import type { CargoRaw } from '@/services/cargos'
import type { Job } from '@/types/ats'

interface OrgNodeRow {
  id: string
  name: string
  area: string
  manager: string
  cost_center: string
  status: string
  company?: string
  expand?: { cargo_id?: CargoRaw[] }
}

interface JobsByNode {
  [orgNodeId: string]: Job[]
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativa', className: 'border-emerald-300 text-emerald-700 bg-emerald-50' },
  inativo: { label: 'Inativa', className: 'border-slate-300 text-slate-500 bg-slate-50' },
  vaga: { label: 'Vaga', className: 'border-amber-300 text-amber-700 bg-amber-50' },
}

/** Aba "Resumo" do Organograma: as três listas da ex-/estrutura. */
export const OrganogramaResumo: React.FC = () => {
  const { activeCompanyId } = useActiveCompany()
  const [nodes, setNodes] = useState<OrgNodeRow[]>([])
  const [cargos, setCargos] = useState<CargoRaw[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const [nodesList, cargosList, jobsList] = await Promise.all([
          listOrgNodes() as Promise<OrgNodeRow[]>,
          pb.collection('cargos').getFullList<CargoRaw>({ sort: '-created' }),
          pb.collection('jobs').getFullList<Job>({ sort: '-created' }),
        ])
        if (!cancelled) {
          setNodes(nodesList)
          setCargos(cargosList)
          setJobs(jobsList)
        }
      } catch (err) {
        console.error('Erro ao carregar estrutura organizacional:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [activeCompanyId])

  /** Vagas ativas (recrutamento em andamento) indexadas por posição do organograma. */
  const jobsByNode = useMemo(() => {
    const map: JobsByNode = {}
    for (const job of jobs) {
      if (job.status === 'closed') continue
      const nodeId = String(job.org_node_id || '')
      if (nodeId) {
        if (!map[nodeId]) map[nodeId] = []
        map[nodeId].push(job)
      }
    }
    return map
  }, [jobs])

  /** Cargo estrutural de cada posição (expand cargo_id) ou por vínculo direto. */
  const cargoByNode = useMemo(() => {
    const map: Record<string, CargoRaw> = {}
    for (const node of nodes) {
      const expanded = node.expand?.cargo_id?.[0]
      if (expanded) {
        map[node.id] = expanded
        continue
      }
      const linked = cargos.find(
        (c) => String((c as unknown as { org_node_id?: string }).org_node_id || '') === node.id,
      )
      if (linked) map[node.id] = linked
    }
    return map
  }, [nodes, cargos])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return nodes
    return nodes.filter(
      (n) =>
        n.name?.toLowerCase().includes(q) ||
        n.area?.toLowerCase().includes(q) ||
        n.manager?.toLowerCase().includes(q),
    )
  }, [nodes, search])

  const vagaNodes = useMemo(
    () => filtered.filter((n) => !cargoByNode[n.id]),
    [filtered, cargoByNode],
  )
  const estruturalNodes = useMemo(
    () =>
      filtered.filter((n) => {
        const cargo = cargoByNode[n.id]
        return cargo && String(cargo.purpose || '') === 'ESTRUTURAL'
      }),
    [filtered, cargoByNode],
  )
  const recrutamentoNodes = useMemo(
    () => filtered.filter((n) => (jobsByNode[n.id] || []).length > 0),
    [filtered, jobsByNode],
  )

  const renderNode = (node: OrgNodeRow) => {
    const cargo = cargoByNode[node.id]
    const nodeJobs = jobsByNode[node.id] || []
    const status = STATUS_LABELS[String(node.status || 'ativo')] || STATUS_LABELS.ativo
    return (
      <div
        key={node.id}
        className="rounded-lg border border-slate-200 bg-white p-3 flex flex-col gap-2"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{node.name || '—'}</p>
            <p className="text-[11px] text-slate-500">
              {node.area || 'Sem área'}
              {node.manager ? ` · Gestor: ${node.manager}` : ''}
              {node.cost_center ? ` · CC: ${node.cost_center}` : ''}
            </p>
          </div>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${status.className}`}>
            {status.label}
          </Badge>
        </div>

        {cargo && (
          <div className="text-[11px] text-slate-600">
            Cargo:{' '}
            <Link to="/cargos" className="font-medium text-sky-700 hover:underline">
              {cargo.title}
            </Link>{' '}
            <span className="text-slate-400">
              ({String(cargo.status || '—').toLowerCase()},{' '}
              {String(cargo.purpose || '—').toLowerCase()})
            </span>
          </div>
        )}

        {nodeJobs.length > 0 && (
          <div className="space-y-1">
            {nodeJobs.map((job) => (
              <Link
                key={job.id}
                to={`/pipeline/${job.id}`}
                className="flex items-center gap-1.5 text-[11px] text-sky-700 hover:underline"
              >
                <Rocket className="w-3 h-3 shrink-0" />
                {job.title}
                <Badge variant="outline" className="text-[9px] px-1 py-0">
                  {String(job.status || '')}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {!cargo && nodeJobs.length === 0 && String(node.status || 'ativo') !== 'inativo' && (
          <p className="text-[11px] text-slate-400">
            Posição vaga — nenhum cargo vinculado nem recrutamento em andamento. Abra um cargo em
            "/cargos" para preencher esta posição.
          </p>
        )}
      </div>
    )
  }

  if (loading) return <LoadingState message="Carregando estrutura organizacional..." />

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar por posição, área ou gestor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma posição encontrada"
          description={
            nodes.length === 0
              ? 'Monte o organograma na aba Árvore para visualizar a estrutura aqui.'
              : 'Nenhuma posição corresponde à busca.'
          }
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Rocket className="w-4 h-4 text-rose-500" />
              Recrutamentos em andamento
              <Badge variant="outline" className="text-[10px]">
                {recrutamentoNodes.length}
              </Badge>
            </h2>
            {recrutamentoNodes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recrutamentoNodes.map(renderNode)}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Nenhum recrutamento em andamento.</p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-sky-600" />
              Posições com cargo estrutural
              <Badge variant="outline" className="text-[10px]">
                {estruturalNodes.length}
              </Badge>
            </h2>
            {estruturalNodes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {estruturalNodes.map(renderNode)}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Nenhuma posição ocupada por cargo de estrutura (sem preenchimento imediato).
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-500" />
              Posições vagas
              <Badge variant="outline" className="text-[10px]">
                {vagaNodes.length}
              </Badge>
            </h2>
            {vagaNodes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {vagaNodes.map(renderNode)}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Todas as posições ativas estão preenchidas.</p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default OrganogramaResumo
