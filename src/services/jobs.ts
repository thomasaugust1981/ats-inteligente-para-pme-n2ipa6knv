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
    const updated = await pb.collection('jobs').update<Job>(id, payload)
    return this.normalizeStages(updated)
  },

  async deleteJob(id: string): Promise<boolean> {
    return await pb.collection('jobs').delete(id)
  },

  normalizeStages(job: Job): Job {
    let parsedStages: JobStage[] = DEFAULT_STAGES
    if (typeof job.stages === 'string') {
      try {
        parsedStages = JSON.parse(job.stages)
      } catch (_) {
        parsedStages = DEFAULT_STAGES
      }
    } else if (Array.isArray(job.stages)) {
      parsedStages = job.stages
    }
    return {
      ...job,
      stages: parsedStages,
    }
  },
}
