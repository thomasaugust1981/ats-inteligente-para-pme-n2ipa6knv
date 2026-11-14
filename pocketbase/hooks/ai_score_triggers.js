//
// Gatilhos automáticos de recálculo do score de IA (consultivo) do candidato.
// Sempre que uma informação relevante muda, o agente nativo 'candidate-scorer'
// recalcula o score e grava em ai_scores (auditoria):
//   1. Candidatura muda de etapa no pipeline        → trigger 'stage_change'
//   2. DISC é preenchido pelo candidato             → trigger 'disc_completed'
//   3. Comentário em aprovação/reprovação de etapa  → trigger 'note_added'
//   4. Nova candidatura criada                      → trigger 'application_created'
//
// O recálculo NUNCA altera o status da candidatura — score é consultivo apenas.
// Helpers vivem DENTRO de cada callback (pool separado da JSVM) e TODOS os
// caminhos de saída chamam e.next() — falha de score nunca quebra a request.
//

// 1 + 3. Etapa mudou (stage_change) ou justificativa/comentário mudou (note_added).
onRecordAfterUpdateSuccess((e) => {
  try {
    const app = e.app
    const record = e.record

    function prevValue(name) {
      try {
        const original = record.original()
        if (original) return String(original.get(name) || '')
      } catch (_) {}
      return ''
    }

    const prevStage = prevValue('stage_id')
    const newStage = String(record.get('stage_id') || '')
    let trigger = ''
    if (prevStage !== newStage) {
      trigger = 'stage_change'
    } else if (
      prevValue('rejection_reason') !== String(record.get('rejection_reason') || '') ||
      prevValue('stage_comment') !== String(record.get('stage_comment') || '')
    ) {
      trigger = 'note_added'
    }
    if (!trigger) return

    const candidate = (() => {
      try {
        return app.findRecordById('candidates', record.get('candidate_id'))
      } catch (_) {
        return null
      }
    })()
    const job = (() => {
      try {
        return app.findRecordById('jobs', record.get('job_id'))
      } catch (_) {
        return null
      }
    })()
    if (!candidate || !job) return

    // ---- snapshot das informações usadas ----
    function tryFindFirst(collection, filter, params) {
      try {
        return app.findFirstRecordByFilter(collection, filter, params)
      } catch (_) {
        return null
      }
    }

    let disc = null
    if (String(record.get('disc_status') || '') === 'completed') {
      disc = {
        profile: record.get('disc_profile') || '',
        d: record.get('disc_score_d'),
        i: record.get('disc_score_i'),
        s: record.get('disc_score_s'),
        c: record.get('disc_score_c'),
      }
    } else {
      const dr = tryFindFirst('disc_results', 'application_id = {:a} && status = "completed"', {
        a: record.id,
      })
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

    let fitScore = null
    let fitNote = ''
    const fitResult = tryFindFirst('disc_results', 'application_id = {:a}', { a: record.id })
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

    const comments = []
    try {
      const logs = app.findRecordsByFilter(
        'audit_logs',
        'application_id = {:a} && (details != "" || reason != "")',
        '-created',
        30,
        0,
        { a: record.id },
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

    const snapshot = {
      trigger_hint: trigger,
      stage_id: newStage,
      candidate: {
        name: candidate.get('name') || '',
        seniority: candidate.get('seniority') || '',
        location: candidate.get('location') || '',
        availability: candidate.get('availability') || '',
        skills: candidate.get('skills') || '',
        summary: candidate.get('summary') || '',
        resume_structured: candidate.get('resume_structured') || null,
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
      cultural_fit: {
        manual_score: fitScore,
        manual_note: fitNote,
        company_vision: company ? company.get('vision') || '' : '',
        company_mission: company ? company.get('mission') || '' : '',
      },
      pipeline_comments: comments,
    }

    const hasResumeData =
      (snapshot.candidate.resume_structured &&
        JSON.stringify(snapshot.candidate.resume_structured).length > 10) ||
      (snapshot.candidate.skills && String(snapshot.candidate.skills).trim().length > 0)

    // Placeholder/registro de auditoria (sempre grava; vira "insufficient" quando faltam dados).
    try {
      app.runBatch(function (batch) {
        batch.collection('ai_scores').create({
          application_id: record.id,
          candidate_id: candidate.id,
          job_id: job.id,
          trigger: trigger,
          score: 0,
          justification: hasResumeData
            ? 'Cálculo em andamento pelo agente de IA.'
            : 'Score ainda não calculado — dados insuficientes (sem currículo estruturado nem habilidades preenchidas).',
          insufficient_data: !hasResumeData,
          snapshot: snapshot,
        })
      })
    } catch (err) {
      console.error('[ai-score-trigger] falha ao gravar em ai_scores:', err)
      return
    }

    if (!hasResumeData) {
      console.log('[ai-score-trigger] dados insuficientes | aplicação:', record.id)
      return
    }

    // Chamada ao agente nativo 'candidate-scorer'.
    let parsed = null
    try {
      const serviceUser = $app.findAuthRecordByEmail('users', 'ai-service@ats.internal')
      const prompt =
        'Calcule o score de aderência deste candidato para a vaga, usando os dados JSON abaixo. ' +
        'Responda APENAS com JSON: {"score_technical":0-100 ou null,"score_behavioral":0-100 ou null,' +
        '"score_cultural":0-100 ou null,"score":0-100,"justification":"..."}. ' +
        'Regras: score geral pondera as dimensões disponíveis. Justificativa OBRIGATÓRIA em português, ' +
        'citando evidências de cada dimensão avaliada. Sem dados de uma dimensão, use null nela. ' +
        'Score é consultivo — não reprova nem aprova ninguém.\n\nDADOS: ' +
        JSON.stringify(snapshot).slice(0, 24000)

      const aiResult = $ai.agent('candidate-scorer').chat({
        user_id: serviceUser.id,
        message: prompt,
      })
      const raw = ((aiResult && aiResult.content) || '').trim()
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim()
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      if (start !== -1 && end > start) {
        parsed = JSON.parse(cleaned.slice(start, end + 1))
      }
    } catch (err) {
      console.error('[ai-score-trigger] falha na chamada ao agente:', err)
      return
    }

    if (!parsed || !isFinite(Number(parsed.score)) || !String(parsed.justification || '').trim()) {
      console.error('[ai-score-trigger] resposta inválida do agente | aplicação:', record.id)
      return
    }

    const toNumOrNull = (v) => {
      const n = Number(v)
      return isFinite(n) ? n : null
    }
    try {
      app.runBatch(function (batch) {
        batch.collection('ai_scores').create({
          application_id: record.id,
          candidate_id: candidate.id,
          job_id: job.id,
          trigger: trigger,
          score: Math.max(0, Math.min(100, Math.round(Number(parsed.score)))),
          score_technical: toNumOrNull(parsed.score_technical),
          score_behavioral: toNumOrNull(parsed.score_behavioral),
          score_cultural: toNumOrNull(parsed.score_cultural),
          justification: String(parsed.justification).trim(),
          insufficient_data: false,
          snapshot: snapshot,
        })
      })
      console.log('[ai-score-trigger] score gravado | aplicação:', record.id, '| gatilho:', trigger)
    } catch (err) {
      console.error('[ai-score-trigger] falha ao gravar score final:', err)
    }
  } catch (err) {
    console.error('[ai-score-trigger] erro no afterUpdate de applications:', err)
  } finally {
    e.next()
  }
}, 'applications')

// 4. Nova candidatura criada → primeiro cálculo do score.
onRecordAfterCreateSuccess((e) => {
  try {
    const app = e.app
    const record = e.record

    const candidate = (() => {
      try {
        return app.findRecordById('candidates', record.get('candidate_id'))
      } catch (_) {
        return null
      }
    })()
    const job = (() => {
      try {
        return app.findRecordById('jobs', record.get('job_id'))
      } catch (_) {
        return null
      }
    })()
    if (!candidate || !job) return

    const snapshot = {
      trigger_hint: 'application_created',
      stage_id: String(record.get('stage_id') || ''),
      candidate: {
        name: candidate.get('name') || '',
        seniority: candidate.get('seniority') || '',
        location: candidate.get('location') || '',
        availability: candidate.get('availability') || '',
        skills: candidate.get('skills') || '',
        summary: candidate.get('summary') || '',
        resume_structured: candidate.get('resume_structured') || null,
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
      disc: null,
      cultural_fit: {
        manual_score: null,
        manual_note: '',
        company_vision: '',
        company_mission: '',
      },
      pipeline_comments: [],
    }

    const hasResumeData =
      (snapshot.candidate.resume_structured &&
        JSON.stringify(snapshot.candidate.resume_structured).length > 10) ||
      (snapshot.candidate.skills && String(snapshot.candidate.skills).trim().length > 0)

    try {
      app.runBatch(function (batch) {
        batch.collection('ai_scores').create({
          application_id: record.id,
          candidate_id: candidate.id,
          job_id: job.id,
          trigger: 'application_created',
          score: 0,
          justification: hasResumeData
            ? 'Cálculo em andamento pelo agente de IA.'
            : 'Score ainda não calculado — dados insuficientes (sem currículo estruturado nem habilidades preenchidas).',
          insufficient_data: !hasResumeData,
          snapshot: snapshot,
        })
      })
    } catch (err) {
      console.error('[ai-score-trigger] falha ao gravar em ai_scores (create):', err)
      return
    }

    if (!hasResumeData) return

    let parsed = null
    try {
      const serviceUser = $app.findAuthRecordByEmail('users', 'ai-service@ats.internal')
      const prompt =
        'Calcule o score de aderência deste candidato para a vaga, usando os dados JSON abaixo. ' +
        'Responda APENAS com JSON: {"score_technical":0-100 ou null,"score_behavioral":0-100 ou null,' +
        '"score_cultural":0-100 ou null,"score":0-100,"justification":"..."}. ' +
        'Regras: score geral pondera as dimensões disponíveis. Justificativa OBRIGATÓRIA em português. ' +
        'Score é consultivo — não reprova nem aprova ninguém.\n\nDADOS: ' +
        JSON.stringify(snapshot).slice(0, 24000)

      const aiResult = $ai.agent('candidate-scorer').chat({
        user_id: serviceUser.id,
        message: prompt,
      })
      const raw = ((aiResult && aiResult.content) || '').trim()
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim()
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      if (start !== -1 && end > start) {
        parsed = JSON.parse(cleaned.slice(start, end + 1))
      }
    } catch (err) {
      console.error('[ai-score-trigger] falha na chamada ao agente (create):', err)
      return
    }

    if (!parsed || !isFinite(Number(parsed.score)) || !String(parsed.justification || '').trim()) {
      console.error(
        '[ai-score-trigger] resposta inválida do agente (create) | aplicação:',
        record.id,
      )
      return
    }

    const toNumOrNull = (v) => {
      const n = Number(v)
      return isFinite(n) ? n : null
    }
    try {
      app.runBatch(function (batch) {
        batch.collection('ai_scores').create({
          application_id: record.id,
          candidate_id: candidate.id,
          job_id: job.id,
          trigger: 'application_created',
          score: Math.max(0, Math.min(100, Math.round(Number(parsed.score)))),
          score_technical: toNumOrNull(parsed.score_technical),
          score_behavioral: toNumOrNull(parsed.score_behavioral),
          score_cultural: toNumOrNull(parsed.score_cultural),
          justification: String(parsed.justification).trim(),
          insufficient_data: false,
          snapshot: snapshot,
        })
      })
      console.log('[ai-score-trigger] score inicial gravado | aplicação:', record.id)
    } catch (err) {
      console.error('[ai-score-trigger] falha ao gravar score inicial:', err)
    }
  } catch (err) {
    console.error('[ai-score-trigger] erro no afterCreate de applications:', err)
  } finally {
    e.next()
  }
}, 'applications')

// 2. DISC preenchido → recalcula com o resultado comportamental.
onRecordAfterUpdateSuccess((e) => {
  try {
    const app = e.app
    const record = e.record
    if (String(record.get('status') || '') !== 'completed') return
    let wasCompleted = false
    try {
      const original = record.original()
      if (original) wasCompleted = String(original.get('status') || '') === 'completed'
    } catch (_) {}
    if (wasCompleted) return

    const appRecord = (() => {
      try {
        return app.findRecordById('applications', record.get('application_id'))
      } catch (_) {
        return null
      }
    })()
    if (!appRecord) return

    const candidate = (() => {
      try {
        return app.findRecordById('candidates', appRecord.get('candidate_id'))
      } catch (_) {
        return null
      }
    })()
    const job = (() => {
      try {
        return app.findRecordById('jobs', appRecord.get('job_id'))
      } catch (_) {
        return null
      }
    })()
    if (!candidate || !job) return

    const snapshot = {
      trigger_hint: 'disc_completed',
      stage_id: String(appRecord.get('stage_id') || ''),
      candidate: {
        name: candidate.get('name') || '',
        seniority: candidate.get('seniority') || '',
        location: candidate.get('location') || '',
        availability: candidate.get('availability') || '',
        skills: candidate.get('skills') || '',
        summary: candidate.get('summary') || '',
        resume_structured: candidate.get('resume_structured') || null,
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
      disc: {
        profile: record.get('profile') || '',
        d: record.get('score_d'),
        i: record.get('score_i'),
        s: record.get('score_s'),
        c: record.get('score_c'),
      },
      cultural_fit: {
        manual_score: record.get('fit_score'),
        manual_note: record.get('fit_note') || '',
        company_vision: '',
        company_mission: '',
      },
      pipeline_comments: [],
    }

    const hasResumeData =
      (snapshot.candidate.resume_structured &&
        JSON.stringify(snapshot.candidate.resume_structured).length > 10) ||
      (snapshot.candidate.skills && String(snapshot.candidate.skills).trim().length > 0)

    try {
      app.runBatch(function (batch) {
        batch.collection('ai_scores').create({
          application_id: appRecord.id,
          candidate_id: candidate.id,
          job_id: job.id,
          trigger: 'disc_completed',
          score: 0,
          justification: hasResumeData
            ? 'Cálculo em andamento pelo agente de IA.'
            : 'Score ainda não calculado — dados insuficientes.',
          insufficient_data: !hasResumeData,
          snapshot: snapshot,
        })
      })
    } catch (err) {
      console.error('[ai-score-trigger] falha ao gravar em ai_scores (disc):', err)
      return
    }

    if (!hasResumeData) return

    let parsed = null
    try {
      const serviceUser = $app.findAuthRecordByEmail('users', 'ai-service@ats.internal')
      const prompt =
        'Calcule o score de aderência deste candidato para a vaga (o DISC acabou de ser preenchido), ' +
        'usando os dados JSON abaixo. Responda APENAS com JSON: ' +
        '{"score_technical":0-100 ou null,"score_behavioral":0-100 ou null,' +
        '"score_cultural":0-100 ou null,"score":0-100,"justification":"..."}. ' +
        'Regras: score geral pondera as dimensões disponíveis. Justificativa OBRIGATÓRIA em português. ' +
        'Score é consultivo — não reprova nem aprova ninguém.\n\nDADOS: ' +
        JSON.stringify(snapshot).slice(0, 24000)

      const aiResult = $ai.agent('candidate-scorer').chat({
        user_id: serviceUser.id,
        message: prompt,
      })
      const raw = ((aiResult && aiResult.content) || '').trim()
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim()
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      if (start !== -1 && end > start) {
        parsed = JSON.parse(cleaned.slice(start, end + 1))
      }
    } catch (err) {
      console.error('[ai-score-trigger] falha na chamada ao agente (disc):', err)
      return
    }

    if (!parsed || !isFinite(Number(parsed.score)) || !String(parsed.justification || '').trim()) {
      console.error(
        '[ai-score-trigger] resposta inválida do agente (disc) | aplicação:',
        appRecord.id,
      )
      return
    }

    const toNumOrNull = (v) => {
      const n = Number(v)
      return isFinite(n) ? n : null
    }
    try {
      app.runBatch(function (batch) {
        batch.collection('ai_scores').create({
          application_id: appRecord.id,
          candidate_id: candidate.id,
          job_id: job.id,
          trigger: 'disc_completed',
          score: Math.max(0, Math.min(100, Math.round(Number(parsed.score)))),
          score_technical: toNumOrNull(parsed.score_technical),
          score_behavioral: toNumOrNull(parsed.score_behavioral),
          score_cultural: toNumOrNull(parsed.score_cultural),
          justification: String(parsed.justification).trim(),
          insufficient_data: false,
          snapshot: snapshot,
        })
      })
      console.log('[ai-score-trigger] score pós-DISC gravado | aplicação:', appRecord.id)
    } catch (err) {
      console.error('[ai-score-trigger] falha ao gravar score pós-DISC:', err)
    }
  } catch (err) {
    console.error('[ai-score-trigger] erro no afterUpdate de disc_results:', err)
  } finally {
    e.next()
  }
}, 'disc_results')
