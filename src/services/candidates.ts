import pb from '@/lib/pocketbase/client'
import type { Candidate, Application, AuditLog, AuditAction } from '@/types/ats'

export const candidatesService = {
  async listCandidates(filter?: string, sort = '-created'): Promise<Candidate[]> {
    return await pb.collection('candidates').getFullList<Candidate>({
      filter,
      sort,
    })
  },

  async getCandidateById(id: string): Promise<Candidate> {
    return await pb.collection('candidates').getOne<Candidate>(id)
  },

  async createCandidate(data: FormData | Partial<Candidate>): Promise<Candidate> {
    return await pb.collection('candidates').create<Candidate>(data)
  },

  /**
   * Exclusão real LGPD: remove o registro do candidato, arquivo de currículo físico
   * e todas as candidaturas/vínculos associados.
   */
  async deleteCandidateRealLGPD(candidateId: string): Promise<boolean> {
    try {
      // 1. Remover candidaturas do candidato (cascadeDelete limpa na base também)
      const apps = await pb.collection('applications').getFullList({
        filter: `candidate_id = "${candidateId}"`,
      })
      for (const appItem of apps) {
        await pb.collection('applications').delete(appItem.id)
      }
      // 2. Excluir registro do candidato e seu arquivo
      await pb.collection('candidates').delete(candidateId)
      return true
    } catch (err) {
      console.error('Failed to permanently delete candidate under LGPD:', err)
      throw err
    }
  },

  getResumeUrl(candidate: Candidate): string | null {
    if (!candidate.resume) return null
    return pb.files.getURL(candidate, candidate.resume)
  },
}

export const applicationsService = {
  async listApplications(jobId?: string): Promise<Application[]> {
    const filter = jobId ? `job_id = "${jobId}"` : undefined
    return await pb.collection('applications').getFullList<Application>({
      filter,
      sort: '-created',
      expand: 'candidate_id,job_id',
    })
  },

  async getApplicationById(id: string): Promise<Application> {
    return await pb.collection('applications').getOne<Application>(id, {
      expand: 'candidate_id,job_id',
    })
  },

  async getCandidateApplications(candidateId: string): Promise<Application[]> {
    return await pb.collection('applications').getFullList<Application>({
      filter: `candidate_id = "${candidateId}"`,
      sort: '-created',
      expand: 'job_id',
    })
  },

  async createApplication(data: Partial<Application>): Promise<Application> {
    return await pb.collection('applications').create<Application>({
      status: 'active',
      stage_updated_at: new Date().toISOString(),
      ...data,
    })
  },

  async updateStage(
    applicationId: string,
    toStage: string,
    fromStage?: string,
    reason?: string,
    comment?: string,
  ): Promise<Application> {
    const user = pb.authStore.record
    const currentApp = await pb.collection('applications').getOne<Application>(applicationId)

    const isRejected = toStage === 'rejected'
    const isHired = toStage === 'hired'

    const updatePayload: Partial<Application> = {
      stage_id: toStage,
      status: isRejected ? 'rejected' : isHired ? 'hired' : 'active',
      stage_updated_at: new Date().toISOString(),
    }

    if (isRejected && reason) {
      updatePayload.rejection_reason = reason
    }
    if (comment) {
      updatePayload.rejection_note = comment
    }

    const updated = await pb
      .collection('applications')
      .update<Application>(applicationId, updatePayload)

    // Gravar log de auditoria
    const action: AuditAction = isRejected
      ? 'candidate_rejected'
      : isHired
        ? 'candidate_hired'
        : 'stage_changed'

    await auditService.createLog({
      application_id: applicationId,
      candidate_id: currentApp.candidate_id,
      user_id: user?.id,
      user_name: user?.name || user?.email || 'Sistema',
      user_role: (user?.role as string) || 'recruiter',
      action,
      from_stage: fromStage || currentApp.stage_id,
      to_stage: toStage,
      reason: reason || undefined,
      details: [
        `Candidato movido de "${fromStage || currentApp.stage_id}" para "${toStage}".`,
        comment ? `Comentário da avaliação: ${comment}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    })

    return updated
  },
}

export const auditService = {
  async listLogsForCandidate(candidateId: string): Promise<AuditLog[]> {
    return await pb.collection('audit_logs').getFullList<AuditLog>({
      filter: `candidate_id = "${candidateId}"`,
      sort: '-created',
    })
  },

  async listLogsForApplication(applicationId: string): Promise<AuditLog[]> {
    return await pb.collection('audit_logs').getFullList<AuditLog>({
      filter: `application_id = "${applicationId}"`,
      sort: '-created',
    })
  },

  async createLog(data: Partial<AuditLog>): Promise<AuditLog> {
    return await pb.collection('audit_logs').create<AuditLog>(data)
  },

  async recordResumeView(candidateId: string, applicationId?: string): Promise<void> {
    const user = pb.authStore.record
    if (!user) return
    try {
      await pb.collection('audit_logs').create({
        candidate_id: candidateId,
        application_id: applicationId || null,
        user_id: user.id,
        user_name: user.name || user.email,
        user_role: user.role || 'recruiter',
        action: 'viewed_resume',
        details: 'Visualização completa do currículo em PDF pelo recrutador/gestor.',
      })
    } catch (err) {
      console.warn('Failed to register audit log for resume view:', err)
    }
  },
}
