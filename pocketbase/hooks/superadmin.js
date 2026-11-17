//
// Painel superadmin — criação atômica de organização + primeiro admin do cliente
// e contagens reais por organização (GET /backend/v1/superadmin/organizations/counts).
// POST /backend/v1/superadmin/organizations { name, slug, admin_name, admin_email,
//   admin_password, notes? } — rota EXCLUSIVA de papel superadmin (403 para os
// demais). Grava organization + usuário admin numa única transação
// ($app.runInTransaction), evita organização sem admin e admin órfão.
// 409 amigável em slug duplicado ou e-mail já cadastrado. Nunca devolve a senha.
//

routerAdd('POST', '/backend/v1/superadmin/organizations', (e) => {
  // /backend/v1/* não recebe e.auth do runtime — resolve pelo header (resolver
  // definido em menu_order_server.js).
  const auth = $app.resolveAuthUser(e)
  if (!auth) {
    return e.json(401, { error: 'Autenticação necessária.' })
  }
  if (String(auth.get('role') || '') !== 'superadmin') {
    return e.json(403, { error: 'Acesso restrito ao superadmin.' })
  }

  const body = e.requestInfo().body
  const name = String(body.name || '').trim()
  const slug = String(body.slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const adminName = String(body.admin_name || '').trim()
  const adminEmail = String(body.admin_email || '')
    .trim()
    .toLowerCase()
  const adminPassword = String(body.admin_password || '')
  const notes = String(body.notes || '').trim()

  if (!name) {
    return e.json(400, { error: 'Informe o nome da organização.', field: 'name' })
  }
  if (!slug) {
    return e.json(400, { error: 'Informe o slug da organização.', field: 'slug' })
  }
  if (!adminName) {
    return e.json(400, { error: 'Informe o nome do administrador.', field: 'admin_name' })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    return e.json(400, {
      error: 'Informe um e-mail válido para o administrador.',
      field: 'admin_email',
    })
  }
  if (adminPassword.length < 8) {
    return e.json(400, {
      error: 'A senha inicial deve ter pelo menos 8 caracteres.',
      field: 'admin_password',
    })
  }

  // Conflitos checados antes da gravação (resposta amigável 409).
  let slugOwner = null
  try {
    slugOwner = e.app.findFirstRecordByFilter('organizations', 'slug = {:s}', { s: slug })
  } catch (_) {
    slugOwner = null
  }
  if (slugOwner) {
    return e.json(409, {
      error: 'Já existe uma organização com esse slug — escolha outro.',
      field: 'slug',
    })
  }

  let emailOwner = null
  try {
    emailOwner = e.app.findAuthRecordByEmail('users', adminEmail)
  } catch (_) {
    emailOwner = null
  }
  if (emailOwner) {
    return e.json(409, {
      error: 'Já existe um usuário com este e-mail.',
      field: 'admin_email',
    })
  }

  // Transação única: organization + admin nascem juntos (ou nada).
  try {
    const orgCollection = e.app.findCollectionByNameOrId('organizations')
    const usersCollection = e.app.findCollectionByNameOrId('users')

    const result = $app.runInTransaction((txApp) => {
      const org = new Record(orgCollection)
      org.set('name', name)
      org.set('slug', slug)
      org.set('is_active', true)
      if (notes) {
        org.set('notes', notes)
      }
      txApp.save(org)

      const admin = new Record(usersCollection)
      admin.set('name', adminName)
      admin.set('email', adminEmail)
      admin.set('password', adminPassword)
      admin.set('passwordConfirm', adminPassword)
      admin.set('role', 'admin')
      admin.set('org_id', org.id)
      admin.set('verified', true)
      txApp.save(admin)

      return { orgId: org.id, adminId: admin.id }
    })

    return e.json(200, {
      organization: {
        id: result.orgId,
        name: name,
        slug: slug,
        is_active: true,
        notes: notes,
      },
      admin: { id: result.adminId, email: adminEmail, name: adminName },
    })
  } catch (err) {
    const msg = String((err && err.message) || err || '')
    console.error('[superadmin] erro ao criar organização:', msg)
    if (msg.indexOf('slug') !== -1) {
      return e.json(409, {
        error: 'Já existe uma organização com esse slug — escolha outro.',
        field: 'slug',
      })
    }
    if (msg.toLowerCase().indexOf('email') !== -1) {
      return e.json(409, {
        error: 'Já existe um usuário com este e-mail.',
        field: 'admin_email',
      })
    }
    return e.json(500, { error: 'Falha ao criar a organização. Tente novamente.' })
  }
})

//
// GET /backend/v1/superadmin/organizations/counts
// Contagens reais de usuários e empresas por organização, em uma chamada —
// substitui o expand 'orgs_users_count/orgs_companies_count', que nunca existiu
// no schema (organizations só tem name/slug/is_active/notes).
//
routerAdd('GET', '/backend/v1/superadmin/organizations/counts', (e) => {
  // /backend/v1/* não recebe e.auth do runtime — resolve pelo header (resolver
  // definido em menu_order_server.js).
  const auth = $app.resolveAuthUser(e)
  if (!auth) {
    return e.json(401, { error: 'Autenticação necessária.' })
  }
  if (String(auth.get('role') || '') !== 'superadmin') {
    return e.json(403, { error: 'Acesso restrito ao superadmin.' })
  }

  try {
    const userCounts = {}
    const usersRows = e.app
      .db()
      .newQuery("SELECT org_id, COUNT(*) AS n FROM users WHERE org_id != '' GROUP BY org_id")
      .all()
    for (let i = 0; i < usersRows.length; i++) {
      userCounts[usersRows[i].org_id] = usersRows[i].n
    }

    const companyCounts = {}
    const companyRows = e.app
      .db()
      .newQuery("SELECT org_id, COUNT(*) AS n FROM companies WHERE org_id != '' GROUP BY org_id")
      .all()
    for (let i = 0; i < companyRows.length; i++) {
      companyCounts[companyRows[i].org_id] = companyRows[i].n
    }

    return e.json(200, { counts: { users: userCounts, companies: companyCounts } })
  } catch (err) {
    console.error('[superadmin] erro ao calcular contagens:', String((err && err.message) || err))
    return e.json(500, { error: 'Falha ao calcular as contagens.' })
  }
})
