//
// Notificações e lembretes de etapa para responsáveis (PocketBase v0.23+ JSVM).
// - Notificação imediata: quando uma candidatura é criada (novo candidato na etapa inicial)
//   ou movida para outra etapa, envia e-mail ao(s) responsável(is) configurado(s).
// - Lembrete: job agendado (a cada 6h) que verifica etapas pendentes há mais de X dias,
//   com no máximo 1 lembrete por dia por candidatura/etapa (last_stage_reminder_at).
//
// Configuração em stage_settings: job_id + stage_id, owner_user_id (usuário da equipe),
// owner_email (e-mail livre), reminder_enabled, reminder_days.
//
// Importante: a JSVM do PocketBase executa callbacks em pool separado — todo helper
// precisa viver DENTRO do callback (declarações de top-level não são visíveis lá).
// Falha de envio de e-mail é apenas registrada em log — nunca quebra a request.
//

// ---------- Notificação imediata ao entrar numa etapa ----------

onRecordAfterCreateSuccess((e) => {
  try {
    const app = e.app
    const record = e.record

    function findStageSettings(jobId, stageId) {
      try {
        return app.findFirstRecordByFilter(
          'stage_settings',
          'job_id = {:jobId} && stage_id = {:stageId}',
          { jobId: jobId, stageId: stageId },
        )
      } catch (_) {
        return null
      }
    }

    function collectRecipients(settings) {
      const emails = []
      if (settings && settings.get('owner_user_id')) {
        try {
          const owner = app.findRecordById('users', settings.get('owner_user_id'))
          if (owner && owner.email()) emails.push(owner.email())
        } catch (_) {}
      }
      if (settings && settings.get('owner_email')) {
        emails.push(settings.get('owner_email'))
      }
      return [...new Set(emails)]
    }

    function findJob(jobId) {
      try {
        return app.findRecordById('jobs', jobId)
      } catch (_) {
        return null
      }
    }

    function findCandidate(candidateId) {
      try {
        return app.findRecordById('candidates', candidateId)
      } catch (_) {
        return null
      }
    }

    function stageLabel(job, stageId) {
      try {
        const stages = JSON.parse(job.get('stages') || '[]')
        const found = stages.find((s) => s.id === stageId)
        if (found && found.label) return found.label
      } catch (_) {}
      return stageId
    }

    function buildPipelineUrl(jobId) {
      const base = ($os.getenv('PUBLIC_APP_URL') || $os.getenv('SITE_URL') || '').replace(
        /\/+$/,
        '',
      )
      return base + '/pipeline/' + jobId
    }

    function sendStageEmail(jobId, toEmails, subject, body) {
      const job = findJob(jobId)
      let companyName = 'ATS Inteligente PME'
      try {
        const company = app.findFirstRecordByFilter('companies', 'id != ""')
        if (company && company.get('name')) companyName = company.get('name')
      } catch (_) {}

      for (const email of toEmails) {
        try {
          const message = new MailerMessage({
            from: {
              address: $app.settings().meta.senderAddress,
              name: companyName,
            },
            to: [{ address: email }],
            subject: subject,
            html: body,
          })
          $app.newMailClient().send(message)
          console.log('[stage-notifications] e-mail enviado para', email, '| vaga:', jobId)
        } catch (err) {
          console.error(
            '[stage-notifications] falha ao enviar e-mail para',
            email,
            '| vaga:',
            jobId,
            '| erro:',
            err,
          )
        }
      }
    }

    function buildNotifyEmail(params) {
      const { jobTitle, stageName, candidateName, pipelineUrl } = params
      const subject = `Nova ação pendente: ${candidateName} entrou na etapa "${stageName}" (${jobTitle})`
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1e293b;">
          <h2 style="font-size: 16px;">Você é o responsável pela etapa "${stageName}"</h2>
          <p>Há uma ação pendente para o candidato <strong>${candidateName}</strong> na vaga <strong>${jobTitle}</strong>.</p>
          <ul>
            <li>Candidato: <strong>${candidateName}</strong></li>
            <li>Vaga: <strong>${jobTitle}</strong></li>
            <li>Etapa: <strong>${stageName}</strong></li>
          </ul>
          <p>
            <a href="${pipelineUrl}"
               style="display:inline-block;background:#0284c7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;">
              Abrir Pipeline
            </a>
          </p>
          <p style="font-size: 12px; color: #64748b;">Mensagem automática do ATS Inteligente PME.</p>
        </div>
      `
      return { subject, html }
    }

    const jobId = record.get('job_id')
    const stageId = record.get('stage_id')
    if (jobId && stageId && stageId !== 'hired' && stageId !== 'rejected') {
      const settings = findStageSettings(jobId, stageId)
      const toEmails = collectRecipients(settings)
      if (toEmails.length > 0) {
        const job = findJob(jobId)
        const candidate = findCandidate(record.get('candidate_id'))
        if (job && candidate) {
          const { subject, html } = buildNotifyEmail({
            jobTitle: job.get('title'),
            stageName: stageLabel(job, stageId),
            candidateName: candidate.get('name'),
            pipelineUrl: buildPipelineUrl(jobId),
          })
          sendStageEmail(jobId, toEmails, subject, html)
        }
      }
    }
  } catch (err) {
    // Falha de notificação nunca quebra o fluxo da request
    console.error('[stage-notifications] erro no afterCreate de applications:', err)
  } finally {
    e.next()
  }
}, 'applications')

onRecordAfterUpdateSuccess((e) => {
  try {
    const app = e.app
    const record = e.record

    function findStageSettings(jobId, stageId) {
      try {
        return app.findFirstRecordByFilter(
          'stage_settings',
          'job_id = {:jobId} && stage_id = {:stageId}',
          { jobId: jobId, stageId: stageId },
        )
      } catch (_) {
        return null
      }
    }

    function collectRecipients(settings) {
      const emails = []
      if (settings && settings.get('owner_user_id')) {
        try {
          const owner = app.findRecordById('users', settings.get('owner_user_id'))
          if (owner && owner.email()) emails.push(owner.email())
        } catch (_) {}
      }
      if (settings && settings.get('owner_email')) {
        emails.push(settings.get('owner_email'))
      }
      return [...new Set(emails)]
    }

    function findJob(jobId) {
      try {
        return app.findRecordById('jobs', jobId)
      } catch (_) {
        return null
      }
    }

    function findCandidate(candidateId) {
      try {
        return app.findRecordById('candidates', candidateId)
      } catch (_) {
        return null
      }
    }

    function stageLabel(job, stageId) {
      try {
        const stages = JSON.parse(job.get('stages') || '[]')
        const found = stages.find((s) => s.id === stageId)
        if (found && found.label) return found.label
      } catch (_) {}
      return stageId
    }

    function buildPipelineUrl(jobId) {
      const base = ($os.getenv('PUBLIC_APP_URL') || $os.getenv('SITE_URL') || '').replace(
        /\/+$/,
        '',
      )
      return base + '/pipeline/' + jobId
    }

    function sendStageEmail(jobId, toEmails, subject, body) {
      const job = findJob(jobId)
      let companyName = 'ATS Inteligente PME'
      try {
        const company = app.findFirstRecordByFilter('companies', 'id != ""')
        if (company && company.get('name')) companyName = company.get('name')
      } catch (_) {}

      for (const email of toEmails) {
        try {
          const message = new MailerMessage({
            from: {
              address: $app.settings().meta.senderAddress,
              name: companyName,
            },
            to: [{ address: email }],
            subject: subject,
            html: body,
          })
          $app.newMailClient().send(message)
          console.log('[stage-notifications] e-mail enviado para', email, '| vaga:', jobId)
        } catch (err) {
          console.error(
            '[stage-notifications] falha ao enviar e-mail para',
            email,
            '| vaga:',
            jobId,
            '| erro:',
            err,
          )
        }
      }
    }

    function buildNotifyEmail(params) {
      const { jobTitle, stageName, candidateName, currentStageName, pipelineUrl } = params
      const isNew = !currentStageName
      const subject = isNew
        ? `Nova ação pendente: ${candidateName} entrou na etapa "${stageName}" (${jobTitle})`
        : `Ação pendente: ${candidateName} movido para a etapa "${stageName}" (${jobTitle})`

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1e293b;">
          <h2 style="font-size: 16px;">Você é o responsável pela etapa "${stageName}"</h2>
          <p>Há uma ação pendente para o candidato <strong>${candidateName}</strong> na vaga <strong>${jobTitle}</strong>.</p>
          <ul>
            <li>Candidato: <strong>${candidateName}</strong></li>
            <li>Vaga: <strong>${jobTitle}</strong></li>
            <li>Etapa: <strong>${stageName}</strong></li>
          </ul>
          <p>
            <a href="${pipelineUrl}"
               style="display:inline-block;background:#0284c7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;">
              Abrir Pipeline
            </a>
          </p>
          <p style="font-size: 12px; color: #64748b;">Mensagem automática do ATS Inteligente PME.</p>
        </div>
      `
      return { subject, html }
    }

    const jobId = record.get('job_id')
    const stageId = record.get('stage_id')
    if (jobId && stageId && stageId !== 'hired' && stageId !== 'rejected') {
      // Só notifica quando a etapa realmente mudou
      let previousStageId = ''
      try {
        const original = record.original()
        if (original) previousStageId = original.get('stage_id') || ''
      } catch (_) {}
      if (previousStageId !== stageId) {
        const settings = findStageSettings(jobId, stageId)
        const toEmails = collectRecipients(settings)
        if (toEmails.length > 0) {
          const job = findJob(jobId)
          const candidate = findCandidate(record.get('candidate_id'))
          if (job && candidate) {
            const { subject, html } = buildNotifyEmail({
              jobTitle: job.get('title'),
              stageName: stageLabel(job, stageId),
              candidateName: candidate.get('name'),
              currentStageName: previousStageId ? stageLabel(job, previousStageId) : '',
              pipelineUrl: buildPipelineUrl(jobId),
            })
            sendStageEmail(jobId, toEmails, subject, html)
          }
        }
      }
    }
  } catch (err) {
    // Falha de notificação nunca quebra o fluxo da request
    console.error('[stage-notifications] erro no afterUpdate de applications:', err)
  } finally {
    e.next()
  }
}, 'applications')

