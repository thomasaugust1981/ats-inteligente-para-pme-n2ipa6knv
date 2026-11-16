//
// Hook cargo_server — FASE 2 do fluxo Organograma → Cargo → Vaga.
// Server-side enforcement das regras do ciclo de aprovação do CARGO.
// O cliente envia TRANSIÇÕES (action + payload mínimo) via POST no create de
// cargos; o servidor valida e executa, de modo que a UI não consiga violar:
//
//   create puro (sem action) → valida: posição (org_node_id) obrigatória e
//     APROVADA no organograma VIGENTE (versão APROVADA mais recente), nível
//     único por posição (duplicidade no mesmo nível bloqueada), CHA completo,
//     finalidade obrigatória → grava como RASCUNHO com autor.
//   action=submit   → RASCUNHO/REPROVADO → EM_APROVACAO
//   action=approve  → EM_APROVACAO → APROVADO (comentário obrigatório; o autor
//                     não pode aprovar; admin/superadmin apenas)
//   action=reject   → EM_APROVACAO → REPROVADO (justificativa obrigatória; o
//                     autor não pode rejeitar)
//   action=convert  → conversão de finalidade para PREENCHIMENTO (permitida
//                     para cargo APROVADO) — grava evento auditável em
//                     cargo_approvals com autor, data, finalidade anterior e
//                     nova; NÃO é edição silenciosa.
//   update          → posição (org_node_id) é IMUTÁVEL após a criação; tentar
//                     mudá-la rejeita com 400.
//
// Toda transição grava em cargo_approvals (autor, papel, comentário,
// de_status → para_status) e a conversão de finalidade grava from_value /
// to_value — registro auditável completo.
//
// IMPORTANTE JSVM: callbacks rodam em VMs separadas — toda a lógica fica
// DENTRO do callback (nenhuma função top-level referenciada de dentro dele).
//
onRecordCreateRequest((e) => {
  let payload = {}
  let info = null
  try {
    info = e.requestInfo()
    payload = (info && info.body) || {}
  } catch (_) {
    payload = {}
  }
  if (!payload || typeof payload !== 'object') payload = {}
  const action = payload.action || ''

  if (!action) {
    // ---------- CREATE "PURO": validações da FASE 2 ----------
    const app = e.app
    const auth = (info && info.auth) || null
    const role = (auth && auth.get('role')) || ''

    // recrutador não cria cargo (regra da coleção também bloqueia, mas o
    // erro aqui é mais claro)
    if (role === 'recruiter') {
      e.json(403, {
        ok: false,
        error:
          'Recrutador não cria cargo — apenas visualiza. A vaga e a avaliação são editáveis pelo recrutador.',
      })
      return
    }

    const nodeId = String(payload.org_node_id || '')
    if (!nodeId) {
      e.json(400, {
        ok: false,
        error:
          'Posição do organograma é obrigatória — cargos só são criados a partir de uma posição APROVADA no organograma vigente.',
      })
      return
    }

    let node = null
    try {
      node = app.findRecordById('org_nodes', nodeId)
    } catch (_) {
      node = null
    }
    if (!node) {
      e.json(400, { ok: false, error: 'Posição do organograma não encontrada.' })
      return
    }

    // A posição precisa pertencer à org do usuário (isolamento)
    const authOrg = (auth && auth.get('org_id')) || ''
    if (role !== 'superadmin' && authOrg && String(node.get('org_id') || '') !== String(authOrg)) {
      e.json(403, { ok: false, error: 'Posição pertence a outra organização.' })
      return
    }

    // Posição precisa estar APROVADA: existe no organograma VIGENTE (versão
    // APROVADA mais recente da empresa). Checa por node_key dentro do
    // nodes_json da versão vigente (a publicação espelha em org_nodes, mas
    // revalidar garante que a posição não saiu do snapshot atual).
    const nodeKey = String(node.get('node_key') || '')
    const company = String(node.get('company') || '')
    let vigenteOk = false
    try {
      const vers = app.findRecordsByFilter(
        'org_versions',
        company ? "status = 'APROVADA' && company = {:c}" : "status = 'APROVADA'",
        '-version_number',
        1,
        0,
        { c: company },
      )
      if (vers.length > 0) {
        let nodes = []
        try {
          nodes = JSON.parse(vers[0].get('nodes_json') || '[]')
        } catch (_) {
          nodes = []
        }
        if (!Array.isArray(nodes)) nodes = []
        // a posição vigente é identificada por node_key (ou id no snapshot)
        for (const n of nodes) {
          const k = n.id || n.node_key || ''
          if (k === nodeKey) {
            vigenteOk = true
            break
          }
        }
      } else {
        // sem versão APROVADA publicada: aceita o espelho org_nodes se a
        // posição está ativa (organograma legado sem ciclo de aprovação)
        vigenteOk = String(node.get('status') || '') === 'ativo'
      }
    } catch (err) {
      console.log('cargo_server: falha ao checar versão vigente: ' + err)
      // fallback defensivo: posição ativa no espelho
      vigenteOk = String(node.get('status') || '') === 'ativo'
    }

    if (!vigenteOk || String(node.get('status') || '') === 'inativo') {
      e.json(400, {
        ok: false,
        error:
          'A posição "' +
          String(node.get('name') || '') +
          '" não está APROVADA no organograma vigente — não é possível criar cargo a partir dela.',
      })
      return
    }

    // Duplicidade: uma posição só aceita mais de um cargo se o nível for
    // DIFERENTE. Mesmo nível já existente para a posição → bloqueia.
    const level = String(payload.level || '')
    if (level) {
      try {
        const dup = app.findRecordsByFilter(
          'cargos',
          'org_node_id = {:n} && level = {:l}',
          '',
          2,
          0,
          { n: nodeId, l: level },
        )
        if (dup.length > 0) {
          e.json(400, {
            ok: false,
            error:
              'A posição "' +
              String(node.get('name') || '') +
              '" já tem um cargo no nível "' +
              level +
              '". Uma posição só pode ter mais de um cargo em níveis diferentes (júnior/pleno/sênior).',
          })
          return
        }
      } catch (err) {
        console.log('cargo_server: falha ao checar duplicidade: ' + err)
      }
    }

    // Finalidade obrigatória
    const purpose = String(payload.purpose || '')
    const VALID = ['PREENCHIMENTO', 'ESTRUTURAL', 'SUCCESSAO', 'PROMOCAO']
    if (VALID.indexOf(purpose) === -1) {
      e.json(400, {
        ok: false,
        error: 'Finalidade obrigatória: PREENCHIMENTO, ESTRUTURAL, SUCCESSAO ou PROMOCAO.',
      })
      return
    }

    // CHA: os três blocos precisam ter pelo menos 1 requisito (validação
    // cliente + server)
    let cha = payload.cha
    if (typeof cha === 'string') {
      try {
        cha = JSON.parse(cha)
      } catch (_) {
        cha = null
      }
    }
    const blocks = ['conhecimentos', 'habilidades', 'atitudes']
    for (const b of blocks) {
      const items = (cha && cha[b] && cha[b].items) || []
      if (!Array.isArray(items) || items.length === 0) {
        e.json(400, {
          ok: false,
          error: 'O bloco "' + b + '" do CHA precisa de pelo menos 1 requisito.',
        })
        return
      }
    }

    // Status inicial + autor — gravados server-side (o cliente não escolhe)
    e.record.set('status', 'RASCUNHO')
    e.record.set('created_by', (auth && (auth.get('name') || auth.get('email'))) || '')
    e.record.set('created_by_role', role)
    e.record.set('created_by_id', (auth && auth.get('id')) || '')
    const sMin = e.record.get('salary_min')
    const sMed = e.record.get('salary_med')
    const sMax = e.record.get('salary_max')
    const hasSalary =
      (sMin !== undefined && sMin !== null && String(sMin) !== '') ||
      (sMed !== undefined && sMed !== null && String(sMed) !== '') ||
      (sMax !== undefined && sMax !== null && String(sMax) !== '')
    // Regra financeira (FASE 3): cargo sem faixa salarial fica FORA da base de
    // custo de pessoal — o dado é garantido aqui, na origem.
    e.record.set('salary_defined', hasSalary)

    e.next()
    return
  }

  // ---------- TRANSIÇÕES (action) ----------
  const app = e.app
  const auth = (info && info.auth) || null
  const role = (auth && auth.get('role')) || ''
  const actorName = (auth && (auth.get('name') || auth.get('email'))) || payload.actor_name || '—'
  const actorId = (auth && auth.get('id')) || ''
  const authOrg = (auth && auth.get('org_id')) || ''

  // O alvo da transição vem no corpo (cargo_id) — no create o e.record é o
  // corpo novo, NÃO o cargo existente.
  let rec = null
  const targetId = String(payload.cargo_id || '')
  if (targetId) {
    try {
      rec = app.findRecordById('cargos', targetId)
    } catch (_) {
      rec = null
    }
  }
  if (!rec) {
    e.json(404, { ok: false, error: 'Cargo não encontrado para a transição.' })
    return
  }
  // isolamento por organização
  if (role !== 'superadmin' && authOrg && String(rec.get('org_id') || '') !== String(authOrg)) {
    e.json(403, { ok: false, error: 'Cargo pertence a outra organização.' })
    return
  }

  function cargoTitle(rec) {
    return String(rec.get('title') || '')
  }

  function trail(rec, step, decision, comment, fromStatus, toStatus, fromValue, toValue) {
    try {
      app.recordCreate('cargo_approvals', {
        cargo_id: rec.get('id'),
        cargo_title: cargoTitle(rec),
        step: step,
        decision: decision,
        from_status: fromStatus || '',
        to_status: toStatus || '',
        from_value: fromValue || '',
        to_value: toValue || '',
        comment: comment || '',
        user_name: actorName,
        user_role: role,
        user_id: actorId,
        org_id: (auth && auth.get('org_id')) || String(rec.get('org_id') || ''),
      })
    } catch (err) {
      console.log('cargo_server: falha ao gravar trilha: ' + err)
    }
  }

  // ------- submit: RASCUNHO/REPROVADO → EM_APROVACAO -------
  if (action === 'submit') {
    const st = String(rec.get('status') || '')
    if (st !== 'RASCUNHO' && st !== 'REPROVADO') {
      e.json(400, {
        ok: false,
        error: 'Somente cargos em RASCUNHO ou REPROVADO podem ser enviados para aprovação.',
      })
      return
    }
    if (role === 'recruiter') {
      e.json(403, { ok: false, error: 'Recrutador não gerencia o ciclo de aprovação do cargo.' })
      return
    }
    rec.set('status', 'EM_APROVACAO')
    rec.set('submitted_at', new Date().toISOString())
    rec.set('rejection_reason', '')
    rec.set('rejected_by', '')
    rec.set('rejected_by_role', '')
    app.save(rec)
    trail(rec, 'ENVIO', '—', payload.comment || '', st, 'EM_APROVACAO')
    e.json(200, { ok: true, status: 'EM_APROVACAO' })
    return
  }

  // ------- approve: EM_APROVACAO → APROVADO -------
  if (action === 'approve') {
    if (String(rec.get('status') || '') !== 'EM_APROVACAO') {
      e.json(400, { ok: false, error: 'Cargo não está em aprovação.' })
      return
    }
    if (role !== 'admin' && role !== 'superadmin') {
      e.json(403, { ok: false, error: 'Apenas admin ou superadmin aprovam cargos.' })
      return
    }
    const author = String(rec.get('created_by_id') || '')
    if (author && author === actorId) {
      e.json(403, { ok: false, error: 'O autor do cargo não pode aprová-lo.' })
      return
    }
    const comment = String(payload.comment || '').trim()
    if (!comment) {
      e.json(400, { ok: false, error: 'Comentário obrigatório para aprovar o cargo.' })
      return
    }
    const st = String(rec.get('status') || '')
    rec.set('status', 'APROVADO')
    rec.set('approved_by', actorName)
    rec.set('approved_by_role', role)
    rec.set('approved_at', new Date().toISOString())
    app.save(rec)
    trail(rec, 'APROVACAO', 'APROVADO', comment, st, 'APROVADO')
    e.json(200, { ok: true, status: 'APROVADO' })
    return
  }

  // ------- reject: EM_APROVACAO → REPROVADO -------
  if (action === 'reject') {
    if (String(rec.get('status') || '') !== 'EM_APROVACAO') {
      e.json(400, { ok: false, error: 'Cargo não está em aprovação.' })
      return
    }
    if (role !== 'admin' && role !== 'superadmin') {
      e.json(403, { ok: false, error: 'Apenas admin ou superadmin rejeitam cargos.' })
      return
    }
    const author = String(rec.get('created_by_id') || '')
    if (author && author === actorId) {
      e.json(403, { ok: false, error: 'O autor do cargo não pode rejeitá-lo.' })
      return
    }
    const reason = String(payload.reason || '').trim()
    if (!reason) {
      e.json(400, { ok: false, error: 'Justificativa obrigatória para reprovar o cargo.' })
      return
    }
    const st = String(rec.get('status') || '')
    rec.set('status', 'REPROVADO')
    rec.set('rejection_reason', reason)
    rec.set('rejected_by', actorName)
    rec.set('rejected_by_role', role)
    app.save(rec)
    trail(rec, 'REJEICAO', 'REJEITADO', reason, st, 'REPROVADO')
    e.json(200, { ok: true, status: 'REPROVADO' })
    return
  }

  // ------- convert: conversão de finalidade → PREENCHIMENTO (auditável) -------
  if (action === 'convert') {
    if (String(rec.get('status') || '') !== 'APROVADO') {
      e.json(400, {
        ok: false,
        error: 'Apenas cargos APROVADOS podem ter a finalidade convertida.',
      })
      return
    }
    if (role === 'recruiter') {
      e.json(403, { ok: false, error: 'Recrutador não converte a finalidade do cargo.' })
      return
    }
    const target = String(payload.purpose || '')
    if (target !== 'PREENCHIMENTO') {
      e.json(400, {
        ok: false,
        error:
          'A conversão é registrada apenas para a finalidade PREENCHIMENTO (recrutamento em seguida).',
      })
      return
    }
    const prev = String(rec.get('purpose') || '')
    if (prev === 'PREENCHIMENTO') {
      e.json(400, { ok: false, error: 'O cargo já tem finalidade PREENCHIMENTO.' })
      return
    }
    rec.set('purpose', 'PREENCHIMENTO')
    app.save(rec)
    // evento auditável: autor, data (created da trilha), finalidade anterior e nova
    trail(rec, 'CONVERSAO', 'CONVERTIDO', payload.comment || '', '', '', prev, 'PREENCHIMENTO')
    e.json(200, { ok: true, purpose: 'PREENCHIMENTO' })
    return
  }

  // ação desconhecida: segue o fluxo padrão do PocketBase
  e.next()
}, 'cargos')

