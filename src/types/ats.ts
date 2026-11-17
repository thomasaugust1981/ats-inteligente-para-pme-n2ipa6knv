import type { ErpIntegrationData } from '@/lib/erpIntegration'
import type { JobChaRequirements, ChaData } from '@/lib/cha'

export type UserRole = 'admin' | 'recruiter' | 'manager' | 'superadmin'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  company_name?: string
  avatar?: string
  org_id?: string
  company_id?: string
  created: string
  updated: string
}

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

export interface Company {
  id: string
  name: string
  trade_name?: string
  description?: string
  vision?: string
  mission?: string
  logo?: string
  website?: string
  city?: string
  state?: string
  brand_color?: string
  onboarding_status?: OnboardingStatus
  org_id?: string
  company_type?: CompanyType
  parent_id?: string
  created: string
  updated: string
}

/** Hierarquia multi-empresa: a matriz pode ter filiais. */
export type CompanyType = 'matriz' | 'filial'

export type TeamInviteStatus = 'pending' | 'accepted' | 'cancelled'

export interface TeamInvite {
  id: string
  email: string
  role: UserRole
  status: TeamInviteStatus
  invited_by?: string
  created: string
  updated: string
}

export type WorkplaceType = 'remote' | 'hybrid' | 'on_site'
export type EmploymentType = 'clt' | 'pj' | 'internship' | 'temporary'
export type SeniorityLevel = 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'specialist'
export type JobStatus = 'draft' | 'published' | 'paused' | 'closed'

export interface JobStage {
  id: string
  label: string
  color?: string
}

/**
 * FASE 1 do modelo CHA — Cargo da organização (coleção "cargos").
 * `cha` chega como string JSON do PocketBase e é normalizada pelo
 * cargosService (parseCha) antes de chegar à UI.
 *
 * FASE 2 (Organograma → Cargo → Vaga) — ciclo de aprovação e finalidade:
 *   • org_node_id: posição do organograma VIGENTE — obrigatória na criação,
 *     imutável depois (validado no hook cargo_server).
 *   • purpose: finalidade do cargo (ver CARGO_PURPOSES).
 *   • status: RASCUNHO → EM_APROVACAO → APROVADO | REPROVADO.
 *   • salary_defined: tem faixa salarial? (false = fora da base de custo de
 *     pessoal na fase de indicadores.)
 */
export type CargoPurpose = 'PREENCHIMENTO' | 'ESTRUTURAL' | 'SUCCESSAO' | 'PROMOCAO'
export type CargoStatus = 'RASCUNHO' | 'EM_APROVACAO' | 'APROVADO' | 'REPROVADO'

export const CARGO_PURPOSES: { value: CargoPurpose; label: string; hint: string }[] = [
  {
    value: 'PREENCHIMENTO',
    label: 'Preenchimento imediato',
    hint: 'Haverá recrutamento em seguida — o cargo gera vaga.',
  },
  {
    value: 'ESTRUTURAL',
    label: 'Estrutural / planejamento',
    hint: 'O cargo existe na estrutura, sem vaga agora.',
  },
  {
    value: 'SUCCESSAO',
    label: 'Sucessão',
    hint: 'Vinculado a um plano de sucessão.',
  },
  {
    value: 'PROMOCAO',
    label: 'Promoção interna',
    hint: 'Vinculado a um colaborador existente.',
  },
]

