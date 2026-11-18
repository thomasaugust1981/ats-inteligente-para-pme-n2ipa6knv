import React from 'react'
import { Layers, Check, RotateCcw } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  PIPELINE_TEMPLATES,
  buildPipelineStages,
  type PipelineTemplate,
} from '@/lib/pipelineTemplates'
import type { JobStage } from '@/types/ats'

interface Props {
  /** true apenas na criação de vaga, antes de qualquer mudança nas etapas. */
  isBlank: boolean
  stages: JobStage[]
  onApplyStages: (stages: JobStage[]) => void
}

/**
 * FASE 2 — modelos de etapas de funil por tipo de vaga. Pré-criam as etapas
 * (sempre editáveis depois) e só aparecem na criação com etapas intactas.
 */
export const PipelineTemplatePicker: React.FC<Props> = ({ isBlank, stages, onApplyStages }) => {
  if (!isBlank) return null

  /** Compara ignorando ids gerados (stage_...): detecta se o usuário mexeu. */
  const sameShape = (tpl: PipelineTemplate) => {
    const labels = stages.map((s) => s.label)
    const want = ['Inscrição', ...tpl.steps.map((s) => s.label)]
    return (
      labels.length === want.length &&
      labels.every((l, i) => l.toLowerCase() === want[i].toLowerCase())
    )
  }

  const handlePick = (tpl: PipelineTemplate) => onApplyStages(buildPipelineStages(tpl))

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <Layers className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            Modelos de processo por tipo de vaga
          </p>
          <p className="text-[11px] text-slate-600">
            Escolha um modelo e as etapas do funil vêm criadas — depois edite, remova ou adicione
            como quiser.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {PIPELINE_TEMPLATES.map((tpl) => {
          const active = sameShape(tpl)
          return (
            <div
              key={tpl.id}
              className={`relative rounded-md border p-3 text-left transition cursor-pointer ${
                active
                  ? 'border-sky-500 bg-white ring-1 ring-sky-300'
                  : 'border-slate-200 bg-white hover:border-sky-300'
              }`}
              role="button"
              tabIndex={0}
              onClick={() => handlePick(tpl)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handlePick(tpl)}
            >
              {active && (
                <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700">
                  {stages.length > 2 ? (
                    <RotateCcw className="w-3 h-3" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  {stages.length > 2 ? 'reaplicar' : 'em uso'}
                </span>
              )}
              <p className="text-xs font-semibold text-slate-900">{tpl.label}</p>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">{tpl.description}</p>
              <p className="text-[10px] text-slate-400 mt-2">
                {tpl.steps.map((s) => s.label).join(' · ')}
              </p>
            </div>
          )
        })}
      </div>
      <Label className="sr-only">Modelo de etapas de funil</Label>
    </div>
  )
}
