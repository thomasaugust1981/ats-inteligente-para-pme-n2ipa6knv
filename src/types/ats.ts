export type UserRole = 'admin' | 'recruiter' | 'manager'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  company_name?: string
  avatar?: string
  created: string
  updated: string
}

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

export interface Company {
  id: string
  name: string
  trade_name?: string
  description?: string
  logo?: string
  website?: string
  city?: string
  state?: string
  brand_color?: string
  onboarding_status?: OnboardingStatus
  created: string
  updated: string
}

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
  manager_id?: string
  created_by?: string
  expand?: {
    manager_id?: User
    created_by?: User
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
  notes?: string
  resume_structured?: StructuredResume | null
  resume_source?: ResumeSource | null
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
  expand?: {
    candidate_id?: Candidate
    job_id?: Job
  }
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
