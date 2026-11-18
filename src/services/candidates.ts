import pb from '@/lib/pocketbase/client'
import { withFreshToken } from '@/lib/pocketbase/freshToken'
import type { Candidate, Application, AuditLog, AuditAction } from '@/types/ats'

/**
 * Anonimiza os logs de auditoria que casam com o filtro (decisão de produto do
 * hook lgpd_delete: apagar destruiria a auditoria do processo; manter guardaria
 * dados pessoais). Cada log perde o conteúdo pessoal (details/reason, vínculos
 * com application/candidate, stages) e passa a dizer "candidato removido via
 * LGPD", mantendo data e AUTOR (membro da equipe, não o titular).
 * Falhas individuais não interrompem a exclusão.
 */
async function anonymizeAuditLogs(filter: string): Promise<void> {
  try {
    const logs = await pb.collection('audit_logs').getFullList<AuditLog>({ filter })
    for (const log of logs) {
      try {
        await withFreshToken(() =>
          pb.collection('audit_logs').update(log.id, {
            action: 'candidate_deleted',
            application_id: null,
            candidate_id: null,
            from_stage: '',
            to_stage: '',
            reason: 'candidato removido via LGPD',
            details: 'candidato removido via LGPD',
          }),
        )
      } catch (err) {
        console.warn('[lgpd] falha ao anonimizar audit_log:', err)
      }
    }
  } catch (_) {
    // sem permissão de leitura/logs — segue a exclusão
  }
}

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
   * Exclusão real LGPD: caminho crítico pela API PADRÃO do PocketBase, com
   * withFreshToken (token stale → authRefresh + retry — o PocketBase responde
   * 404 "resource wasn't found" quando o token venceu e a regra esconde o
   * registro; padrão provado no fix do menu v0.0.84).
   *
   * Reproduz, no cliente, a cascata do hook lgpd_delete (Grupo 3 da auditoria):
   * apaga candidaturas e, por dependência, scores de IA (com snapshot),
   * fichas CHA e resultados DISC; ANONIMIZA a trilha de auditoria do titular
   * (ação "candidate_deleted", detalhes "candidato removido via LGPD",
   * mantendo data/autor); grava o registro de conformidade; e por fim apaga o
   * candidato (o delete do registro remove o arquivo de currículo junto —
   * candidates.resume é campo file). Mantém isolamento multi-empresa: só
   * toca em registros da própria org (regras da API garantem o mesmo).
   *
   * O hook DELETE /backend/v1/candidates/{id}/lgpd continua no backend para
   * chamadas externas, mas o frontend NÃO depende mais dele.
   */
  async deleteCandidateRealLGPD(
    candidateId: string,
  ): Promise<{ ok: boolean; deleted: Record<string, number> }> {
    const user = pb.authStore.record as (Record<string, unknown> & { org_id?: string }) | null
    if (!pb.authStore.isValid || !user?.id) {
      throw new Error('Autenticação necessária.')
    }
    const deleted: Record<string, number> = {
      applications: 0,
      ai_scores: 0,
      disc_results: 0,
      cha_evaluations: 0,
    }

    // Carrega o candidato (404 aqui = token stale OU candidato de outra org —
    // o retry de withFreshToken resolve o primeiro caso).
    const candidate = await withFreshToken(() =>
      pb.collection('candidates').getOne<Candidate>(candidateId),
    )

    // ---- 1. Candidaturas do titular --------------------------------------
    const apps = await withFreshToken(() =>
      pb.collection('applications').getFullList<Application>({
        filter: `candidate_id = "${candidateId}"`,
      }),
    )

    // ---- 2. Registros ligados a cada candidatura -------------------------
    for (const app of apps) {
      for (const [collection, filterField] of [
        ['ai_scores', 'application_id'],
        ['cha_evaluations', 'application_id'],
        ['disc_results', 'application_id'],
      ] as const) {
        const rows = await pb
          .collection(collection)
          .getFullList({ filter: `${filterField} = "${app.id}"` })
        for (const row of rows) {
          await pb.collection(collection).delete(row.id)
          deleted[collection] = (deleted[collection] || 0) + 1
        }
      }
      // Logs de auditoria da candidatura — anonimizados (não apagados).
      await anonymizeAuditLogs(`application_id = "${app.id}"`)
    }

    // ---- 3. Registros ligados direto ao candidato ------------------------
    const directScores = await pb
      .collection('ai_scores')
      .getFullList({ filter: `candidate_id = "${candidateId}"` })
    for (const row of directScores) {
      await pb.collection('ai_scores').delete(row.id)
      deleted.ai_scores += 1
    }
    await anonymizeAuditLogs(`candidate_id = "${candidateId}"`)

    // ---- 4. Registro de conformidade na trilha ---------------------------
    try {
      await pb.collection('audit_logs').create({
        org_id: (candidate as unknown as { org_id?: string }).org_id || user.org_id || '',
        user_id: user.id,
        user_name: String(user.name || user.email || 'Equipe'),
        user_role: String(user.role || 'recruiter'),
        action: 'candidate_deleted',
        details:
          'Registro de conformidade LGPD: exclusão executada em ' +
          new Date().toISOString() +
          '. Dados pessoais, currículo, scores de IA, DISC e fichas CHA removidos; trilha anterior anonimizada.',
      })
    } catch (_) {
      // nunca bloqueia a exclusão por falha de log
    }

    // ---- 5. Candidaturas --------------------------------------------------
    for (const app of apps) {
      await pb.collection('applications').delete(app.id)
      deleted.applications += 1
    }

    // ---- 6. O candidato: o delete do registro remove o arquivo físico de
    //        currículo (candidates.resume, campo file) junto ---------------
    await withFreshToken(() => pb.collection('candidates').delete(candidateId))

    return { ok: true, deleted }
  },

  getResumeUrl(candidate: Candidate): string | null {
    if (!candidate.resume) return null
    return pb.files.getURL(candidate, candidate.resume)
  },
}

