//
// Sincronização ATS → Organograma (PocketBase v0.23+ JSVM).
// Quando uma vaga muda de status, o nó correspondente em org_nodes é
// criado/atualizado:
//   - published  → cria/atualiza o nó de vaga aberta (status 'vaga_aberta'),
//                  ligado ao cargo/área e ao job_id (relation).
//   - closed     → marca o nó como 'inativo' (posição fechada).
//   - contratado → preenche o nó com o contratado (status 'ativo') quando
//                  existir candidatura contratada ('hired') na vaga.
// Cada transição grava um registro em audit_logs (quem fez e o que mudou).
//
// Importante 1: a JSVM executa callbacks em pool separado — helpers vivem
// DENTRO do callback. Falha de sync nunca quebra a request da vaga.
// Importante 2: e.next() é chamado em TODOS os caminhos de saída (obrigatório
// desde v0.23) — por isso o corpo inteiro roda dentro de try/finally.
//

onRecordAfterUpdateSuccess((e) => {
  try {
    const app = e.app
    const job = e.record
    const prev = e.record.original()

    // Helpers primeiro (evita depender de hoisting antes do primeiro retorno).
    function findOrgNode(jobId) {
      try {
        return app.findFirstRecordByFilter('org_nodes', 'job_id = {:jobId}', { jobId: jobId })
      } catch (_) {
        return null
      }
    }

    function findHiredCandidateName(jobId) {
      try {
        const hired = app.findFirstRecordByFilter(
          'applications',
          'job_id = {:jobId} && status = "hired"',
          { jobId: jobId },
        )
        if (!hired) return ''
        const cand = app.findRecordById('candidates', hired.get('candidate_id'))
        return (cand && cand.get('name')) || ''
      } catch (_) {
        return ''
      }
    }

    // audit_logs.action é um select fechado: 'job_published'/'job_closed' não
    // existem — reusa 'erp_job_updated' com details explicando a transição.
    function syncAudit(details) {
      try {
        app.runInTransaction(function () {
          app.recordCreate('audit_logs', {
            user_id: null,
            user_name: 'Sistema (integração Organograma)',
            user_role: 'system',
            action: 'erp_job_updated',
            details: details,
          })
        })
      } catch (err) {
        console.log('org_nodes_sync: falha ao gravar auditoria: ' + err)
      }
    }

    const status = job.get('status') || ''
    const prevStatus = prev.get('status') || ''
    if (status === prevStatus) {
      // Vaga já publicada foi editada: propaga título/área/localidade ao nó
      if (status === 'published') {
        try {
          const node = findOrgNode(job.get('id'))
          if (node) {
            const t = job.get('title') || ''
            const d = job.get('department') || ''
            const l = job.get('location') || ''
            if (
              (node.get('role_title') || '') !== t ||
              (node.get('area') || '') !== d ||
              (node.get('location') || '') !== l
            ) {
              node.set('role_title', t)
              node.set('area', d)
              node.set('location', l)
              app.save(node)
              syncAudit(
                'Vaga publicada "' +
                  t +
                  '" atualizada — nó do organograma sincronizado. (vaga_atualizada)',
              )
            }
          }
        } catch (err) {
          console.log('org_nodes_sync: falha ao propagar edição da vaga publicada: ' + err)
        }
      }
      return
    }

    // Só interessam as transições publicar / fechar
    const publishing = status === 'published' && prevStatus !== 'published'
    const closing = prevStatus === 'published' && status === 'closed'
    if (!publishing && !closing) return

    const title = job.get('title') || 'Vaga sem título'
    const dept = job.get('department') || ''
    const loc = job.get('location') || ''
    const jobId = job.get('id')

    if (publishing) {
      // Cria ou atualiza o nó vazio destacado da vaga aberta
      let node = findOrgNode(jobId)
      if (node) {
        node.set('status', 'vaga_aberta')
        node.set('name', 'A Definir')
        node.set('role_title', title)
        node.set('area', dept)
        node.set('location', loc)
        node.set('job_id', jobId)
        app.save(node)
      } else {
        node = app.recordCreate('org_nodes', {
          node_key: 'job-' + jobId,
          name: 'A Definir',
          role_title: title,
          area: dept,
          email: '',
          location: loc,
          contract_type: 'clt',
          status: 'vaga_aberta',
          photo_url: '',
          job_id: jobId,
          company: 'Tecnobrasil',
        })
        app.save(node)
      }
      syncAudit(
        'Vaga "' +
          title +
          '" publicada — nó de vaga aberta criado/atualizado no organograma (vaga_publicada).',
      )
      return
    }

    if (closing) {
      const node = findOrgNode(jobId)
      if (!node) return // vaga publicada antes da integração: nada a atualizar
      const hiredName = findHiredCandidateName(jobId)
      if (hiredName) {
        node.set('name', hiredName)
        node.set('status', 'ativo')
        node.set('start_date', new Date().toISOString())
      } else {
        node.set('status', 'inativo')
      }
      app.save(node)
      syncAudit(
        'Vaga "' +
          title +
          '" fechada — nó do organograma ' +
          (hiredName
            ? 'preenchido com ' + hiredName + ' (contratação). (vaga_fechada)'
            : 'marcado como fechado. (vaga_fechada)'),
      )
    }
  } catch (err) {
    console.log('org_nodes_sync: ' + err)
  } finally {
    e.next()
  }
}, 'jobs')