// ---------- Lembretes (job agendado, a cada 6 horas) ----------

cronAdd('stageReminders', '0 */6 * * *', () => {
  const app = $app
  const now = new Date()

  function findStageSettings(jobId, stageId) {
    try {
      return app.findFirstRecordByFilter(
        'stage_settings',
        'job_id = {:jobId} && stage_id = {:stageId}',
        { jobId: jobId, stageId: stageId },
      )
    } catch (_) {
      return null
    }
  }

  function collectRecipients(settings) {
    const emails = []
    if (settings && settings.get('owner_user_id')) {
      try {
        const owner = app.findRecordById('users', settings.get('owner_user_id'))
        if (owner && owner.email()) emails.push(owner.email())
      } catch (_) {}
    }
    if (settings && settings.get('owner_email')) {
      emails.push(settings.get('owner_email'))
    }
    return [...new Set(emails)]
  }

  function findJob(jobId) {
    try {
      return app.findRecordById('jobs', jobId)
    } catch (_) {
      return null
    }
  }

  function findCandidate(candidateId) {
    try {
      return app.findRecordById('candidates', candidateId)
    } catch (_) {
      return null
    }
  }

  function stageLabel(job, stageId) {
    try {
      const stages = JSON.parse(job.get('stages') || '[]')
      const found = stages.find((s) => s.id === stageId)
      if (found && found.label) return found.label
    } catch (_) {}
    return stageId
  }

  function buildPipelineUrl(jobId) {
    const base = ($os.getenv('PUBLIC_APP_URL') || $os.getenv('SITE_URL') || '').replace(/\/+$/, '')
    return base + '/pipeline/' + jobId
  }

  function sendStageEmail(jobId, toEmails, subject, body) {
    const job = findJob(jobId)
    let companyName = 'ATS Inteligente PME'
    try {
      const company = app.findFirstRecordByFilter('companies', 'id != ""')
      if (company && company.get('name')) companyName = company.get('name')
    } catch (_) {}

    for (const email of toEmails) {
      try {
        const message = new MailerMessage({
          from: {
            address: $app.settings().meta.senderAddress,
            name: companyName,
          },
          to: [{ address: email }],
          subject: subject,
          html: body,
        })
        $app.newMailClient().send(message)
        console.log('[stage-notifications] e-mail enviado para', email, '| vaga:', jobId)
      } catch (err) {
        console.error(
          '[stage-notifications] falha ao enviar e-mail para',
          email,
          '| vaga:',
          jobId,
          '| erro:',
          err,
        )
      }
    }
  }

  function buildReminderEmail(params) {
    const { jobTitle, stageName, candidateName, pipelineUrl, daysPending } = params
    const subject = `Lembrete: etapa "${stageName}" pendente há ${daysPending} dia(s) — ${candidateName} (${jobTitle})`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1e293b;">
        <h2 style="font-size: 16px;">Lembrete de etapa pendente</h2>
        <p>A etapa <strong>${stageName}</strong> está pendente há <strong>${daysPending} dia(s)</strong> para:</p>
        <ul>
          <li>Candidato: <strong>${candidateName}</strong></li>
          <li>Vaga: <strong>${jobTitle}</strong></li>
          <li>Etapa: <strong>${stageName}</strong></li>
        </ul>
        <p>
          <a href="${pipelineUrl}"
             style="display:inline-block;background:#0284c7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;">
            Abrir Pipeline
          </a>
        </p>
        <p style="font-size: 12px; color: #64748b;">Mensagem automática do ATS Inteligente PME.</p>
      </div>
    `
    return { subject, html }
  }

  // Devolve o timestamp (ms) do último movimento de etapa, com fallback para a criação.
  function stageTimestampMs(application) {
    try {
      const stageUpdatedAt = application.getDateTime('stage_updated_at')
      if (stageUpdatedAt && !stageUpdatedAt.isZero()) return stageUpdatedAt.time()
    } catch (_) {}
    try {
      return application.getDateTime('created').time()
    } catch (_) {
      return new Date().getTime()
    }
  }

  let pendingApps = []
  try {
    pendingApps = app.findRecordsByFilter(
      'applications',
      "status = 'active' && stage_id != 'hired' && stage_id != 'rejected'",
      '',
      500,
      0,
    )
  } catch (err) {
    console.error('[stage-reminders] falha ao buscar candidaturas pendentes:', err)
    return
  }

  let sent = 0
  for (const application of pendingApps) {
    const jobId = application.get('job_id')
    const stageId = application.get('stage_id')
    const settings = findStageSettings(jobId, stageId)

    if (!settings || !settings.getBool('reminder_enabled')) continue
    if (!settings.get('owner_user_id') && !settings.get('owner_email')) continue

    const toEmails = collectRecipients(settings)
    if (toEmails.length === 0) continue

    const days = settings.getInt('reminder_days') || 2
    const pendingDays = Math.floor((now.getTime() - stageTimestampMs(application)) / 86400000)
    if (pendingDays < days) continue

    // Anti-spam: no máximo 1 lembrete por dia por candidato/etapa
    let lastReminderMs = 0
    try {
      const lastReminder = application.getDateTime('last_stage_reminder_at')
      if (lastReminder && !lastReminder.isZero()) lastReminderMs = lastReminder.time()
    } catch (_) {}
    if (lastReminderMs && now.getTime() - lastReminderMs < 86400000) continue

    const job = findJob(jobId)
    const candidate = findCandidate(application.get('candidate_id'))
    if (!job || !candidate) continue

    const { subject, html } = buildReminderEmail({
      jobTitle: job.get('title'),
      stageName: stageLabel(job, stageId),
      candidateName: candidate.get('name'),
      pipelineUrl: buildPipelineUrl(jobId),
      daysPending: pendingDays,
    })

    sendStageEmail(jobId, toEmails, subject, html)
    sent++

    // Grava a data do lembrete na candidatura (anti-spam por candidato/etapa)
    try {
      application.set('last_stage_reminder_at', new Date().toISOString())
      app.save(application)
    } catch (err) {
      console.error('[stage-reminders] falha ao gravar last_stage_reminder_at:', err)
    }
  }
  console.log('[stage-reminders] lembretes enviados:', sent)
})