export const applicationsService = {
  /**
   * Recebe um FILTRO PocketBase pronto (não um id de vaga): os chamadores montam
   * a condição — ex. `job_id = "..."` (vaga específica no pipeline) ou
   * `job_id.company_id = "..."` (empresa ativa no painel). Passar o filtro cru
   * evita interpolação dupla, que gerava `job_id = "job_id.company_id = ..."`
   * e um 400 do servidor (bug corrigido em v0.0.107).
   */
  async listApplications(filter?: string): Promise<Application[]> {
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

  /**
   * Candidatura pública (C1): UMA chamada multipart para a rota custom do
   * backend (hook application_dedupe — POST /backend/v1/applications/apply).
   * O servidor resolve o vínculo por e-mail dentro da org da vaga: cria o
   * candidato com consentimento LGPD datado quando o e-mail é novo, ou apenas
   * VINCULA a candidatura ao cadastro existente sem alterá-lo. O cliente
   * anônimo nunca lê nem atualiza candidates diretamente.
   * Campos enviados: job_id, stage_id, status, source (top-level), um JSON
   * "dedupe" com todos os dados do formulário + consentimento, e o "resume".
   */
  async createWithDedupe(formData: FormData): Promise<{
    ok: boolean
    outcome: string
    linked: boolean
    candidate_id: string
    application_id: string
  }> {
    // O hook lê job_id/stage_id/status/source do JSON "dedupe" — garante que
    // estejam lá mesmo que a página os tenha anexado apenas no top-level.
    const dedupeRaw = String(formData.get('dedupe') || '{}')
    let dedupe: Record<string, unknown> = {}
    try {
      dedupe = JSON.parse(dedupeRaw)
    } catch (_) {
      dedupe = {}
    }
    for (const key of ['job_id', 'stage_id', 'status', 'source']) {
      const top = formData.get(key)
      if (top != null && String(top) && !(key in dedupe)) {
        dedupe[key] = String(top)
      }
    }
    formData.set('dedupe', JSON.stringify(dedupe))

    const res = await fetch(`${pb.buildUrl('')}/backend/v1/applications/apply`, {
      method: 'POST',
      body: formData,
    })
    const payload = await res.json().catch(() => null)

    if (!res.ok || !payload?.ok) {
      const message =
        payload?.message ||
        (res.status === 404
          ? 'Vaga não encontrada ou não está mais aceitando candidaturas.'
          : 'Não foi possível registrar sua candidatura. Tente novamente.')
      throw new Error(message)
    }

    return {
      ok: !!payload.ok,
      outcome: String(payload.outcome || 'linked_created'),
      linked: !!payload.linked,
      candidate_id: String(payload.candidate_id || ''),
      application_id: String(payload.application_id || ''),
    }
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
    const user = pb.authStore.record as (Record<string, unknown> & { org_id?: string }) | null
    return await pb.collection('audit_logs').create<AuditLog>({
      org_id: user?.org_id || '',
      ...data,
    })
  },

  async recordResumeView(candidateId: string, applicationId?: string): Promise<void> {
    const user = pb.authStore.record
    if (!user) return
    try {
      await pb.collection('audit_logs').create({
        org_id: (user as { org_id?: string }).org_id || '',
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
