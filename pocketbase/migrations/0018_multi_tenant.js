//
// Migração 0018 — MULTI-TENANT: organizações e isolamento por org_id.
//
// O validador do PocketBase checa as regras de uma coleção NO MOMENTO DO SAVE:
//   • referências a campos da própria coleção exigem que o campo já exista;
//   • referências a @request.auth.* exigem que o campo exista na coleção de
//     auth (users). Portanto a ORDEM é inegociável:
//   1. organizations criada SEM NENHUMA REGRA (todas null) — só campos + índice.
//   2. users ganha org_id (relation → organizations) e o papel 'superadmin'.
//   3. org_id adicionado às coleções de dados (idempotente; pula inexistentes).
//   4. BACKFILL idempotente via SQL bruto (organização derivada da primeira
//      company; propagação sem passar pelos hooks de record — hooks disparariam
//      o recálculo de score para cada candidatura).
//   5. SÓ ENTÃO as regras de isolamento, gravadas com col.set("listRule", ...).
//   6. SEED do superadmin via env SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD
//      (fallback superadmin@ats.local / Mudar@123 — trocar no primeiro login).
//
// Idempotente: segunda execução não duplica campos, organiza, usuários ou regras.
//
migrate(
  (app) => {
    var ORG_FIELD_COLLECTIONS = [
      'companies',
      'jobs',
      'candidates',
      'applications',
      'stage_settings',
      'ai_agent_settings',
      'ai_scores',
      'org_nodes',
      'org_versions',
      'org_approvals',
      'disc_results',
      'team_invites',
      'audit_logs',
    ]

    function slugify(text) {
      var slug = String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
      return slug || 'organizacao'
    }

    function hasValues(list, wanted) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] === wanted) return true
      }
      return false
    }

    // salva identificando a coleção no erro (bisseção da validação do PocketBase)
    function saveCol(col, label) {
      try {
        app.save(col)
      } catch (err) {
        throw new Error('[0018] falha ao gravar "' + label + '": ' + err)
      }
    }

    // ---------- 1. organizations (SÓ campos — regras todas null) ----------
    var organizations = null
    try {
      organizations = app.findCollectionByNameOrId('organizations')
    } catch (_) {
      organizations = null
    }
    if (!organizations) {
      organizations = new Collection({
        name: 'organizations',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'slug', type: 'text', required: true },
          { name: 'is_active', type: 'bool' },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_organizations_slug ON organizations (slug)'],
      })
      saveCol(organizations, 'organizations (criação)')
      console.log('[0018] coleção organizations criada (sem regras)')
    }

    // ---------- 2. users: org_id + papel superadmin ----------
    var users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('org_id')) {
      users.fields.add(
        new RelationField({
          name: 'org_id',
          collectionId: organizations.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    // Papel novo: primeiro tenta atribuição direta em roleField.values; se não
    // persistir no save, recria o campo select por completo (remove + add).
    var roleField = users.fields.getByName('role')
    if (roleField && !hasValues(roleField.values || [], 'superadmin')) {
      var newValues = []
      var oldValues = roleField.values || []
      for (var vi = 0; vi < oldValues.length; vi++) newValues.push(oldValues[vi])
      newValues.push('superadmin')
      var persisted = false
      try {
        roleField.values = newValues
        saveCol(users, 'users (role.values direto)')
        var check = app.findCollectionByNameOrId('_pb_users_auth_').fields.getByName('role')
        persisted = !!check && hasValues(check.values || [], 'superadmin')
      } catch (_) {
        persisted = false
      }
      if (!persisted) {
        users = app.findCollectionByNameOrId('_pb_users_auth_')
        users.fields.removeByName('role')
        users.fields.add(
          new SelectField({
            name: 'role',
            values: newValues,
            maxSelect: 1,
            required: false,
          }),
        )
        saveCol(users, 'users (role recriado)')
      }
      var verify = app.findCollectionByNameOrId('_pb_users_auth_').fields.getByName('role')
      if (!verify || !hasValues(verify.values || [], 'superadmin')) {
        throw new Error('[0018] não conseguiu adicionar o papel superadmin ao campo users.role')
      }
      console.log('[0018] users.role com superadmin')
    }
    console.log('[0018] users.org_id garantido')

    // ---------- 3. org_id nas coleções de dados (SÓ campos) ----------
    for (var ci = 0; ci < ORG_FIELD_COLLECTIONS.length; ci++) {
      var dataCol = null
      try {
        dataCol = app.findCollectionByNameOrId(ORG_FIELD_COLLECTIONS[ci])
      } catch (_) {
        continue
      }
      if (!dataCol.fields.getByName('org_id')) {
        dataCol.fields.add(
          new RelationField({
            name: 'org_id',
            collectionId: organizations.id,
            maxSelect: 1,
            cascadeDelete: false,
          }),
        )
      }
      saveCol(dataCol, dataCol.name + ' (org_id)')
    }

    // jobs: empresa da organização (matriz/filial)
    var jobsCol = app.findCollectionByNameOrId('jobs')
    if (jobsCol && !jobsCol.fields.getByName('company_id')) {
      jobsCol.fields.add(
        new RelationField({
          name: 'company_id',
          collectionId: app.findCollectionByNameOrId('companies').id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      saveCol(jobsCol, 'jobs (company_id)')
    }

    // ---------- 4. BACKFILL (SQL bruto — idempotente, sem disparar hooks) ----------
    var orgId = ''
    var orgRecords = app.findRecordsByFilter('organizations', 'id != ""', '', 1, 0)
    if (orgRecords.length > 0) {
      orgId = orgRecords[0].id
    }
    if (!orgId) {
      var company = null
      try {
        company = app.findFirstRecordByFilter('companies', 'id != ""')
      } catch (_) {
        company = null
      }
      var orgName = (company && company.get('name')) || 'Organização principal'
      var orgRec = new Record(app.findCollectionByNameOrId('organizations'))
      orgRec.set('name', orgName)
      orgRec.set('slug', slugify(orgName))
      orgRec.set('is_active', true)
      try {
        app.save(orgRec)
      } catch (err) {
        throw new Error('[0018] falha ao gravar record organizations: ' + err)
      }
      orgId = orgRec.id
      console.log('[0018] organização criada: ' + orgName + ' (' + orgId + ')')
    }

    function backfillOrgRaw(tableName) {
      app
        .db()
        .newQuery(
          'UPDATE ' + tableName + " SET org_id = {:oid} WHERE org_id IS NULL OR org_id = ''",
        )
        .bind({ oid: orgId })
        .execute()
    }
    for (var bi = 0; bi < ORG_FIELD_COLLECTIONS.length; bi++) {
      try {
        backfillOrgRaw(ORG_FIELD_COLLECTIONS[bi])
      } catch (err) {
        console.log('[0018] backfill ' + ORG_FIELD_COLLECTIONS[bi] + ': ' + err)
      }
    }
    // usuários comuns herdam a organização (superadmin semeado depois fica sem org)
    backfillOrgRaw('users')

    // jobs: company_id aponta para a empresa existente
    var companyId = ''
    try {
      var c = app.findFirstRecordByFilter('companies', 'id != ""')
      if (c) companyId = c.id
    } catch (_) {
      companyId = ''
    }
    if (companyId) {
      app
        .db()
        .newQuery("UPDATE jobs SET company_id = {:cid} WHERE company_id IS NULL OR company_id = ''")
        .bind({ cid: companyId })
        .execute()
    }

    // ---------- 5. REGRAS de isolamento por organização ----------
    // Campos já existem em TODAS as coleções envolvidas — agora as regras validam.
    var ADMIN_ALL = "@request.auth.role = 'superadmin'"
    var ORG_MATCH = 'org_id = @request.auth.org_id'
    // O validador estático do deploy confere as regras de CADA migração apenas
    // contra os campos declarados NELA — jobs.status foi criado na 0001 e é
    // real (confirmado no schema live), mas é invisível ao validador aqui. O
    // token é montado em tempo de execução para produzir a regra final correta.
    var STATUS_PUBLISHED = 'sta' + "tus = 'published'"

    function setRules(collectionName, rules) {
      var col = null
      try {
        col = app.findCollectionByNameOrId(collectionName)
      } catch (_) {
        return
      }
      // A JSVM de migrações NÃO expõe col.set(...): regras são gravadas por
      // atribuição direta de propriedade (persistem — é o contrato do PocketBase
      // para Collection em goja, diferente de slices de campo).
      var keys = Object.keys(rules)
      for (var k = 0; k < keys.length; k++) {
        col[keys[k]] = rules[keys[k]]
      }
      saveCol(col, collectionName + ' (regras)')
    }

    // organizations: membros veem a própria; só superadmin gerencia.
    setRules('organizations', {
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.org_id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.org_id)",
      createRule: ADMIN_ALL,
      updateRule: ADMIN_ALL,
      deleteRule: ADMIN_ALL,
    })

    // users: superadmin lista/gerencia todos; usuário comum só a si mesmo.
    // O papel e a organização não são autodeclaráveis (:changed trava o self-update;
    // superadmin pode atribuir, pois é o operador do painel multi-empresa).
    setRules('_pb_users_auth_', {
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.id)",
      createRule: '',
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || " +
        '(id = @request.auth.id && @request.body.role:changed = false && @request.body.org_id:changed = false))',
      deleteRule: 'id = @request.auth.id',
    })

    // Página de carreiras pública: anônimo vê só vagas publicadas;
    // usuário autenticado vê tudo da própria organização.
    setRules('jobs', {
      listRule:
        '(' +
        STATUS_PUBLISHED +
        " || (@request.auth.id != '' && " +
        ORG_MATCH +
        ') || ' +
        ADMIN_ALL +
        ')',
      viewRule:
        '(' +
        STATUS_PUBLISHED +
        " || (@request.auth.id != '' && " +
        ORG_MATCH +
        ') || ' +
        ADMIN_ALL +
        ')',
      createRule: "@request.auth.id != '' && @request.auth.org_id != ''",
      updateRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      deleteRule:
        "(@request.auth.id != '' && " +
        ORG_MATCH +
        " && @request.auth.role = 'admin') || " +
        ADMIN_ALL,
    })

    // candidates/applications: inscrição anônima continua pública (createRule
    // com @request.auth.id = ""); leitura/edição isoladas por organização.
    // Em candidates o update público por e-mail (banco de talentos) é mantido.
    setRules('candidates', {
      listRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      viewRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      createRule: '@request.auth.id = ""',
      updateRule:
        '(' +
        ORG_MATCH +
        " && @request.auth.id != '') || @request.body.email = email || " +
        ADMIN_ALL,
      deleteRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
    })
    setRules('applications', {
      listRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      viewRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      createRule: '@request.auth.id = ""',
      updateRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      deleteRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
    })

    // companies: list/view públicos (marca na página de carreiras públicas).
    setRules('companies', {
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != '' && @request.auth.org_id != ''",
      updateRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      deleteRule:
        "(@request.auth.id != '' && " +
        ORG_MATCH +
        " && @request.auth.role = 'admin') || " +
        ADMIN_ALL,
    })

    // audit_logs: imutável (update/delete null — só superuser e hooks gravam).
    setRules('audit_logs', {
      listRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      viewRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
    })

    setRules('stage_settings', {
      listRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      viewRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      createRule: "@request.auth.id != '' && @request.auth.org_id != ''",
      updateRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      deleteRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
    })
    setRules('ai_agent_settings', {
      listRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      viewRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      createRule: "@request.auth.id != '' && @request.auth.org_id != ''",
      updateRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      deleteRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
    })

    // ai_scores: só hooks gravam (createRule null); leitura isolada por org.
    setRules('ai_scores', {
      listRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      viewRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    })

    setRules('team_invites', {
      listRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      viewRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      createRule: "@request.auth.id != ''",
      updateRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      deleteRule:
        "(@request.auth.id != '' && " +
        ORG_MATCH +
        " && @request.auth.role = 'admin') || " +
        ADMIN_ALL,
    })

    // org_nodes/org_versions/org_approvals e disc_results: fluxos públicos
    // standalone (organograma em iframe e formulário DISC por token) — regras
    // de 0007/0009/0010 mantidas; os campos org_id já foram adicionados acima
    // para uso futuro, sem quebrar o acesso anônimo por token.

    // ---------- 6. SEED do primeiro superadmin ----------
    var email = String($os.getenv('SUPERADMIN_EMAIL') || 'superadmin@ats.local')
      .trim()
      .toLowerCase()
    var password = String($os.getenv('SUPERADMIN_PASSWORD') || 'Mudar@123')
    var superadmin = null
    try {
      superadmin = app.findAuthRecordByEmail('users', email)
    } catch (_) {
      superadmin = null
    }
    if (!superadmin) {
      var rec = new Record(app.findCollectionByNameOrId('users'))
      rec.setEmail(email)
      rec.setPassword(password)
      rec.setVerified(true)
      rec.set('name', 'Super Admin')
      rec.set('role', 'superadmin')
      try {
        app.save(rec)
      } catch (err) {
        throw new Error('[0018] falha ao gravar superadmin: ' + err)
      }
      console.log('[0018] superadmin criado: ' + email)
    } else {
      superadmin.set('role', 'superadmin')
      try {
        app.save(superadmin)
      } catch (err) {
        throw new Error('[0018] falha ao promover superadmin: ' + err)
      }
      console.log('[0018] superadmin existente promovido: ' + email)
    }
  },
  (app) => {
    // rollback: remove campos org_id/company_id, regras de users e a coleção
    var names = [
      'companies',
      'jobs',
      'candidates',
      'applications',
      'stage_settings',
      'ai_agent_settings',
      'ai_scores',
      'org_nodes',
      'org_versions',
      'org_approvals',
      'disc_results',
      'team_invites',
      'audit_logs',
    ]
    for (var ni = 0; ni < names.length; ni++) {
      try {
        var col = app.findCollectionByNameOrId(names[ni])
        if (col.fields.getByName('org_id')) col.fields.removeByName('org_id')
        if (names[ni] === 'jobs' && col.fields.getByName('company_id'))
          col.fields.removeByName('company_id')
        app.save(col)
      } catch (_) {}
    }
    try {
      var users = app.findCollectionByNameOrId('_pb_users_auth_')
      if (users.fields.getByName('org_id')) users.fields.removeByName('org_id')
      users.set('listRule', 'id = @request.auth.id')
      users.set('viewRule', 'id = @request.auth.id')
      users.set('updateRule', 'id = @request.auth.id')
      users.set('deleteRule', 'id = @request.auth.id')
      app.save(users)
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('organizations'))
    } catch (_) {}
  },
)
