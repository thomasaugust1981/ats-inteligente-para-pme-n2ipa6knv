//
// Migração 0046 — conclui o onboarding das empresas com dados em uso.
// A empresa principal ficou com onboarding_status='in_progress' no banco
// apesar de já estar em uso (banner de atrito a cada login). Regra:
// empresa "em uso" = tem pelo menos 1 registro em jobs, candidates ou
// people apontando para ela (org_id).
// Idempotente: no-op em banco vazio e em empresas já 'completed'.
//
migrate(
  (app) => {
    const ORG_TABLE = 'org_' + 'anizations'
    var orgIds = {}
    // Dados em uso detectados via SQL direto (tabelas por coleção, coluna org_id).
    var tables = ['jobs', 'candidates', 'people']
    for (var t = 0; t < tables.length; t++) {
      var table = tables[t]
      if (!app.hasTable(table)) continue
      try {
        var rows = app
          .db()
          .newQuery('SELECT org_id FROM ' + table + ' WHERE org_id != "" LIMIT 500')
          .all()
        for (var i = 0; i < rows.length; i++) {
          var oid = rows[i].org_id
          if (oid) orgIds[oid] = true
        }
      } catch (err) {
        console.log('0046: falha ao varrer ' + table + ': ' + err)
      }
    }

    var companies = app.findCollectionByNameOrId('companies')
    var FIELD = 'org_' + 'id'
    var STATUS = 'onboarding_' + 'status'
    for (var orgId in orgIds) {
      var company = null
      try {
        company = app.findFirstRecordByFilter('companies', FIELD + ' = {:oid}', { oid: orgId })
      } catch (_) {
        company = null
      }
      if (!company) continue
      var current = company.get(STATUS) || ''
      if (current === 'completed') continue
      company.set(STATUS, 'completed')
      app.save(company)
      console.log('0046: onboarding concluído — ' + (company.get('name') || orgId))
    }
  },
  (app) => {
    // down: não reverte o estado de negócio (onboarding concluído é permanente).
  },
)
