import React from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FieldError } from './FieldError'
import type { JobFormValues, JobFormErrors, SetJobFormField } from './types'

interface DescriptionCardProps {
  values: Pick<JobFormValues, 'description' | 'requirements' | 'benefits'>
  errors: JobFormErrors
  onField: SetJobFormField
}

/** Bloco 2: Descrição, pré-requisitos e benefícios (texto público da vaga). */
export const DescriptionCard: React.FC<DescriptionCardProps> = ({ values, errors, onField }) => (
  <div className="space-y-4">
    <div>
      <Label htmlFor="desc" className="text-xs font-semibold">
        Descrição do Cargo *
      </Label>
      <Textarea
        id="desc"
        rows={4}
        placeholder="Descreva as responsabilidades e o escopo da posição..."
        value={values.description}
        onChange={(e) => onField('description', e.target.value)}
        className="mt-1 text-sm"
        aria-invalid={Boolean(errors.description)}
      />
      <FieldError message={errors.description} />
    </div>

    <div>
      <Label htmlFor="req" className="text-xs font-semibold">
        Pré-requisitos e Qualificações
      </Label>
      <Textarea
        id="req"
        rows={4}
        placeholder="• Conhecimento em React e TypeScript&#10;• Experiência de 2+ anos&#10;• Ensino superior em andamento..."
        value={values.requirements}
        onChange={(e) => onField('requirements', e.target.value)}
        className="mt-1 text-sm"
      />
    </div>

    <div>
      <Label htmlFor="ben" className="text-xs font-semibold">
        Benefícios Oferecidos
      </Label>
      <Textarea
        id="ben"
        rows={3}
        placeholder="• Vale refeição / alimentação flexível&#10;• Plano de saúde sem coparticipação&#10;• Auxílio home office..."
        value={values.benefits}
        onChange={(e) => onField('benefits', e.target.value)}
        className="mt-1 text-sm"
      />
    </div>
  </div>
)
