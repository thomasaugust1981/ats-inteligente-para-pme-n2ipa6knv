//
// Score de IA consultivo do candidato — endpoint POST /backend/v1/candidates/score.
// A IA usada é decidida por $app.computeScore (pocketbase/hooks/ai_provider.js):
// agente NATIVO 'candidate-scorer' ou, se o admin configurou, provedor próprio
// do cliente (OpenAI/Gemini com a chave dele, com fallback ao nativo). Consultivo
// apenas — NUNCA altera o status da candidatura. Grava em ai_scores (auditoria).
// Quando o candidato tem ficha CHA preenchida (cha_evaluations), a dimensão
// técnica é alimentada com essa evidência objetiva ($app.applyChaToSnapshot,
// pocketbase/hooks/cha_score.js) e o snapshot registra a fonte ('cha' | 'resume').
//
// A JSVM executa callbacks em pool separado: helpers ficam DENTRO do callback
// e TODOS os caminhos de saída chamam e.next(). Helpers GLOBAIS de CHA ficam em
// pocketbase/hooks/cha_score.js ($app.applyChaToSnapshot).
//

routerAdd('POST', '/backend/v1/candidates/score', (e) => {
  function tryFindById(app, collection, id) {
    try {
      return app.findRecordById(collection, id)
    } catch (_) {
      return null
    }
  }
  function tryFindFirst(app, collection, filter, params) {
    try {
      return app.findFirstRecordByFilter(collection, filter, params)
    } catch (_) {
      return null
    }
  }
  function toNumOrNull(v) {
    const n = Number(v)
    return isFinite(n) ? n : null
  }

  function buildSnapshot(app, appRecord, candidate, job, trigger) {
    // 1. DISC — resultado preenchido pelo candidato (prioriza campos espelhados
    //    na candidatura; cai para o registro disc_results)
    let disc = null
    const discStatus = String(appRecord.get('disc_status') || '')
    if (discStatus === 'completed') {
      disc = {
        profile: appRecord.get('disc_profile') || '',
        d: appRecord.get('disc_score_d'),
        i: appRecord.get('disc_score_i'),
        s: appRecord.get('disc_score_s'),
        c: appRecord.get('disc_score_c'),
      }
    } else {
      const dr = tryFindFirst(
        app,
        'disc_results',
        'application_id = {:a} && status = "completed"',
        {
          a: appRecord.id,
        },
      )
      if (dr) {
        disc = {
          profile: dr.get('profile') || '',
          d: dr.get('score_d'),
          i: dr.get('score_i'),
          s: dr.get('score_s'),
          c: dr.get('score_c'),
        }
      }
    }

    // 2. FIT cultural manual (nota + observação) + visão/missão da empresa
    let fitScore = null
    let fitNote = ''
    const fitResult = tryFindFirst(app, 'disc_results', 'application_id = {:a}', {
      a: appRecord.id,
    })
    if (fitResult) {
      fitScore = fitResult.get('fit_score')
      fitNote = fitResult.get('fit_note') || ''
      if (fitResult.get('status') === 'completed' && !disc) {
        disc = {
          profile: fitResult.get('profile') || '',
          d: fitResult.get('score_d'),
          i: fitResult.get('score_i'),
          s: fitResult.get('score_s'),
          c: fitResult.get('score_c'),
        }
      }
    }

    let company = null
    try {
      company = app.findFirstRecordByFilter('companies', 'id != ""')
    } catch (_) {
      company = null
    }

    // 3. Comentários do pipeline (audit_logs desta candidatura)
    const comments = []
    try {
      const logs = app.findRecordsByFilter(
        'audit_logs',
        'application_id = {:a} && (details != "" || reason != "")',
        '-created',
        30,
        0,
        { a: appRecord.id },
      )
      for (const log of logs) {
        comments.push({
          action: log.get('action') || '',
          by: log.get('user_name') || '',
          role: log.get('user_role') || '',
          reason: log.get('reason') || '',
          details: log.get('details') || '',
          created: log.get('created') || '',
        })
      }
    } catch (_) {}

    return {
      trigger: trigger,
      // Org da vaga — o computeScore resolve provider/chave POR ORGANIZAÇÃO (0029).
      org_id: String(job.get('org_' + 'id') || ''),
      stage_id: appRecord.get('stage_id') || '',
      application_status: appRecord.get('status') || '',
      candidate: {
        name: candidate.get('name') || '',
        seniority: candidate.get('seniority') || '',
        location: candidate.get('location') || '',
        availability: candidate.get('availability') || '',
        skills: candidate.get('skills') || '',
        summary: candidate.get('summary') || '',
        resume_structured: candidate.get('resume_structured') || null,
        resume_source: candidate.get('resume_source') || '',
      },
      job: {
        title: job.get('title') || '',
        requirements: job.get('requirements') || '',
        prerequisites: job.get('prerequisites') || '',
        description: (job.get('description') || '').slice(0, 4000),
        seniority: job.get('seniority') || '',
        workplace_type: job.get('workplace_type') || '',
        location: job.get('location') || '',
      },
      disc: disc,
      // Ficha CHA preenchida para esta candidatura — evidência objetiva da
      // dimensão técnica (fonte 'cha'); sem ficha, a fonte fica 'resume'.
      cha_evaluation: null,
      technical_source: 'resume',
      cultural_fit: {
        manual_score: fitScore,
        manual_note: fitNote,
        company_vision: company ? company.get('vision') || '' : '',
        company_mission: company ? company.get('mission') || '' : '',
      },
      pipeline_comments: comments,
    }
  }

  let responseStatus = 200
  let responsePayload = null

  try {
    // /backend/v1/* não recebe e.auth do runtime — resolve pelo header (resolver
    // definido em menu_order_server.js).
    const auth = $app.resolveAuthUser(e)
    if (!auth) {
      responseStatus = 401
      responsePayload = { error: 'Autenticação necessária.' }
    } else {
      const body = e.requestInfo().body
      const applicationId = String(body.application_id || '')
      const trigger = String(body.trigger || 'manual')
      if (!applicationId) {
        responseStatus = 400
        responsePayload = { error: 'Informe application_id.' }
      } else {
        const appRecord = tryFindById(e.app, 'applications', applicationId)
        if (!appRecord) {
          responseStatus = 404
          responsePayload = { error: 'Candidatura não encontrada.' }
        } else {
          const candidate = tryFindById(e.app, 'candidates', appRecord.get('candidate_id'))
          const job = tryFindById(e.app, 'jobs', appRecord.get('job_id'))
          if (!candidate || !job) {
            responseStatus = 404
            responsePayload = { error: 'Candidato ou vaga não encontrados.' }
          } else {
            // Módulo configurável: agente desativado → endpoint não calcula nada.
            // Config POR ORGANIZAÇÃO (0029): usa a org da vaga; vaga sem org cai na global.
            const agentSettings = $app.getAgentSettings(e.app, String(job.get('org_' + 'id') || ''))
            if (!agentSettings.enabled) {
              responseStatus = 200
              responsePayload = {
                insufficient_data: true,
                message:
                  'O agente de score de IA está desativado pelo administrador — nenhum score é calculado.',
              }
            } else {
              const snapshot = buildSnapshot(e.app, appRecord, candidate, job, trigger)
              // Ficha CHA da candidatura, quando existe — alimenta a dimensão
              // técnica com dados objetivos (score ponderado, % por bloco,
              // notas baixas + evidências). Candidato sem ficha: sem mudança.
              const chaApplied = $app.applyChaToSnapshot(e.app, snapshot, appRecord.id)
              if (chaApplied) {
                console.log(
                  '[ai-score] ficha CHA aplicada à dimensão técnica | aplicação:',
                  appRecord.id,
                )
              }
              // Pesos EFETIVOS: régua própria da vaga quando preenchida (soma 100),
              // senão a régua global — com a origem registrada no snapshot.
              const resolved = $app.resolveScoreWeights(job, agentSettings)
              snapshot.weights_used = resolved.weights
              snapshot.weights_source = resolved.source
              // Ficha CHA preenchida também é dado suficiente para calcular
              // (candidato interno/indicação sem currículo estruturado).
              const hasResumeData =
                (snapshot.candidate.resume_structured &&
                  JSON.stringify(snapshot.candidate.resume_structured).length > 10) ||
                (snapshot.candidate.skills && snapshot.candidate.skills.trim().length > 0) ||
                chaApplied

              if (!hasResumeData) {
                responseStatus = 200
                responsePayload = {
                  insufficient_data: true,
                  message:
                    'Score ainda não calculado — dados insuficientes (sem currículo estruturado nem habilidades preenchidas).',
                }
              } else {
                try {
                  const parsed = $app.computeScore(e.app, snapshot, agentSettings)

                  // AUDITORIA: grava score + dimensões + snapshot (com provider_used)
                  let savedId = ''
                  try {
                    const savedRecord = e.app.runBatch(function (batch) {
                      return batch.collection('ai_scores').create({
                        application_id: appRecord.id,
                        candidate_id: candidate.id,
                        job_id: job.id,
                        trigger: trigger,
                        score: Math.round(Number(parsed.score)),
                        score_technical: toNumOrNull(parsed.score_technical),
                        score_behavioral: toNumOrNull(parsed.score_behavioral),
                        score_cultural: toNumOrNull(parsed.score_cultural),
                        justification: String(parsed.justification || '').trim(),
                        insufficient_data: false,
                        snapshot: snapshot,
                      })
                    })
                    savedId = savedRecord ? savedRecord.id : ''
                  } catch (err) {
                    console.error('[ai-score] falha ao gravar ai_scores:', err)
                  }

                  snapshot.provider_used = parsed.provider_used
                  responseStatus = 200
                  responsePayload = {
                    id: savedId,
                    score: Math.round(Number(parsed.score)),
                    score_technical: toNumOrNull(parsed.score_technical),
                    score_behavioral: toNumOrNull(parsed.score_behavioral),
                    score_cultural: toNumOrNull(parsed.score_cultural),
                    justification: String(parsed.justification || '').trim(),
                    insufficient_data: false,
                    provider_used: parsed.provider_used,
                    trigger: trigger,
                    created: new Date().toISOString(),
                  }
                } catch (err) {
                  console.error('[ai-score] erro no cálculo do score:', err)
                  responseStatus = 502
                  responsePayload = {
                    error: 'Falha na análise de IA. Tente novamente em instantes.',
                    code: 'ai_error',
                  }
                  // Registra o erro no histórico (auditoria do fallback/erro).
                  try {
                    e.app.runBatch(function (batch) {
                      batch.collection('ai_scores').create({
                        application_id: appRecord.id,
                        candidate_id: candidate.id,
                        job_id: job.id,
                        trigger: trigger,
                        score: 0,
                        justification:
                          'Falha ao calcular o score — provedor de IA indisponível no momento.',
                        insufficient_data: true,
                        snapshot: snapshot,
                      })
                    })
                  } catch (_) {}
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[ai-score] erro inesperado:', err)
    responseStatus = 500
    responsePayload = { error: 'Falha ao calcular o score de IA.', code: 'unknown' }
  } finally {
    if (responsePayload) {
      e.json(responseStatus, responsePayload)
    }
    e.next()
  }
})
