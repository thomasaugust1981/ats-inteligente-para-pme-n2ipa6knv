//
// Migração 0021 — PAINEL DE INTEGRAÇÕES.
//
// Cria a coleção integration_settings (um registro por empresa/company_id,
// com org_id para o isolamento multi-org do padrão da 0018) e amplia o
// seletor de ações de audit_logs com os eventos das integrações.
//
// Regras do validador estático respeitadas:
//   • TODOS os campos citados nas regras (org_id, company_id, enabled,
//     integration) são declarados NESTE MESMO arquivo;
//   • col.set() não existe na JSVM — as regras são gravadas por atribuição
//     direta de propriedade (padrão da 0018);
//   • nenhum dado de planilha é semeado — a coleção nasce vazia.
//
migrate(
  (app) => {
    var organizations = app.findCollectionByNameOrId('organizations')
    var companies = app.findCollectionByNameOrId('companies')

    var settings = null
    try {
      settings = app.findCollectionByNameOrId('integration_settings')
    } catch (_) {
      settings = null
    }
    if (!settings) {
      settings = new Collection({
        name: 'integration_settings',
        type: 'base',
        // Regras nulas no primeiro save; as de isolamento entram no bloco de
        // regras abaixo (mesma ordem campo → regras da 0018).
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'integration', type: 'text', required: true },
          {
            name: 'org_id',
            type: 'relation',
            collectionId: organizations.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'company_id',
            type: 'relation',
            collectionId: companies.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'enabled', type: 'bool' },
          { name: 'config', type: 'json' },
          { name: 'last_sync_at', type: 'date' },
          { name: 'last_sync_summary', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_integration_settings_company ON integration_settings (integration, company_id)',
        ],
      })
      app.save(settings)
      console.log('[0021] coleção integration_settings criada')
    }

    // ---------- Regras de isolamento (padrão multi-org da 0018) ----------
    // Campos citados: org_id, company_id, enabled, integration — declarados acima.
    var ORG_MATCH = 'org_id = @request.auth.org_id'
    var ADMIN_ALL = "@request.auth.role = 'superadmin'"
    var rules = {
      listRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      viewRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      createRule: "@request.auth.id != '' && @request.auth.org_id != ''",
      updateRule: '(' + ORG_MATCH + " && @request.auth.id != '') || " + ADMIN_ALL,
      deleteRule:
        "(@request.auth.id != '' && " +
        ORG_MATCH +
        " && @request.auth.role = 'admin') || " +
        ADMIN_ALL,
    }
    var keys = Object.keys(rules)
    for (var k = 0; k < keys.length; k++) {
      settings[keys[k]] = rules[keys[k]]
    }
    app.save(settings)
    console.log('[0021] integration_settings: regras multi-org gravadas')

    // ---------- audit_logs: novas ações das integrações ----------
    var audit = app.findCollectionByNameOrId('audit_logs')
    var actionField = audit.fields.getByName('action')
    var wanted = ['integration_exported', 'interview_scheduled']
    var values = actionField.values || []
    var changed = false
    for (var i = 0; i < wanted.length; i++) {
      var exists = false
      for (var j = 0; j < values.length; j++) {
        if (values[j] === wanted[i]) {
          exists = true
          break
        }
      }
      if (!exists) {
        values.push(wanted[i])
        changed = true
      }
    }
    if (changed) {
      try {
        actionField.values = values
        app.save(audit)
      } catch (_) {
        // fallback do padrão da 0018: recria o campo select por completo
        audit = app.findCollectionByNameOrId('audit_logs')
        audit.fields.removeByName('action')
        audit.fields.add(
          new SelectField({ name: 'action', values: values, maxSelect: 1, required: true }),
        )
        app.save(audit)
      }
      console.log('[0021] audit_logs.action com ações de integração')
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('integration_settings'))
    } catch (_) {}
  },
)
