//
// Hook application_dedupe — JSVM (PocketBase v0.23+). Complemento da migração
// 0023 (candidates sem list/view/update anônimos): resolve o vínculo
// candidatura→candidato no SERVIDOR, no momento do create de applications.
//
// O frontend público (JobApplicationPage) envia UMA requisição multipart para
// este endpoint com os dados do FORMULÁRIO — nunca toca em candidates
// diretamente (não pode ler, atualizar ou sobrescrever cadastros existentes).
// Aqui, dentro de uma transação:
//
//   1. Carrega a vaga e herda org_id/company_id dela.
//   2. Procura candidato existente por e-mail (lower/trim) na mesma org.
//   3. Encontrou → candidatura vinculada a esse candidato; NENHUM campo do
//      cadastro dele é sobrescrito (nome, telefone, CPF, currículo ficam
//      intactos). Retorna outcome 'linked_existing'.
//   4. Não encontrou → cria o candidato com os dados do formulário, incluindo
//      currículo e consentimento LGPD datado. Retorna 'linked_created'.
//   5. Cria a candidatura (applications) já vinculada, na primeira etapa da
//      vaga, e grava o log de auditoria da inscrição (audit_logs).
//
// Resposta JSON: { ok, outcome, candidate_id, application_id, linked }
//

routerAdd('POST /backend/v1/applications/apply', (e) => {
  const req = e.requestInfo()

  const form = {}
  try {
    const parsed = JSON.parse(String(req.body.dedupe || '{}'))
    Object.assign(form, parsed)
  } catch (_) {
    e.json(400, { message: 'Payload de candidatura inválido.' })
    return
  }

  const email = String(form.email || '')
    .trim()
    .toLowerCase()
  const name = String(form.name || '').trim()
  const jobId = String(form.job_id || '')

  if (!name || !email) {
    e.json(400, { message: 'Nome e e-mail são obrigatórios.' })
    return
  }

  const app = e.app

  // ---- 1. Resolver a vaga → organização/empresa ----------------------
  let job = null
  try {
    job = app.findRecordById('jobs', jobId)
  } catch (_) {
    job = null
  }
  if (!job) {
    e.json(404, { message: 'Vaga não encontrada.' })
    return
  }
  const orgId = String(job.get('org_id') || '')
  const companyId = String(job.get('company_id') || '')

  // A vaga precisa estar publicada para receber candidatura pública
  if (String(job.get('status') || '') !== 'published') {
    e.json(400, { message: 'Esta vaga não está mais aceitando candidaturas.' })
    return
  }

  // ---- 2. Procurar candidato existente por e-mail na MESMA org -------
  let existing = null
  try {
    existing = app.findFirstRecordByFilter('candidates', "email = {:email} && org_id = '{:org}'", {
      email: email,
      org: orgId,
    })
  } catch (_) {
    existing = null
  }

  let outcome = 'linked_created'
  let candidateId = ''
  let applicationId = ''
  let consentAt = String(form.lgpd_consent_date || '')

  try {
    app.runInTransaction(function () {
      if (existing) {
        // Vínculo puro — cadastro existente intocado. Nenhum campo dele é
        // atualizado (nome, telefone, CPF, currículo permanecem como estão).
        candidateId = existing.get('id')
        outcome = 'linked_existing'
      } else {
        // Novo candidato: cria com os dados do formulário (org herdada da vaga)
        const candidateData = {
          org_id: orgId,
          company_id: companyId,
          name: name,
          email: email,
          phone: String(form.phone || '').trim(),
          cpf: String(form.cpf || '').trim(),
          linkedin: String(form.linkedin || '').trim(),
          location: String(form.location || '').trim(),
          seniority: String(form.seniority || '').trim(),
          skills: String(form.skills || '').trim(),
          availability: String(form.availability || '').trim(),
          lgpd_consent: true,
          lgpd_consent_date: consentAt,
          lgpd_consent_version: String(form.lgpd_consent_version || 'LGPD-v1.0-2025'),
          resume_source: String(form.resume_source || '').trim(),
        }

        const resume = req.body.resume
        if (resume) {
          candidateData.resume = resume
        }

        if (form.resume_structured) {
          candidateData.resume_structured = form.resume_structured
        }

        const newCand = app.recordCreate('candidates', candidateData)
        candidateId = newCand.get('id')
        outcome = 'linked_created'
      }

      // ---- 3. Criar a candidatura já vinculada ------------------------
      const stagesJson = String(job.get('stages') || '[]')
      let stages = []
      try {
        stages = JSON.parse(stagesJson) || []
      } catch (_) {
        stages = []
      }
      const initialStageId =
        String(form.stage_id || '') || (stages.length > 0 ? String(stages[0].id) : 'applied')

      const newApp = app.recordCreate('applications', {
        org_id: orgId,
        job_id: jobId,
        candidate_id: candidateId,
        stage_id: initialStageId,
        status: 'active',
        source: String(form.source || 'direct_link'),
        stage_updated_at: consentAt,
      })
      applicationId = newApp.get('id')

      // ---- 4. Log de auditoria da inscrição ---------------------------
      try {
        app.recordCreate('audit_logs', {
          org_id: orgId,
          application_id: applicationId,
          candidate_id: candidateId,
          action: 'candidate_created',
          user_name: name,
          user_role: 'candidato',
          details:
            'Candidatura submetida via canal: ' +
            String(form.source || 'direct_link') +
            (outcome === 'linked_existing'
              ? '. Candidatura vinculada a cadastro existente (e-mail já registrado).'
              : '. Novo candidato criado com consentimento LGPD datado.'),
        })
      } catch (_) {
        // Log de auditoria não deve bloquear a candidatura
      }
    })
  } catch (err) {
    e.json(400, {
      message: (err && String(err.message || err)) || 'Não foi possível registrar a candidatura.',
    })
    return
  }

  e.json(200, {
    ok: true,
    outcome: outcome,
    linked: outcome === 'linked_existing',
    candidate_id: candidateId,
    application_id: applicationId,
  })
})
