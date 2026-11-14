//
// Hook org_versions_server — JSVM (PocketBase v0.23+), regras server-side do
// workflow de aprovação do Organograma. O cliente envia TRANSIÇÕES (ação +
// payload mínimo) via POST no create de org_versions; o servidor valida e
// executa, de modo que nem o HTML standalone (sem auth) nem a UI autenticada
// conseguem violar as regras:
//
//   submit   → RASCUNHO → EM_APROVACAO (instância 1: Gerente de RH)
//   approve  → instância atual aprovada (não pode ser o autor);
//              instância 2 aprovada → APROVADA: anterior vira SUBSTITUIDA,
//              nós do snapshot viram os org_nodes da empresa (espelho vigente
//              que alimenta o ATS) e os job_id criados pelo hook org_nodes_sync
//              são preservados.
//   reject   → EM_APROVACAO → RASCUNHO com motivo obrigatório + RETORNO na
//              trilha; o próximo ciclo começa de novo na instância 1.
//   clone    → cria um novo RASCUNHO a partir de uma versão existente.
//
// Toda decisão grava em org_approvals (usuário, papel, instância, decisão,
// comentário) e em audit_logs (reuso de 'erp_job_updated', select fechado).
//
// IMPORTANTE: transições TERMINAM a request com e.json(...) e NÃO chamam
// e.next() — caso contrário o handler de create padrão do PocketBase tentaria
// gravar o corpo bruto como um novo registro e sobrescreveria a resposta.
// Só o create "puro" (sem action — seed de exemplo via painel) segue o fluxo
// padrão do PocketBase.
//
// Ações (POST {action: ..., ...} no corpo de um create em org_versions):
//   action=submit | approve | reject | clone
//   version_number, comment, reason, actor_name, actor_role
// Resposta: e.json({ok: true, version: {...}}) — o cliente recarrega.
//
onRecordCreateRequest((e) => {
  // PocketBase v0.23+ (JSVM): o corpo JSON da requisição está em
  // e.requestInfo().body — não em e.data.
  let payload = {}
  try {
    const info = e.requestInfo()
    payload = (info && info.body) || {}
  } catch (_) {
    payload = {}
  }
  if (!payload || typeof payload !== 'object') payload = {}
  const action = payload.action || ''

  // create normal (seed de exemplo via painel): segue o fluxo padrão.
  if (!action) {
    e.next()
    return
  }

  try {
    const app = e.app
    const auth = (info && info.auth) || null
    const actorName = (auth && (auth.get('name') || auth.get('email'))) || payload.actor_name || '—'
    const actorRole = (auth && auth.get('role')) || payload.actor_role || ''

    function maxVersionNumber(company) {
      try {
        const list = app.findRecordsByFilter(
          'org_versions',
          'company = {:c}',
          '-version_number',
          1,
          0,
          { c: company || 'Tecnobrasil' },
        )
        if (list.length > 0) return list[0].get('version_number') || 0
      } catch (_) {}
      return 0
    }

    function serialize(rec) {
      return {
        id: rec.get('id'),
        version_number: rec.get('version_number'),
        label: rec.get('label'),
        status: rec.get('status'),
        next_approver_role: rec.get('next_approver_role'),
        rejection_reason: rec.get('rejection_reason'),
      }
    }

    function findVersion(num) {
      try {
        return app.findFirstRecordByFilter('org_versions', 'version_number = {:n}', { n: num })
      } catch (_) {
        return null
      }
    }

    function trail(versionNumber, step, decision, comment, role, uid) {
      try {
        app.runInTransaction(function () {
          app.recordCreate('org_approvals', {
            version_number: versionNumber,
            company: payload.company || 'Tecnobrasil',
            step: step,
            decision: decision,
            user_name: actorName,
            user_role: role || actorRole,
            user_id: uid || (auth && auth.get('id')) || '',
            comment: comment || '',
            instance: step === 'APROVACAO_1' ? 1 : step === 'APROVACAO_2' ? 2 : 0,
          })
        })
      } catch (err) {
        console.log('org_versions_server: falha ao gravar trilha: ' + err)
      }
    }

    function audit(details) {
      try {
        app.runInTransaction(function () {
          app.recordCreate('audit_logs', {
            user_id: null,
            user_name: actorName,
            user_role: actorRole || 'system',
            action: 'erp_job_updated',
            details: details,
          })
        })
      } catch (err) {
        console.log('org_versions_server: falha ao gravar auditoria: ' + err)
      }
    }

    // Publica o snapshot da versão aprovada como os org_nodes da empresa
    // (espelho vigente que alimenta o ATS). Preserva job_id dos nós que já
    // tinham relação com vagas (criados pelo hook org_nodes_sync).
    function publishSnapshot(company, nodesJson) {
      let nodes = []
      try {
        nodes = JSON.parse(nodesJson || '[]')
      } catch (_) {
        nodes = []
      }
      if (!Array.isArray(nodes)) nodes = []

      const existing = app.findRecordsByFilter('org_nodes', 'company = {:c}', '', 500, 0, {
        c: company,
      })

      const byKey = {}
      for (const n of existing) byKey[n.get('node_key')] = n

      const keep = {}
      for (const n of nodes) {
        const key = n.id || n.node_key || ''
        if (!key) continue
        keep[key] = true
      }

      // remove nós que saíram do snapshot (proteção de remoção remota não
      // se aplica aqui: o snapshot aprovado é a fonte da verdade)
      for (const n of existing) {
        const key = n.get('node_key')
        if (!keep[key]) {
          try {
            app.delete(n)
          } catch (err) {
            console.log('org_versions_server: falha ao remover nó antigo: ' + err)
          }
        }
      }

      for (const n of nodes) {
        const key = n.id || n.node_key || ''
        if (!key) continue
        let rec = byKey[key]
        if (rec) {
          rec.set('name', n.nome || n.name || '')
          rec.set('role_title', n.cargo || n.role_title || '')
          rec.set('area', n.area || '')
          rec.set('manager', n.parentId || n.manager || '')
          rec.set('email', n.email || '')
          rec.set('location', n.localidade || n.location || '')
          rec.set('status', mapStatus(n.status))
          rec.set('photo_url', n.foto || n.photo_url || '')
          app.save(rec)
        } else {
          app.recordCreate('org_nodes', {
            node_key: key,
            name: n.nome || n.name || '',
            role_title: n.cargo || n.role_title || '',
            area: n.area || '',
            manager: n.parentId || n.manager || '',
            email: n.email || '',
            location: n.localidade || n.location || '',
            contract_type: mapContract(n.tipoContrato || n.contract_type),
            status: mapStatus(n.status),
            photo_url: n.foto || n.photo_url || '',
            company: company,
          })
        }
      }
    }

    function mapStatus(s) {
      // mesmo vocabulário do organograma.html ↔ org_nodes
      switch (s) {
        case 'vaga_aberta':
        case 'temporaria':
        case 'inativo':
          return s
        default:
          return 'ativo'
      }
    }

    function mapContract(c) {
      switch (c) {
        case 'CLT':
          return 'clt'
        case 'PJ':
          return 'pj'
        case 'Estágio':
          return 'internship'
        case 'Temporário':
          return 'temporary'
        default:
          return 'clt'
      }
    }

    // ------- clone: novo rascunho a partir de uma versão existente -------
    if (action === 'clone') {
      const src = findVersion(payload.version_number)
      if (!src) {
        e.json(400, { ok: false, error: 'Versão de origem não encontrada' })
        return
      }
      const maxNum = maxVersionNumber(payload.company || src.get('company'))
      const rec = app.recordCreate('org_versions', {
        version_number: maxNum + 1,
        label: payload.label || 'Cópia da v' + src.get('version_number'),
        status: 'RASCUNHO',
        nodes_json: src.get('nodes_json') || '[]',
        company: payload.company || src.get('company') || 'Tecnobrasil',
        created_by: actorName,
        created_by_role: actorRole || 'Elaboração',
        next_approver_role: '',
      })
      app.save(rec)
      trail(
        rec.get('version_number'),
        'ENVIO',
        '—',
        'Rascunho criado a partir da v' + src.get('version_number'),
      )
      e.json(200, { ok: true, version: serialize(rec) })
      return
    }

    // ------- submit: RASCUNHO → EM_APROVACAO -------
    if (action === 'submit') {
      const v = findVersion(payload.version_number)
      if (!v) {
        e.json(400, { ok: false, error: 'Versão não encontrada' })
        return
      }
      if (v.get('status') !== 'RASCUNHO') {
        e.json(400, { ok: false, error: 'Somente rascunhos podem ser enviados' })
        return
      }
      v.set('status', 'EM_APROVACAO')
      v.set('submitted_by', actorName)
      v.set('submitted_at', new Date().toISOString())
      v.set('rejection_reason', '')
      v.set('rejected_by', '')
      v.set('rejected_by_role', '')
      v.set('next_approver_role', 'Gerente de RH')
      app.save(v)
      trail(v.get('version_number'), 'ENVIO', '—', payload.comment || '')
      audit('Organograma v' + v.get('version_number') + ' enviado para aprovação')
      e.json(200, { ok: true, version: serialize(v) })
      return
    }

    // ------- approve: instância atual -------
    if (action === 'approve') {
      const v = findVersion(payload.version_number)
      if (!v) {
        e.json(400, { ok: false, error: 'Versão não encontrada' })
        return
      }
      if (v.get('status') !== 'EM_APROVACAO') {
        e.json(400, { ok: false, error: 'Versão não está em aprovação' })
        return
      }
      const creator = v.get('created_by') || ''
      if (creator && creator === actorName) {
        e.json(403, { ok: false, error: 'O autor não pode aprovar a própria versão' })
        return
      }
      const expected = v.get('next_approver_role') || 'Gerente de RH'
      const effRole = actorRole || payload.actor_role || expected
      if (expected && effRole !== expected && effRole !== 'admin') {
        e.json(403, {
          ok: false,
          error: 'Aguardando aprovação de ' + expected + ' (você é ' + effRole + ')',
        })
        return
      }

      const step1 = v.get('next_approver_role') === 'Gerente Administrativo'
      const step = step1 ? 'APROVACAO_2' : 'APROVACAO_1'
      const comment = payload.comment || ''
      trail(v.get('version_number'), step, 'APROVADO', comment, effRole)

      if (!step1) {
        // instância 1 aprovada → passa ao Gerente Administrativo
        v.set('next_approver_role', 'Gerente Administrativo')
        app.save(v)
        audit(
          'Organograma v' + v.get('version_number') + ' aprovado na instância 1 (Gerente de RH)',
        )
        e.json(200, { ok: true, version: serialize(v) })
        return
      }

      // instância 2 aprovada → versão vigente
      v.set('status', 'APROVADA')
      v.set('published_at', new Date().toISOString())
      v.set('next_approver_role', '')
      v.set('approved_by', actorName)
      v.set('approved_by_role', effRole)
      app.save(v)

      const company = v.get('company') || payload.company || 'Tecnobrasil'
      try {
        const prevList = app.findRecordsByFilter(
          'org_versions',
          "company = {:c} && status = 'APROVADA'",
          '',
          100,
          0,
          { c: company },
        )
        for (const prev of prevList) {
          if (prev.get('version_number') === v.get('version_number')) continue
          prev.set('status', 'SUBSTITUIDA')
          app.save(prev)
        }
      } catch (err) {
        console.log('org_versions_server: falha ao substituir versão anterior: ' + err)
      }

      try {
        publishSnapshot(company, v.get('nodes_json'))
      } catch (err) {
        console.log('org_versions_server: falha ao publicar snapshot: ' + err)
      }

      audit('Organograma v' + v.get('version_number') + ' APROVADO — nova versão vigente')
      e.json(200, { ok: true, version: serialize(v) })
      return
    }

    // ------- reject: volta a RASCUNHO com motivo -------
    if (action === 'reject') {
      const v = findVersion(payload.version_number)
      if (!v) {
        e.json(400, { ok: false, error: 'Versão não encontrada' })
        return
      }
      if (v.get('status') !== 'EM_APROVACAO') {
        e.json(400, { ok: false, error: 'Versão não está em aprovação' })
        return
      }
      const reason = (payload.reason || '').trim()
      if (!reason) {
        e.json(400, { ok: false, error: 'Motivo obrigatório para rejeitar' })
        return
      }
      const creator = v.get('created_by') || ''
      if (creator && creator === actorName) {
        e.json(403, { ok: false, error: 'O autor não pode rejeitar a própria versão' })
        return
      }
      const expected = v.get('next_approver_role') || 'Gerente de RH'
      const effRole = actorRole || payload.actor_role || expected
      if (expected && effRole !== expected && effRole !== 'admin') {
        e.json(403, { ok: false, error: 'Aguardando decisão de ' + expected })
        return
      }

      const step1 = v.get('next_approver_role') === 'Gerente Administrativo'
      const step = step1 ? 'APROVACAO_2' : 'APROVACAO_1'
      trail(v.get('version_number'), step, 'REJEITADO', reason, effRole)

      v.set('status', 'RASCUNHO')
      v.set('rejection_reason', reason)
      v.set('rejected_by', actorName)
      v.set('rejected_by_role', effRole)
      v.set('next_approver_role', '')
      app.save(v)
      // trilha de retorno ao rascunho
      trail(v.get('version_number'), 'RETORNO', '—', 'Devolveu ao autor: ' + reason, effRole)
      audit('Organograma v' + v.get('version_number') + ' rejeitado — voltou a RASCUNHO')
      e.json(200, { ok: true, version: serialize(v) })
      return
    }

    // ação desconhecida: segue o fluxo padrão (create normal)
    e.next()
  } catch (err) {
    console.log('org_versions_server: ' + err)
    try {
      e.json(500, { ok: false, error: String(err) })
    } catch (_) {}
  }
}, 'org_versions')
