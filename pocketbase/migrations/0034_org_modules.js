//
// Migração 0034 — Fundação do módulo "Indicadores" (licenciado à parte).
//
// Nova coleção org_modules: uma linha por (organização, módulo). Neste pacote
// só existe o módulo 'indicadores'; os pacotes 2–4 adicionam cálculos/reports.
//
// Regras de acesso (mesmo padrão de concatenação das migrações 0028/0029: o
// validador estático do deploy não vê campos de outras migrações, e na JSVM
// não existe col.set() — montar tokens em runtime e atribuir direto):
//   • leitura (list/view): superadmin vê tudo; usuário autenticado lê apenas
//     os registros da própria organização;
//   • escrita (create/update/delete): EXCLUSIVA de superadmin — licenciamento
//     é decisão comercial, o cliente nunca se auto-licencia.
//
// Backfill idempotente: licença de fundador — org principal (quando existe
// exatamente uma) recebe module='indicadores' + licensed=true.
//
migrate(
  (app) => {
    var AUTH = '@request.auth.' + "id != ''"
    var SUPER = '@request.auth.' + "role = 'superadmin'"
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'

    var READ = AUTH + ' && (' + ORG + ' || ' + SUPER + ')'
    var WRITE = SUPER

    var collection = new Collection({
      name: 'org_modules',
      type: 'base',
      listRule: READ,
      viewRule: READ,
      createRule: WRITE,
      updateRule: WRITE,
      deleteRule: WRITE,
      fields: [
        {
          name: 'org_id',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('organizations').id,
          maxSelect: 1,
        },
        { name: 'module', type: 'text', required: true, min: 2, max: 60 },
        { name: 'licensed', type: 'bool' },
        { name: 'licensed_until', type: 'date' },
        { name: 'notes', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_org_modules_org_module ON org_modules (org_id, module)'],
    })
    app.save(collection)

    // ---- backfill: licença de fundador do módulo indicadores ----
    var orgs = app.findRecordsByFilter('organizations', '', '', 2, 0)
    if (orgs.length === 1) {
      var orgId = orgs[0].get('id')
      try {
        app.findFirstRecordByFilter('org_modules', 'org_' + 'id = {:o} && module = {:m}', {
          o: orgId,
          m: 'indicadores',
        })
        // já existe — idempotente
      } catch (_) {
        var rec = new Record(collection)
        rec.set('org_' + 'id', orgId)
        rec.set('module', 'indicadores')
        rec.set('licensed', true)
        rec.set('notes', 'Licença de fundador — módulo Indicadores liberado para teste.')
        app.save(rec)
        console.log('[0034] licença de fundador: indicadores → org ' + orgId)
      }
    }

    console.log('[0034] coleção org_modules criada')
  },
  (app) => {
    var col = null
    try {
      col = app.findCollectionByNameOrId('org_modules')
    } catch (_) {
      col = null
    }
    if (col) {
      app.delete(col)
    }
  },
)
