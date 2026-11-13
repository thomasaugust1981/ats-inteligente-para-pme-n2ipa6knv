import pb from '@/lib/pocketbase/client'
import type { Job, JobStage } from '@/types/ats'

export const DEFAULT_STAGES: JobStage[] = [
  { id: 'applied', label: 'Inscrição', color: '#64748b' },
  { id: 'screening', label: 'Triagem', color: '#3b82f6' },
  { id: 'interview_hr', label: 'Entrevista RH', color: '#8b5cf6' },
  { id: 'tech_interview', label: 'Entrevista Técnica', color: '#06b6d4' },
  { id: 'proposal', label: 'Proposta', color: '#f59e0b' },
  { id: 'hired', label: 'Contratado', color: '#10b981' },
  { id: 'rejected', label: 'Reprovado', color: '#ef4444' },
]

/** Etapas opcionais que podem ser ligadas por vaga (JSON `optional_stages` em jobs). */
export const OPTIONAL_STAGE_DEFS: Record<string, JobStage> = {
  disc: { id: 'disc', label: 'DISC', color: '#a855f7' },
  cultural_fit: { id: 'cultural_fit', label: 'FIT Cultural', color: '#14b8a6' },
  executive_validation: {
    id: 'executive_validation',
    label: 'Validação Executiva',
    color: '#e11d48',
  },
}

/**
 * Insere as etapas opcionais no fluxo base:
 * - `disc` logo após `screening`
 * - `cultural_fit` antes de `tech_interview`
 * - `executive_validation` antes de `proposal` (somente para vagas de alto impacto)
 */
export function mergeOptionalStages(
  base: JobStage[],
  optionalIds: string[] | string | null | undefined,
  highImpact: boolean,
): JobStage[] {
  let selected: string[] = []
  if (typeof optionalIds === 'string') {
    try {
      const parsed = JSON.parse(optionalIds)
      if (Array.isArray(parsed)) selected = parsed
    } catch (_) {
      selected = []
    }
  } else if (Array.isArray(optionalIds)) {
    selected = optionalIds
  }
  const has = (id: string) => selected.includes(id)
  const def = (id: string) => OPTIONAL_STAGE_DEFS[id]
  const out: JobStage[] = []
  const push = (stage: JobStage) => {
    if (stage && !out.some((s) => s.id === stage.id)) out.push(stage)
  }

  for (const stage of base) {
    if (stage.id === 'tech_interview' && has('cultural_fit')) push(def('cultural_fit'))
    if (stage.id === 'proposal' && has('executive_validation') && highImpact)
      push(def('executive_validation'))
    push(stage)
    if (stage.id === 'screening' && has('disc')) push(def('disc'))
  }
  return out
}

export const jobsService = {
  async listJobs(filter?: string, sort = '-created'): Promise<Job[]> {
    const records = await pb.collection('jobs').getFullList<Job>({
      filter,
      sort,
      expand: 'manager_id,created_by',
    })
    return records.map(this.normalizeStages)
  },

  async getPublishedJobs(): Promise<Job[]> {
    return this.listJobs("status = 'published'")
  },

  async getJobById(id: string): Promise<Job> {
    const job = await pb.collection('jobs').getOne<Job>(id, {
      expand: 'manager_id,created_by',
    })
    return this.normalizeStages(job)
  },

  async getJobBySlug(slug: string): Promise<Job | null> {
    try {
      const job = await pb.collection('jobs').getFirstListItem<Job>(`slug = "${slug}"`, {
        expand: 'manager_id,created_by',
      })
      return this.normalizeStages(job)
    } catch (_) {
      return null
    }
  },

  async createJob(data: Partial<Job>): Promise<Job> {
    const payload = {
      ...data,
      stages:
        typeof data.stages === 'string'
          ? data.stages
          : JSON.stringify(data.stages || DEFAULT_STAGES),
      optional_stages:
        data.optional_stages && !Array.isArray(data.optional_stages)
          ? data.optional_stages
          : JSON.stringify(data.optional_stages || []),
      created_by: pb.authStore.record?.id,
    }
    const created = await pb.collection('jobs').create<Job>(payload)
    return this.normalizeStages(created)
  },

  async updateJob(id: string, data: Partial<Job>): Promise<Job> {
    const payload: Record<string, unknown> = { ...data }
    if (data.stages && typeof data.stages !== 'string') {
      payload.stages = JSON.stringify(data.stages)
    }
    if (data.optional_stages && Array.isArray(data.optional_stages)) {
      payload.optional_stages = JSON.stringify(data.optional_stages)
    }
    const updated = await pb.collection('jobs').update<Job>(id, payload)
    return this.normalizeStages(updated)
  },

  async deleteJob(id: string): Promise<boolean> {
    return await pb.collection('jobs').delete(id)
  },

  normalizeStages(job: Job): Job {
    let parsedStages: JobStage[] | null = null
    if (typeof job.stages === 'string') {
      try {
        parsedStages = JSON.parse(job.stages)
      } catch (_) {
        parsedStages = null
      }
    } else if (Array.isArray(job.stages)) {
      parsedStages = job.stages
    }
    if (!Array.isArray(parsedStages) || parsedStages.length === 0) {
      parsedStages = DEFAULT_STAGES
    }
    return {
      ...job,
      stages: mergeOptionalStages(parsedStages, job.optional_stages, Boolean(job.high_impact)),
    }
  },
}
