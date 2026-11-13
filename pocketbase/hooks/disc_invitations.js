//
// Convidar o candidato para o formulário DISC (PocketBase v0.23+ JSVM).
// Quando uma candidatura entra na etapa `disc`, cria um registro `disc_results`
// com token único (status 'pending') e envia o link ao candidato por e-mail.
// O formulário público /disc/:token grava as respostas nesse mesmo registro.
//
// Helpers vivem DENTRO do callback (pool separado da JSVM) e TODOS os caminhos
// de saída chamam e.next() — falha de e-mail nunca quebra a request.
//

onRecordAfterUpdateSuccess((e) => {
  try {
    const app = e.app
    const record = e.record

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

    function previousStageId(record) {
      try {
        const original = record.original()
        if (original) return original.get('stage_id') || ''
      } catch (_) {}
      return ''
    }

    function generateToken() {
      try {
        return $security.randomStringWithAlphabet(
          48,
          'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        )
      } catch (_) {
        return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 14)
      }
    }

    function buildPublicUrl(token) {
      const base = ($os.getenv('PUBLIC_APP_URL') || $os.getenv('SITE_URL') || '').replace(
        /\/+$/,
        '',
      )
      return base + '/disc/' + token
    }

    function sendDiscEmail(toEmail, candidateName, jobTitle, link) {
      try {
        let companyName = 'ATS Inteligente PME'
        try {
          const company = app.findFirstRecordByFilter('companies', 'id != ""')
          if (company && company.get('name')) companyName = company.get('name')
        } catch (_) {}

        const subject = `Teste DISC — ${jobTitle}`
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1e293b;">
            <h2 style="font-size: 16px;">Olá, ${candidateName}!</h2>
            <p>Você avançou no processo seletivo para a vaga <strong>${jobTitle}</strong> 🎉</p>
            <p>A próxima etapa é um <strong>questionário de perfil comportamental (DISC)</strong>.
            É rápido (cerca de 5 minutos), não existem respostas certas ou erradas.</p>
            <p>
              <a href="${link}"
                 style="display:inline-block;background:#a855f7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;">
                Responder o questionário DISC
              </a>
            </p>
            <p style="font-size: 12px; color: #64748b;">Se o botão não funcionar, copie e cole este link no navegador:<br>${link}</p>
            <p style="font-size: 12px; color: #64748b;">Mensagem automática do ATS Inteligente PME.</p>
          </div>
        `

        const message = new MailerMessage({
          from: {
            address: $app.settings().meta.senderAddress,
            name: companyName,
          },
          to: [{ address: toEmail }],
          subject: subject,
          html: html,
        })
        $app.newMailClient().send(message)
        console.log('[disc-invitations] e-mail DISC enviado para', toEmail)
      } catch (err) {
        console.error('[disc-invitations] falha ao enviar e-mail DISC:', err)
      }
    }

    const stageId = record.get('stage_id')
    const prevStage = previousStageId(record)
    if (stageId !== 'disc' || prevStage === 'disc') {
      return
    }

    // Já existe convite para esta candidatura? Não duplica.
    let existing = null
    try {
      existing = app.findFirstRecordByFilter('disc_results', 'application_id = {:appId}', {
        appId: record.id,
      })
    } catch (_) {
      existing = null
    }
    if (existing) {
      console.log('[disc-invitations] convite DISC já existe | aplicação:', record.id)
      return
    }

    const job = findJob(record.get('job_id'))
    const candidate = findCandidate(record.get('candidate_id'))
    if (!job || !candidate) return

    const candidateEmail = candidate.get('email')
    if (!candidateEmail) {
      console.error('[disc-invitations] candidato sem e-mail | aplicação:', record.id)
      return
    }

    const token = generateToken()
    try {
      app.runBatch(function (batch) {
        const results = batch.collection('disc_results')
        results.create({
          application_id: record.id,
          token: token,
          status: 'pending',
        })
      })
    } catch (err) {
      console.error('[disc-invitations] falha ao criar disc_results:', err)
      return
    }

    sendDiscEmail(
      candidateEmail,
      candidate.get('name') || 'candidato',
      job.get('title'),
      buildPublicUrl(token),
    )
  } catch (err) {
    console.error('[disc-invitations] erro no afterUpdate de applications:', err)
  } finally {
    e.next()
  }
}, 'applications')
