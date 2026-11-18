/**
 * Modelos prontos de pipeline por tipo de vaga (FASE 2 da autoadoção).
 * Cada modelo pré-cria as etapas do funil — sempre editáveis depois.
 * "applied" (Inscrição) é sempre a etapa 1; as demais tentam reusar o id
 * padrão de mesmo nome (screening/interview_hr/tech_interview/proposal),
 * o que preserva cor e reconhecimento no pipeline, e caem para id próprio
 * quando o modelo cria etapa nova (Entrevista, Painel de gestores…).
 */
import type { JobStage } from '@/types/ats'

export interface PipelineTemplate {
  id: 'operacional' | 'tecnico' | 'lideranca'
  label: string
  description: string
  /** Etapas após "Inscrição". `defaultId` liga à etapa padrão de mesmo nome. */
  steps: { defaultId?: string; label: string; color: string }[]
}

const C = {
  screening: '#3b82f6',
  interview_hr: '#8b5cf6',
  tech_interview: '#06b6d4',
  panel: '#a855f7',
  proposal: '#f59e0b',
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'operacional',
    label: 'Operacional',
    description: 'Triagem → Entrevista → Contratação. Processo enxuto para vagas de volume.',
    steps: [
      { defaultId: 'screening', label: 'Triagem', color: C.screening },
      { label: 'Entrevista', color: C.interview_hr },
      { label: 'Contratação', color: C.proposal },
    ],
  },
  {
    id: 'tecnico',
    label: 'Técnico / Especialista',
    description:
      'Triagem → Entrevista RH → Entrevista técnica → Proposta. Para vagas com avaliação técnica.',
    steps: [
      { defaultId: 'screening', label: 'Triagem', color: C.screening },
      { defaultId: 'interview_hr', label: 'Entrevista RH', color: C.interview_hr },
      { defaultId: 'tech_interview', label: 'Entrevista Técnica', color: C.tech_interview },
      { defaultId: 'proposal', label: 'Proposta', color: C.proposal },
    ],
  },
  {
    id: 'lideranca',
    label: 'Liderança',
    description:
      'Triagem → Entrevista RH → Painel de gestores → Proposta → Contratação. Para cargos de gestão.',
    steps: [
      { defaultId: 'screening', label: 'Triagem', color: C.screening },
      { defaultId: 'interview_hr', label: 'Entrevista RH', color: C.interview_hr },
      { label: 'Painel de gestores', color: C.panel },
      { defaultId: 'proposal', label: 'Proposta', color: C.proposal },
      { label: 'Contratação', color: C.proposal },
    ],
  },
]

/** Monta a lista de etapas (JobStage[]) do modelo: Inscrição + etapas do modelo. */
export const buildPipelineStages = (tpl: PipelineTemplate): JobStage[] => {
  const makeId = (step: { defaultId?: string }, idx: number) =>
    step.defaultId || `stage_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`
  return [
    { id: 'applied', label: 'Inscrição', color: '#64748b' },
    ...tpl.steps.map((step, idx) => ({
      id: makeId(step, idx),
      label: step.label,
      color: step.color,
    })),
  ]
}
