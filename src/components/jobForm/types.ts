import type { JobStatus, WorkplaceType, EmploymentType, SeniorityLevel } from '@/types/ats'

/** Campos de dados da vaga mantidos no formulário. */
export interface JobFormValues {
  title: string
  slug: string
  department: string
  location: string
  workplaceType: WorkplaceType
  employmentType: EmploymentType
  seniority: SeniorityLevel
  salaryMin: string
  salaryMax: string
  salaryDisclosed: boolean
  status: JobStatus
  managerId: string
  description: string
  requirements: string
  benefits: string
}

/** Erros de validação por campo (mensagem em pt-BR exibida junto ao campo). */
export type JobFormErrors = Record<string, string>

/** Setter genérico: mantém os tipos corretos de cada campo. */
export type SetJobFormField = <K extends keyof JobFormValues>(
  field: K,
  value: JobFormValues[K],
) => void
