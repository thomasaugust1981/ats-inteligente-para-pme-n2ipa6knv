import React from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { FieldError } from './FieldError'
import { OPTIONAL_STAGE_DEFS } from '@/services/jobs'
import type { JobStage } from '@/types/ats'
import type { JobFormErrors } from './types'

interface StagesCardProps {
  stages: JobStage[]
  highImpact: boolean
  optionalStages: string[]
  errors: JobFormErrors
  onAddStage: () => void
  onUpdateStage: (index: number, label: string) => void
  onRemoveStage: (index: number) => void
  onHighImpactChange: (checked: boolean) => void
  onToggleOptional: (stageId: string, checked: boolean) => void
}

/** Bloco 3: Etapas do processo — fluxo configurável + etapas opcionais agrupadas. */
export const StagesCard: React.FC<StagesCardProps> = ({
  stages,
  highImpact,
  optionalStages,
  errors,
  onAddStage,
  onUpdateStage,
  onRemoveStage,
  onHighImpactChange,
  onToggleOptional,
}) => (
  <div className="space-y-4">
    <div className="space-y-2">
      {stages.map((stage, idx) => (
        <div key={stage.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-md border">
          <GripVertical className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 w-6">#{idx + 1}</span>
          <Input
            value={stage.label}
            onChange={(e) => onUpdateStage(idx, e.target.value)}
            className="h-8 text-xs flex-1 bg-white"
          />
          <span className="text-[11px] font-mono text-slate-400 px-2">{stage.id}</span>
          {stage.id !== 'applied' && stage.id !== 'hired' && stage.id !== 'rejected' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-rose-500 hover:text-rose-700"
              onClick={() => onRemoveStage(idx)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>

    {/* Etapas opcionais — dependem/afetam o flag de alto impacto */}
    <div className="space-y-3 border-t pt-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Etapas opcionais</h3>
        <p className="text-[11px] text-slate-500">
          Ative avaliações complementares — elas entram automaticamente no fluxo acima, na posição
          indicada.
        </p>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
        <div className="space-y-0.5">
          <Label className="text-xs font-semibold">Vaga de alto impacto estratégico</Label>
          <p className="text-[11px] text-slate-500">
            Libera a Validação Executiva como etapa final desta vaga.
          </p>
        </div>
        <Switch checked={highImpact} onCheckedChange={onHighImpactChange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label
          className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
            optionalStages.includes('disc')
              ? 'border-purple-300 bg-purple-50'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <input
            type="checkbox"
            className="mt-0.5 accent-purple-600"
            checked={optionalStages.includes('disc')}
            onChange={(e) => onToggleOptional('disc', e.target.checked)}
          />
          <span>
            <span className="block text-xs font-semibold text-slate-900">
              {OPTIONAL_STAGE_DEFS.disc.label}
            </span>
            <span className="block text-[11px] text-slate-500">
              Perfil comportamental — após a Triagem.
            </span>
          </span>
        </label>

        <label
          className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
            optionalStages.includes('cultural_fit')
              ? 'border-teal-300 bg-teal-50'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <input
            type="checkbox"
            className="mt-0.5 accent-teal-600"
            checked={optionalStages.includes('cultural_fit')}
            onChange={(e) => onToggleOptional('cultural_fit', e.target.checked)}
          />
          <span>
            <span className="block text-xs font-semibold text-slate-900">
              {OPTIONAL_STAGE_DEFS.cultural_fit.label}
            </span>
            <span className="block text-[11px] text-slate-500">
              Aderência à visão e missão — antes da Entrevista Técnica.
            </span>
          </span>
        </label>

        <label
          className={`flex items-start gap-2.5 p-3 rounded-lg border transition ${
            optionalStages.includes('executive_validation')
              ? 'border-rose-300 bg-rose-50'
              : 'border-slate-200 bg-white'
          } ${!highImpact ? 'opacity-60' : 'cursor-pointer hover:bg-slate-50'}`}
        >
          <input
            type="checkbox"
            className="mt-0.5 accent-rose-600"
            disabled={!highImpact}
            checked={optionalStages.includes('executive_validation')}
            onChange={(e) => onToggleOptional('executive_validation', e.target.checked)}
          />
          <span>
            <span className="block text-xs font-semibold text-slate-900">
              {OPTIONAL_STAGE_DEFS.executive_validation.label}
            </span>
            <span className="block text-[11px] text-slate-500">
              {highImpact
                ? 'Etapa extra antes da Proposta, para decisões finais.'
                : 'Ative a opção "Vaga de alto impacto estratégico" acima para liberar.'}
            </span>
          </span>
        </label>
        <FieldError message={errors.executive_validation} />
      </div>
    </div>
  </div>
)