//
// OnRecordAfterCreateRequest — trilha de CRIAÇÃO (precisa do id do cargo,
// que só existe depois do save).
//
onRecordAfterCreateSuccess((e) => {
  const rec = e.record
  try {
    const info = $app.requestInfo()
    const auth = (info && info.auth) || null
    const role = (auth && auth.get('role')) || ''
    let nodeName = ''
    const nodeId = String(rec.get('org_node_id') || '')
    if (nodeId) {
      try {
        const node = e.app.findRecordById('org_nodes', nodeId)
        nodeName = String(node.get('name') || '')
      } catch (_) {
        nodeName = ''
      }
    }
    const trailRec = new Record($app.findCollectionByNameOrId('cargo_approvals'))
    trailRec.set('cargo_id', rec.id)
    trailRec.set('cargo_title', String(rec.get('title') || ''))
    trailRec.set('step', 'CRIACAO')
    trailRec.set('decision', '—')
    trailRec.set('to_status', String(rec.get('status') || 'RASCUNHO'))
    trailRec.set(
      'comment',
      'Posição: ' + (nodeName || '—') + ' · Finalidade: ' + String(rec.get('purpose') || '—'),
    )
    trailRec.set('user_name', String((auth && (auth.get('name') || auth.get('email'))) || '—'))
    trailRec.set('user_role', String(role))
    trailRec.set('user_id', String((auth && auth.get('id')) || ''))
    trailRec.set('org_id', String((auth && auth.get('org_id')) || rec.get('org_id') || ''))
    $app.save(trailRec)
  } catch (err) {
    console.log('cargo_server: falha ao gravar trilha de criação: ' + err)
  }
  e.next()
}, 'cargos')

//
// OnRecordUpdateRequest — LOCK da posição: org_node_id é imutável após a
// criação. Qualquer tentativa de mudá-lo rejeita com 400.
//
onRecordUpdateRequest((e) => {
  let payload = {}
  try {
    const info = e.requestInfo()
    payload = (info && info.body) || {}
  } catch (_) {
    payload = {}
  }
  if (!payload || typeof payload !== 'object') {
    e.next()
    return
  }

  if (payload.org_node_id !== undefined && payload.org_node_id !== null) {
    const current = String(e.record.get('org_node_id') || '')
    const incoming = String(payload.org_node_id || '')
    if (incoming && incoming !== current) {
      e.json(400, {
        ok: false,
        error: 'A posição do organograma não pode ser alterada após a criação do cargo.',
      })
      return
    }
  }

  e.next()
}, 'cargos')