export const CARGO_STATUS_META: Record<CargoStatus, { label: string; className: string }> = {
  RASCUNHO: { label: 'Rascunho', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  EM_APROVACAO: {
    label: 'Em aprovação',
    className: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  APROVADO: { label: 'Aprovado', className: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  REPROVADO: { label: 'Reprovado', className: 'bg-rose-50 text-rose-700 border-rose-300' },
}

export interface CargoApprovalEntry {
  id: string
  cargo_id?: string
  cargo_title?: string
  step: string
  decision: string
  from_status?: string
  to_status?: string
  from_value?: string
  to_value?: string
  comment?: string
  user_name?: string
  user_role?: string
  user_id?: string
  org_id?: string
  created: string
}

export interface Cargo {
  id: string
  title: string
  area?: string
  level?: 'junior' | 'pleno' | 'senior'
  mission?: string
  salary_min?: number | null
  salary_med?: number | null
  salary_max?: number | null
  cha: ChaData | null
  org_id?: string
  // FASE 2 — posição do organograma + ciclo de aprovação
  org_node_id?: string
  purpose?: CargoPurpose | ''
  status?: CargoStatus | ''
  created_by?: string
  created_by_role?: string
  created_by_id?: string
  submitted_at?: string
  approved_by?: string
  approved_by_role?: string
  approved_at?: string
  rejection_reason?: string
  rejected_by?: string
  rejected_by_role?: string
  salary_defined?: boolean
  created: string
  updated: string
}

/** Configuração de responsável/notificações de uma etapa de uma vaga. */
export interface StageSetting {
  id: string
  job_id: string
  stage_id: string
  owner_user_id?: string
  owner_email?: string
  reminder_enabled?: boolean
  reminder_days?: number
  created: string
  updated: string
}

export interface Job {
  id: string
  title: string
  slug: string
  description: string
  department?: string
  location?: string
  workplace_type: WorkplaceType
  employment_type: EmploymentType
  seniority: SeniorityLevel
  requirements?: string
  benefits?: string
  salary_min?: number
  salary_max?: number
  salary_disclosed?: boolean
  status: JobStatus
  stages?: string | JobStage[] // JSON string in PB, or parsed array in app
  high_impact?: boolean
  optional_stages?: string | string[] // JSON string in PB, or parsed array in app
  // Pesos de avaliação próprios da vaga (régua do score de IA); null = herda a global
  weight_technical?: number | null
  weight_behavioral?: number | null
  weight_cultural?: number | null
  // FASE 1 CHA: cargo vinculado + requisitos efetivos (JSON no PB)
  cargo_id?: string
  cha_requirements?: string | JobChaRequirements | null
  // FASE 3: vínculo direto cargo → vaga (herança de posição do organograma)
  org_node_id?: string
  organograma_version_id?: string
  manager_name?: string
  cost_center?: string
  extra_requirements?: string
  headcount?: number | null
  deadline?: string
  urgent?: boolean
  opened_at?: string
  opened_by?: string
  opened_by_id?: string
  cargo_snapshot?: string | Record<string, unknown> | null
  organograma_snapshot?: string | Record<string, unknown> | null
  manager_id?: string
  created_by?: string
  company_id?: string
  expand?: {
    manager_id?: User
    created_by?: User
    cargo_id?: Cargo
  }
  created: string
  updated: string
}

export type CandidateAvailability = 'immediate' | 'two_weeks' | 'one_month' | 'exploring'

/** Modelo padrão de currículo estruturado (extraído por IA ou preenchido manualmente). */
export interface StructuredExperience {
  title: string
  company: string
  start_date: string
  end_date: string
  current: boolean
  description: string
}

export interface StructuredEducation {
  degree: string
  institution: string
  start_date: string
  end_date: string
  status: string
}

export interface StructuredResume {
  name: string
  email: string
  phone: string
  location: string
  linkedin: string
  summary: string
  skills: string[]
  experiences: StructuredExperience[]
  education: StructuredEducation[]
  languages: string[]
  courses: string[]
}

export type ResumeSource = 'ai_extracted' | 'manual'

/** Estado do fluxo de leitura do currículo por IA na candidatura. */
export type ResumeReaderStatus = 'idle' | 'reading' | 'review' | 'failed' | 'manual'

export interface Candidate {
  id: string
  name: string
  email: string
  phone?: string
  cpf?: string
  linkedin?: string
  location?: string
  seniority?: SeniorityLevel
  skills?: string
  availability?: CandidateAvailability
  resume?: string
  lgpd_consent: boolean
  lgpd_consent_date: string
  lgpd_consent_version: string
  company_id?: string
  notes?: string
  resume_structured?: StructuredResume | null
  resume_source?: ResumeSource | null
  /** Dados admissionais coletados pelo RH na etapa "Integração ERP" (layout Goldway). */
  erp_data?: ErpIntegrationData | null
  created: string
  updated: string
}

export type ApplicationStatus = 'active' | 'hired' | 'rejected' | 'withdrawn'
export type ApplicationSource =
  | 'google_for_jobs'
  | 'direct_link'
  | 'whatsapp'
  | 'referral'
  | 'linkedin'
  | 'other'
  | 'suggested'

export interface Application {
  id: string
  candidate_id: string
  job_id: string
  stage_id: string
  status: ApplicationStatus
  source: ApplicationSource
  rejection_reason?: string
  rejection_note?: string
  stage_updated_at?: string
  last_stage_reminder_at?: string
  expand?: {
    candidate_id?: Candidate
    job_id?: Job
  }
  disc_status?: string
  disc_profile?: string
  created: string
  updated: string
}

/** Resultado do formulário DISC (e FIT cultural) de uma candidatura, por token público. */
export interface DiscResult {
  id: string
  application_id: string
  token: string
  status?: 'pending' | 'completed' | string
  score_d?: number
  score_i?: number
  score_s?: number
  score_c?: number
  profile?: string
  fit_score?: number
  fit_note?: string
  completed_at?: string
  created: string
  updated: string
}

export type AuditAction =
  | 'viewed_resume'
  | 'stage_changed'
  | 'candidate_rejected'
  | 'candidate_hired'
  | 'note_added'
  | 'candidate_created'
  | 'candidate_deleted'
  | 'stage_owner_assigned'
  | 'evaluation_comment'
  | 'candidate_suggested'
  | 'interview_scheduled'

export interface AuditLog {
  id: string
  application_id?: string
  candidate_id?: string
  user_id?: string
  user_name?: string
  user_role?: string
  action: AuditAction
  from_stage?: string
  to_stage?: string
  reason?: string
  details?: string
  created: string
  updated: string
}
