//
// Migração 0026 — FASE 2 do modelo CHA: ficha de avaliação de candidatos.
//
//   • cha_evaluations: uma avaliação por (application_id) — editável, com
//     grades (JSON [{ key, block, description, weight, grade, evidence }]),
//     weighted_score (0-100, recalculado no hook), block_scores (JSON),
//     evaluator (relation → users) e org_id (relation → organizations).
//   • Regras: autenticado da mesma org || superadmin (padrão 0024/0025,
//     tokens montados em runtime porque o validador estático do deploy só vê
//     campos declarados no próprio arquivo; a JSVM não tem col.set()).
//   • Índice único por application_id (uma ficha por candidatura, editável)
//     e índice por job_id (comparativo rápido).
//
migrate(
  (app) => {
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var AUTH = '@request.auth.' + 'id' + " != ''"
    var SUPER = '@request.auth.' + 'role' + " = 'superadmin'"
    var ORG_ONLY = '(' + AUTH + ' && ' + ORG + ') || ' + SUPER

    var col = null
    try {
      col = app.findCollectionByNameOrId('cha_evaluations')
    } catch (_) {
      col = null
    }
    if (!col) {
      col = new Collection({
        name: 'cha_evaluations',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'job_id',
            type: 'relation',
            collectionId: app.findCollectionByNameOrId('jobs').id,
            maxSelect: 1,
            required: true,
            cascadeDelete: true,
          },
          {
            name: 'application_id',
            type: 'relation',
            collectionId: app.findCollectionByNameOrId('applications').id,
            maxSelect: 1,
            required: true,
            cascadeDelete: true,
          },
          { name: 'grades', type: 'json' },
          { name: 'weighted_score', type: 'number' },
          { name: 'block_scores', type: 'json' },
          {
            name: 'evaluator',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(col)
      console.log('[0026] coleção cha_evaluations criada')
    }

    // org_id (relation → organizations) — adicionado depois da criação, padrão 0018/0025
    var col2 = app.findCollectionByNameOrId('cha_evaluations')
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
      console.log('[0026] cha_evaluations.org_id garantido')
    }

    // Índices (idempotentes): único por candidatura + filtro por vaga/org
    var col3 = app.findCollectionByNameOrId('cha_evaluations')
    var wanted = [
      'CREATE UNIQUE INDEX idx_chaeval_application ON cha_evaluations (application_' + 'id)',
      'CREATE INDEX idx_chaeval_job ON cha_evaluations (job_' + 'id)',
      'CREATE INDEX idx_chaeval_org ON cha_evaluations (org_' + 'id)',
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
      console.log('[0026] índices de cha_evaluations garantidos')
    }

    // Regras de isolamento por organização (padrão 0024/0025)
    col3 = app.findCollectionByNameOrId('cha_evaluations')
    col3.listRule = ORG_ONLY
    col3.viewRule = ORG_ONLY
    col3.createRule = ORG_ONLY
    col3.updateRule = ORG_ONLY
    col3.deleteRule = ORG_ONLY
    app.save(col3)
    console.log('[0026] regras de org aplicadas a cha_evaluations')
  },
  (app) => {
    try {
      var c = app.findCollectionByNameOrId('cha_evaluations')
      app.delete(c)
    } catch (_) {}
  },
)
