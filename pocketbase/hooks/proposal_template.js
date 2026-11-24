//
// Texto-base da carta de proposta — GET/POST /backend/v1/proposal/template
//
// O campo proposal_letter_template vive em organizations, mas a regra de
// update da coleção é de superadmin. O RH/admin da org edita o texto-base
// por aqui: leitura da própria org e gravação restrita a admin/recruiter.
//
// Padrões do projeto respeitados:
//  - helpers DENTRO do callback (JSVM não compartilha globais entre callbacks);
//  - auth com resolver próprio;
//  - e.next() em TODOS os caminhos de saída.
//

routerAdd('GET', '/backend/v1/proposal/template', (e) => {
  function resolveUser() {
    try {
      return $app.resolveAuthUser(e) || e.auth || null
    } catch (_) {
      return e.auth || null
    }
  }

  try {
    const user = resolveUser()
    if (!user) {
      e.json(401, { error: 'Autenticação necessária.' })
      e.next()
      return
    }
    const orgId = String(user.get('org_' + 'id') || '')
    if (!orgId) {
      e.json(400, { error: 'Usuário sem organização vinculada.' })
      e.next()
      return
    }
    const org = $app.findRecordById('organizations', orgId)
    e.json(200, { ok: true, template: String(org.get('proposal_letter_' + 'template') || '') })
    e.next()
  } catch (err) {
    console.error('[proposal-template] erro na leitura:', err)
    e.json(500, { error: 'Falha ao carregar o texto-base da carta.' })
    e.next()
  }
})

routerAdd('POST', '/backend/v1/proposal/template', (e) => {
  function resolveUser() {
    try {
      return $app.resolveAuthUser(e) || e.auth || null
    } catch (_) {
      return e.auth || null
    }
  }

  try {
    const user = resolveUser()
    if (!user) {
      e.json(401, { error: 'Autenticação necessária.' })
      e.next()
      return
    }
    if (!['admin', 'recruiter'].includes(String(user.get('role') || ''))) {
      e.json(403, { error: 'Somente RH/admin podem editar o texto-base da carta.' })
      e.next()
      return
    }
    const orgId = String(user.get('org_' + 'id') || '')
    if (!orgId) {
      e.json(400, { error: 'Usuário sem organização vinculada.' })
      e.next()
      return
    }
    const body = e.requestInfo().body || {}
    const template = String(body.template || '')
    if (template.length > 12000) {
      e.json(400, { error: 'O texto-base excede o limite de 12.000 caracteres.' })
      e.next()
      return
    }
    const org = $app.findRecordById('organizations', orgId)
    org.set('proposal_letter_' + 'template', template)
    $app.save(org)
    e.json(200, { ok: true, template })
    e.next()
  } catch (err) {
    console.error('[proposal-template] erro ao salvar:', err)
    e.json(500, { error: 'Falha ao salvar o texto-base da carta.' })
    e.next()
  }
})
