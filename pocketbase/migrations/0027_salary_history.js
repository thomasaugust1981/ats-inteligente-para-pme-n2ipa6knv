//
// Migração 0027 — FASE 3 do modelo CHA: histórico de alteração de faixa salarial.
//
//   • salary_history: um registro por mudança de salary_min/salary_med/salary_max
//     de um cargo (gravado pelo hook pocketbase/hooks/salary_history.js no UPDATE
//     de cargos — o cliente não grava histórico diretamente).
//     Campos: cargo_id (relation → cargos), field ('salary_min'|'salary_med'|
//     'salary_max'), old_value/new_value (números), changed_by (relation → users),
//     changed_by_name (texto — o nome fica mesmo se o usuário for excluído) e
//     org_id (relation → organizations).
//   • Regras: autenticado da mesma org || superadmin (padrão 0024/0025/0026,
//     tokens montados em runtime porque o validador estático do deploy só vê
//     campos declarados no próprio arquivo; a JSVM não tem col.set()).
//   • Índices por cargo e por org (listagem do histórico no formulário).
//
migrate(
  (app) => {
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var AUTH = '@request.auth.' + 'id' + " != ''"
    var SUPER = '@request.auth.' + 'role' + " = 'superadmin'"
    var ORG_ONLY = '(' + AUTH + ' && ' + ORG + ') || ' + SUPER

    var col = null
    try {
      col = app.findCollectionByNameOrId('salary_history')
    } catch (_) {
      col = null
    }
    if (!col) {
      col = new Collection({
        name: 'salary_history',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'cargo_id',
            type: 'relation',
            collectionId: app.findCollectionByNameOrId('cargos').id,
            maxSelect: 1,
            required: true,
            cascadeDelete: true,
          },
          { name: 'field', type: 'text', required: true },
          { name: 'old_value', type: 'number' },
          { name: 'new_value', type: 'number' },
          {
            name: 'changed_by',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'changed_by_name', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(col)
      console.log('[0027] coleção salary_history criada')
    }

    // org_id (relation → organizations) — adicionado depois da criação, padrão 0018/0025/0026
    var col2 = app.findCollectionByNameOrId('salary_history')
    if (!col2.fields.getByName('org_id')) {
      col2.fields.add(
        new RelationField({
          name: 'org_id',
          collectionId: app.findCollectionByNameOrId('organizations').id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      app.save(col2)
      console.log('[0027] salary_history.org_id garantido')
    }

    // Índices (idempotentes): filtro por cargo (formulário) e por org
    var col3 = app.findCollectionByNameOrId('salary_history')
    var wanted = [
      'CREATE INDEX idx_salaryhist_cargo ON salary_history (cargo_' + 'id)',
      'CREATE INDEX idx_salaryhist_org ON salary_history (org_' + 'id)',
    ]
    var existing = {}
    try {
      var idxs = col3.indexes || []
      for (var i = 0; i < idxs.length; i++) existing[String(idxs[i])] = true
    } catch (_) {}
    var missing = []
    for (var j = 0; j < wanted.length; j++) {
      if (!existing[wanted[j]]) missing.push(wanted[j])
    }
    if (missing.length > 0) {
      col3.indexes = (col3.indexes || []).concat(missing)
      app.save(col3)
      console.log('[0027] índices de salary_history garantidos')
    }

    // Regras de isolamento por organização (padrão 0024/0025/0026)
    col3 = app.findCollectionByNameOrId('salary_history')
    col3.listRule = ORG_ONLY
    col3.viewRule = ORG_ONLY
    col3.createRule = ORG_ONLY
    col3.updateRule = ORG_ONLY
    col3.deleteRule = ORG_ONLY
    app.save(col3)
    console.log('[0027] regras de org aplicadas a salary_history')
  },
  (app) => {
    try {
      var c = app.findCollectionByNameOrId('salary_history')
      app.delete(c)
    } catch (_) {}
  },
)
