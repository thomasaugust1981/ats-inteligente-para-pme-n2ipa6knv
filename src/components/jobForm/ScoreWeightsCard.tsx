import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/components/jobForm/FieldError'
import { useAiAgentSettings } from '@/hooks/use-ai-agent-settings'
import type { JobFormValues, JobFormErrors, SetJobFormField } from '@/components/jobForm/types'

// Sub-seção "Aspectos de avaliação" do cadastro de vaga: régua de pesos
// (técnico/comportamental/cultural) usada pelo agente de score de IA.
// Toggle desligado = a vaga herda a régua global de /agente-score (campos null).
// Ligado = os três pesos são obrigatórios e precisam somar 100.
// Configuração da vaga: recrutador e gestor podem ajustar (a global segue só admin).

interface ScoreWeightsCardProps {
  values: JobFormValues
  errors: JobFormErrors
  onField: SetJobFormField
}

/** Soma dos três pesos informados (ignora vazios = 0). */
export function weightsSum(
  values: Pick<JobFormValues, 'weightTechnical' | 'weightBehavioral' | 'weightCultural'>,
): number {
  const toNum = (v: string) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return (
    toNum(values.weightTechnical) + toNum(values.weightBehavioral) + toNum(values.weightCultural)
  )
}

export function ScoreWeightsCard({ values, errors, onField }: ScoreWeightsCardProps) {
  const { settings: global } = useAiAgentSettings()
  const sum = weightsSum(values)

  const handleToggle = (checked: boolean) => {
    onField('useCustomWeights', checked)
    // Ao ligar, pré-preenche com a régua global como ponto de partida.
    if (checked) {
      if (!values.weightTechnical) onField('weightTechnical', String(global.weight_technical))
      if (!values.weightBehavioral) onField('weightBehavioral', String(global.weight_behavioral))
      if (!values.weightCultural) onField('weightCultural', String(global.weight_cultural))
    }
  }

  const fields: Array<{
    field: 'weightTechnical' | 'weightBehavioral' | 'weightCultural'
    label: string
  }> = [
    { field: 'weightTechnical', label: 'Técnico' },
    { field: 'weightBehavioral', label: 'Comportamental' },
    { field: 'weightCultural', label: 'Cultural' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="use-custom-weights" className="text-sm font-medium">
            Usar régua própria da vaga
          </Label>
          <p className="text-xs text-slate-500 max-w-md">
            Quando desligado, o score de IA usa a régua global configurada em{' '}
            <span className="font-medium">/agente-score</span> (técnica {global.weight_technical}% ·
            comportamental {global.weight_behavioral}% · cultural {global.weight_cultural}%).
          </p>
        </div>
        <Switch
          id="use-custom-weights"
          checked={values.useCustomWeights}
          onCheckedChange={handleToggle}
        />
      </div>

      {values.useCustomWeights && (
        <div className="space-y-3 rounded-lg border bg-slate-50/60 p-4">
          <div className="grid grid-cols-3 gap-3">
            {fields.map(({ field, label }) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={field} className="text-xs">
                  Peso {label} (%)
                </Label>
                <Input
                  id={field}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  inputMode="numeric"
                  value={values[field]}
                  onChange={(e) => onField(field, e.target.value)}
                  placeholder="0"
                />
                <FieldError message={errors[field]} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Soma atual:{' '}
              <span
                className={`font-semibold tabular-nums ${sum === 100 ? 'text-emerald-700' : 'text-amber-700'}`}
              >
                {sum}%
              </span>{' '}
              de 100%
            </p>
            <FieldError message={errors.weightsSum} />
          </div>
        </div>
      )}
    </div>
  )
}

export default ScoreWeightsCard
