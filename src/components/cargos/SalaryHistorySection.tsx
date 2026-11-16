//
// FASE 3 do modelo CHA — seção expansível "Histórico de faixa" do formulário
// do cargo. Somente leitura: os registros são gravados pelo hook server-side
// (pocketbase/hooks/salary_history.js) no update de cargos.
//

import React, { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, History, TriangleAlert } from 'lucide-react'
import {
  SALARY_FIELD_LABELS,
  salaryHistoryService,
  type SalaryHistoryEntry,
} from '@/services/salaryHistory'

const fmtBRL = (n: number | null): string =>
  n == null
    ? '—'
    : Number(n).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      })

const fmtWhen = (iso: string): string => {
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export const SalaryHistorySection: React.FC<{ cargoId: string | null }> = ({ cargoId }) => {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<SalaryHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !cargoId || entries.length > 0 || error) return
    let cancelled = false
    setLoading(true)
    salaryHistoryService
      .listByCargo(cargoId)
      .then((list) => {
        if (!cancelled) setEntries(list)
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar o histórico.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, cargoId, entries.length, error])

  if (!cargoId) {
    return (
      <p className="text-xs text-slate-400 italic">
        Histórico de faixa: disponível após o primeiro salvamento do cargo.
      </p>
    )
  }

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="w-4 h-4 text-sky-600" />
          Histórico de faixa salarial
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3">
          {loading ? (
            <p className="text-xs text-slate-400 py-2">Carregando histórico…</p>
          ) : error ? (
            <p className="text-xs text-rose-600 py-2">{error}</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              Nenhuma alteração de faixa registrada ainda — cada mudança em mínimo, médio ou máximo
              fica registrada aqui, com autor e valores anterior → novo.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {entries.map((e) => {
                const author =
                  e.expand?.changed_by?.name ||
                  e.expand?.changed_by?.email ||
                  e.changed_by_name ||
                  '—'
                return (
                  <li
                    key={e.id}
                    className="flex items-start gap-2 text-xs bg-slate-50 rounded-md px-2.5 py-2"
                  >
                    <TriangleAlert className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800">
                        {SALARY_FIELD_LABELS[e.field] || e.field}
                      </span>{' '}
                      <span className="text-slate-600">
                        {fmtBRL(e.old_value)} → {fmtBRL(e.new_value)}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {fmtWhen(e.created)} · por {author}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default SalaryHistorySection
