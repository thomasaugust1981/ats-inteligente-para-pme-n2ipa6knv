import React, { useState } from 'react'
import { LayoutTemplate, Sparkles, Loader2, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CargoTemplate } from '@/lib/cargoTemplates'
import { CARGO_TEMPLATES } from '@/lib/cargoTemplates'

interface Props {
  /** true quando o formulário está criando um cargo novo e limpo. */
  isBlank: boolean
  disabled?: boolean
  suggestionLoading: boolean
  onApplyTemplate: (tpl: CargoTemplate) => void
  onSuggestAi: () => void
}

const brl = (v: number | null) =>
  v != null
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : null

/**
 * FASE 2 — escolha de "Começar de um modelo" + sugestão de CHA por IA.
 * Aparece apenas na criação de um cargo limpo; a edição nunca é afetada.
 */
export const CargoTemplatePicker: React.FC<Props> = ({
  isBlank,
  disabled,
  suggestionLoading,
  onApplyTemplate,
  onSuggestAi,
}) => {
  const [selectedId, setSelectedId] = useState('')
  const [previewId, setPreviewId] = useState('')
  const selected = CARGO_TEMPLATES.find((t) => t.id === selectedId) || null
  const preview = CARGO_TEMPLATES.find((t) => t.id === previewId) || null

  if (!isBlank) return null

  const handleApply = () => {
    if (!selected) return
    onApplyTemplate(selected)
    setSelectedId('')
    setPreviewId('')
  }

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3.5 space-y-3">
      <div className="flex items-start gap-2.5">
        <LayoutTemplate className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
        <div className="space-y-0.5 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Começar de um modelo pronto</p>
          <p className="text-[11px] text-slate-600">
            Escolha um cargo típico e o formulário vem preenchido com missão, faixa salarial
            sugerida e os três blocos CHA — tudo editável depois.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex-1 space-y-1">
          <Label htmlFor="cargo-template" className="sr-only">
            Modelo de cargo
          </Label>
          <Select
            value={selectedId}
            onValueChange={setSelectedId}
            onOpenChange={(o) => !o && setPreviewId('')}
            disabled={disabled || suggestionLoading}
          >
            <SelectTrigger id="cargo-template" className="bg-white">
              <SelectValue placeholder="Selecione o modelo (ex.: Vendedor de Loja)" />
            </SelectTrigger>
            <SelectContent>
              {CARGO_TEMPLATES.map((t) => (
                <SelectItem
                  key={t.id}
                  value={t.id}
                  onMouseEnter={() => setPreviewId(t.id)}
                  onFocus={() => setPreviewId(t.id)}
                >
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleApply}
          disabled={!selected || disabled || suggestionLoading}
          className="bg-sky-600 hover:bg-sky-700 text-white shrink-0"
        >
          Usar modelo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSuggestAi}
          disabled={suggestionLoading || disabled}
          title="A IA sugere os três blocos CHA a partir do título, área, nível e missão"
          className="shrink-0"
        >
          {suggestionLoading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
          )}
          {suggestionLoading ? 'Sugerindo…' : 'Sugerir CHA com IA'}
        </Button>
      </div>
      {preview && (
        <div className="rounded-md border border-sky-200 bg-white px-3 py-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {preview.area}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              Nível {preview.level}
            </Badge>
            {preview.salaryMin != null && preview.salaryMax != null && (
              <Badge variant="secondary" className="text-[10px]">
                Faixa sugerida: {brl(preview.salaryMin)} – {brl(preview.salaryMax)}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-slate-600">{preview.mission}</p>
          <p className="text-[11px] text-slate-500">
            {`${preview.cha.conhecimentos?.items.length || 0} conhecimentos · ${preview.cha.habilidades?.items.length || 0} habilidades · ${preview.cha.atitudes?.items.length || 0} atitudes`}
          </p>
        </div>
      )}
      <p className="text-[11px] text-slate-500 flex items-center gap-1">
        <Lightbulb className="w-3 h-3" />
        Valores de salário são sugestões de mercado PME — revise antes de salvar.
      </p>
    </div>
  )
}
