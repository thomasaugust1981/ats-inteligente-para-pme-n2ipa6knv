import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CHA_BLOCK_KEYS,
  CHA_BLOCK_META,
  chaItem,
  invalidAttitudes,
  type ChaBlockKey,
  type ChaData,
  type ChaItem,
} from '@/lib/cha'

interface Props {
  value: ChaData
  onChange: (next: ChaData) => void
  errors: Record<string, string>
}

/**
 * Editor dos requisitos específicos da vaga (FASE 1 CHA) — três blocos com
 * descrição, flag obrigatório/desejável e peso 1-5. A validação de atitudes
 * (sem adjetivo isolado) é reaproveitada do editor de cargos (lib/cha).
 */
export const ChaSection: React.FC<Props> = ({ value, onChange, errors }) => {
  const addItem = (key: ChaBlockKey) => {
    onChange({
      ...value,
      [key]: { items: [...(value[key]?.items || []), chaItem()] },
    })
  }

  const updateItem = (key: ChaBlockKey, idx: number, patch: Partial<ChaItem>) => {
    onChange({
      ...value,
      [key]: {
        items: (value[key]?.items || []).map((it, i) => (i === idx ? { ...it, ...patch } : it)),
      },
    })
  }

  const removeItem = (key: ChaBlockKey, idx: number) => {
    onChange({
      ...value,
      [key]: { items: (value[key]?.items || []).filter((_, i) => i !== idx) },
    })
  }

  return (
    <div className="space-y-2">
      {CHA_BLOCK_KEYS.map((key) => {
        const items = value[key]?.items || []
        const badIdx = key === 'atitudes' ? invalidAttitudes({ items }) : []
        return (
          <div key={key} className="border rounded-md p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                {CHA_BLOCK_META[key].label}
              </span>
              <button
                type="button"
                className="text-[11px] text-sky-600 hover:underline inline-flex items-center gap-0.5"
                onClick={() => addItem(key)}
              >
                <Plus className="w-3 h-3" />
                Adicionar
              </button>
            </div>
            <p className="text-[10px] text-slate-500">{CHA_BLOCK_META[key].hint}</p>
            {errors[key] && <p className="text-[11px] text-rose-600">{errors[key]}</p>}
            {items.length === 0 && (
              <p className="text-[11px] text-slate-400 italic">Nenhum requisito específico.</p>
            )}
            {items.map((it, idx) => (
              <div
                key={it.id || idx}
                className={`grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-1.5 items-center rounded p-1.5 ${
                  badIdx.includes(idx) ? 'bg-rose-50 border border-rose-200' : 'bg-slate-50'
                }`}
              >
                <Input
                  value={it.description}
                  onChange={(e) => updateItem(key, idx, { description: e.target.value })}
                  placeholder={
                    key === 'atitudes' ? 'Comportamento observável…' : CHA_BLOCK_META[key].hint
                  }
                  className="h-8 text-xs"
                />
                <div className="flex items-center gap-1">
                  <Switch
                    checked={it.required}
                    onCheckedChange={(v) => updateItem(key, idx, { required: v })}
                    aria-label="Obrigatório"
                  />
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {it.required ? 'Obrigatório' : 'Desejável'}
                  </span>
                </div>
                <Select
                  value={String(it.weight)}
                  onValueChange={(v) => updateItem(key, idx, { weight: Number(v) })}
                >
                  <SelectTrigger className="w-24 h-8 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((w) => (
                      <SelectItem key={w} value={String(w)}>
                        Peso {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  className="text-rose-600 hover:text-rose-700 p-1"
                  onClick={() => removeItem(key, idx)}
                  aria-label="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
