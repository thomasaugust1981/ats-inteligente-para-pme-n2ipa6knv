//
// Exclusão LGPD completa do candidato — rota custom (Grupo 3 da auditoria
// docs/auditoria-ats-2026-11.md, item C3).
//
// A exclusão anterior era client-side (candidatesService.deleteCandidateRealLGPD):
// apagava applications + candidates e deixava para trás ai_scores, disc_results,
// cha_evaluations e audit_logs com dados pessoais do titular — violando a
// promessa do produto ("exclusão real ... conforme LGPD").
//
// Decisão de PRODUTO sobre a trilha de auditoria: apagar audit_logs destruiria a
// função de auditoria do processo seletivo (quem contratou, quando, por quê);
// mantê-los intactos guardaria dados pessoais. Decidido: ANONIMIZAR — cada log
// do titular perde o conteúdo pessoal (details/reason, vínculos com
// application/candidate, stages) e passa a dizer "candidato removido via LGPD",
// mantendo data e AUTOR (user_id/user_name/user_role são de membros da equipe,
// não do titular). Um registro único de conformidade resume a operação.
//
// Coleções tocadas (relation → candidates no schema real):
//   apaga:   applications e, por dependência, os registros delas em
//            ai_scores (scores + snapshots pessoais), cha_evaluations,
//            disc_results (application_id é TEXTO, não relation) e
//            audit_logs (anonimizados); ai_scores por candidato direto;
//            candidates (cadastro inteiro: contato, resume_structured, erp_data)
//   arquivo: candidates.resume (PDF) — removido junto do registro
//
// IMPORTANTE JSVM: callbacks rodam em pool separado — TODA a lógica fica DENTRO
// do callback da rota (sem funções top-level, sem closures externas).
// Na JSVM não existe col.set(); aqui são records, e record.set() é o correto.
//

routerAdd('DELETE /backend/v1/candidates/{id}/lgpd', (e) => {
  const req = e.requestInfo()
  const auth = req.auth || null

  // Somente membros autenticados executam a exclusão (rota substitui o delete
  // client-side que usava as regras de API da coleção).
  if (!auth || String(auth.get('id') || '') === '') {
    return e.json(401, { message: 'Autenticação necessária.' })
  }
  const role = String(auth.get('role') || '')
  const callerOrg = String(auth.get('org_id') || '')
  const isSuper = role === 'superadmin'

  const candidateId = e.request.pathValue('id')
  const app = e.app

  function tryFindById(collection, id) {
    try {
      return app.findRecordById(collection, id)
    } catch (_) {
      return null
    }
  }

  const candidate = tryFindById('candidates', candidateId)
  if (!candidate) {
    return e.json(404, { message: 'Candidato não encontrado.' })
  }

  // Isolamento multi-empresa: o candidato precisa pertencer à org do token.
  const candidateOrg = String(candidate.get('org_id') || '')
  if (!isSuper && (!callerOrg || candidateOrg !== callerOrg)) {
    return e.json(403, { message: 'Candidato fora da sua organização.' })
  }

  const deleted = { applications: 0, ai_scores: 0, disc_results: 0, cha_evaluations: 0 }
  const auditAnonymized = { count: 0 }

  // Anonimiza UM log de auditoria do titular (decisão de produto no cabeçalho).
  function anonymizeAuditLog(log) {
    try {
      const record = app.findRecordById('audit_logs', log.get('id'))
      record.set('action', 'candidate_deleted')
      record.set('application_' + 'id', null)
      record.set('candidate_' + 'id', null)
      record.set('from_' + 'stage', '')
      record.set('to_' + 'stage', '')
      record.set('reason', 'candidato removido via LGPD')
      record.set('details', 'candidato removido via LGPD')
      app.save(record)
      auditAnonymized.count++
    } catch (err) {
      console.error('[lgpd-delete] falha ao anonimizar audit_log:', err)
    }
  }

  function anonymizeAuditLogs(filterKey, idValue) {
    let logs = []
    try {
      logs = app.findRecordsByFilter('audit_logs', filterKey + ' = {:idv}', '', 0, 0, {
        idv: idValue,
      })
    } catch (_) {
      logs = []
    }
    for (let i = 0; i < logs.length; i++) {
      anonymizeAuditLog(logs[i])
    }
  }

  function deleteRelated(collection, filterKey, idValue) {
    let rows = []
    try {
      rows = app.findRecordsByFilter(collection, filterKey + ' = {:idv}', '', 0, 0, {
        idv: idValue,
      })
    } catch (_) {
      rows = []
    }
    for (let i = 0; i < rows.length; i++) {
      app.recordDelete(rows[i])
    }
    return rows.length
  }

  try {
    app.runInTransaction(function () {
      // ---- 1. Candidaturas do titular -------------------------------------
      let apps = []
      try {
        apps = app.findRecordsByFilter('applications', 'candidate_' + 'id = {:cid}', '', 0, 0, {
          cid: candidateId,
        })
      } catch (_) {
        apps = []
      }

      // ---- 2. Registros ligados às candidaturas ---------------------------
      for (let a = 0; a < apps.length; a++) {
        const appId = apps[a].get('id')
        // scores de IA (relation → applications; snapshot com dados pessoais)
        deleted.ai_scores += deleteRelated('ai_scores', 'application_' + 'id', appId)
        // fichas CHA (relation → applications)
        deleted.cha_evaluations += deleteRelated('cha_evaluations', 'application_' + 'id', appId)
        // disc_results (application_id é TEXTO, não relation)
        deleted.disc_results += deleteRelated('disc_results', 'application_' + 'id', appId)
        // logs de auditoria da candidatura — anonimizados (não apagados)
        anonymizeAuditLogs('application_' + 'id', appId)
      }

      // ---- 3. Registros ligados direto ao candidato -----------------------
      // scores de IA por candidato (podem existir sem candidatura viva)
      deleted.ai_scores += deleteRelated('ai_scores', 'candidate_' + 'id', candidateId)
      // logs de auditoria por candidato (ex.: viewed_resume sem candidatura)
      anonymizeAuditLogs('candidate_' + 'id', candidateId)

      // ---- 4. Registro de conformidade na trilha (antes do delete do
      //        candidato, pois guarda o autor da ação) -----------------------
      try {
        app.recordCreate('audit_logs', {
          org_id: candidateOrg || callerOrg,
          user_id: auth.get('id'),
          user_name: String(auth.get('name') || auth.get('email') || 'Equipe'),
          user_role: role || 'recruiter',
          action: 'candidate_deleted',
          details:
            'Registro de conformidade LGPD: exclusão executada em ' +
            new Date().toISOString() +
            '. Dados pessoais, currículo, scores de IA, DISC e fichas CHA removidos; trilha anterior anonimizada.',
        })
      } catch (_) {
        // nunca bloqueia a exclusão por falha de log
      }

      // ---- 5. Candidaturas ------------------------------------------------
      for (let i = 0; i < apps.length; i++) {
        app.recordDelete(apps[i])
        deleted.applications++
      }

      // ---- 6. O candidato: o delete do registro remove o arquivo físico
      //        de currículo (candidates.resume, campo file) junto ------------
      app.recordDelete(candidate)
    })
  } catch (err) {
    return e.json(400, {
      message:
        (err && String(err.message || err)) ||
        'Não foi possível completar a exclusão LGPD do candidato.',
    })
  }

  return e.json(200, {
    ok: true,
    deleted: deleted,
    audit_anonymized: auditAnonymized.count,
    resume_deleted: true,
  })
})
