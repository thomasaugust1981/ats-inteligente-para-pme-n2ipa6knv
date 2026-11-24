import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import {
  admissionsService,
  ADMISSION_STATUS_LABELS,
  type Admission,
  type AdmissionStatus,
} from '@/services/admissions'
import { LoadingState } from '@/components/LoadingState'
import { AdmissionDialog } from '@/components/admissions/AdmissionDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { ClipboardList, Search } from 'lucide-react'

const STATUS_BADGE_CLASS: Record<AdmissionStatus, string> = {
  pendente: 'bg-slate-100 text-slate-700 border-slate-200',
  em_andamento: 'bg-amber-50 text-amber-800 border-amber-200',
  concluido: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

/**
 * Lista de processos admissionais (handoff admissional — migração 0057).
 * A lista é filtrada pelas regras da coleção: admin/recrutador veem toda a
 * organização; o gestor vê apenas as admissões das vagas dele.
 */
export const AdmissionsPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [admissions, setAdmissions] = useState<Admission[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<AdmissionStatus | 'todos'>('todos')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Admission | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await admissionsService.list()
      setAdmissions(rows)
    } catch (err) {
      console.error('Erro ao listar admissões:', err)
      toast({ title: 'Erro ao carregar as admissões', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return admissions.filter((a) => {
      if (statusFilter !== 'todos' && a.status !== statusFilter) return false
      if (!q) return true
      const hay =
        `${a.candidate_name} ${a.job_title} ${a.cargo_title} ${a.manager_name}`.toLowerCase()
      return hay.includes(q)
    })
  }, [admissions, query, statusFilter])

  const counts = useMemo(() => {
    const c: Record<AdmissionStatus, number> = { pendente: 0, em_andamento: 0, concluido: 0 }
    for (const a of admissions)
      c[a.status as AdmissionStatus] = (c[a.status as AdmissionStatus] || 0) + 1
    return c
  }, [admissions])

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-sky-600" />
            Admissões
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Handoff admissional para o Departamento Pessoal — criado automaticamente quando um
            candidato é contratado no pipeline. Entrega final: cadastro no Goldway ERP.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar candidato, vaga, cargo..."
              className="h-9 pl-8 w-56 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Filtros de status com contagem */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['todos', 'pendente', 'em_andamento', 'concluido'] as const).map((s) => {
          const active = statusFilter === s
          const count = s === 'todos' ? admissions.length : counts[s]
          const label = s === 'todos' ? 'Todos' : ADMISSION_STATUS_LABELS[s]
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label} ({count})
            </button>
          )
        })}
      </div>

      {loading ? (
        <LoadingState message="Carregando admissões..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            admissions.length === 0
              ? 'Nenhum processo admissional ainda'
              : 'Nada encontrado com esses filtros'
          }
          description={
            admissions.length === 0
              ? 'Quando um candidato chega à etapa de contratação no pipeline, o processo admissional é criado aqui automaticamente.'
              : 'Ajuste a busca ou o filtro de status.'
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id} className="bg-white hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-900">{a.candidate_name}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${STATUS_BADGE_CLASS[a.status as AdmissionStatus]}`}
                    >
                      {ADMISSION_STATUS_LABELS[a.status as AdmissionStatus]}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{a.job_title || a.cargo_title || 'Vaga'}</span>
                    {a.manager_name && (
                      <>
                        <span>•</span>
                        <span>Gestor: {a.manager_name}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>
                      Contratação:{' '}
                      {a.hire_date ? new Date(a.hire_date).toLocaleDateString('pt-BR') : '—'}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    setSelected(a)
                    setDetailOpen(true)
                  }}
                >
                  Abrir processo
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Processo completo: checklist + pacote de admissão */}
      <AdmissionDialog
        open={detailOpen && Boolean(selected)}
        onOpenChange={(o) => {
          if (!o) {
            setDetailOpen(false)
            setSelected(null)
            load()
          }
        }}
        admission={selected}
        onSaved={load}
      />
    </div>
  )
}

export default AdmissionsPage
