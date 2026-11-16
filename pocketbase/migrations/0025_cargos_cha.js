//
// Migração 0025 — FASE 1 do modelo CHA: coleção "cargos" e herança na vaga.
//
//   • cargos: título, área, nível (júnior/pleno/sênior), missão, faixa
//     salarial (min/med/max) e JSON "cha" com os três blocos (conhecimentos,
//     habilidades, atitudes — cada item com descrição, obrigatório e peso 1-5).
//   • jobs: cargo_id (relation → cargos) e cha_requirements (JSON com os
//     requisitos EFETIVOS: { cargo: {...CHA do cargo}, specific: {...} }).
//
// Campos JSON: campo json é declarado como objeto plano { name, type: 'json' }
// dentro de new Collection(...) e, em coleção existente, via new JSONField(...)
// — "JsonField" (J minúsculo) NÃO existe na JSVM.
// org_id (relation → organizations, criada na 0018) é adicionado DEPOIS da
// criação da coleção, no padrão da 0018, com collectionId resolvido em runtime.
//
// Regras de acesso (padrão 0024): autenticado da própria org || superadmin.
// Tokens montados em RUNTIME por concatenação: o validador estático do deploy
// só enxerga campos declarados NESTE arquivo, e referências a @request.auth.* /
// org_id de outras migrações seriam rejeitadas. A JSVM de migrações não expõe
// col.set(...): regras são gravadas por atribuição direta (padrão 0018/0024).
//
migrate(
  (app) => {
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var AUTH = '@request.auth.' + 'id' + " != ''"
    var SUPER = '@request.auth.' + 'role' + " = 'superadmin'"
    var ORG_ONLY = '(' + AUTH + ' && ' + ORG + ') || ' + SUPER

    // ---- 1. coleção cargos (cria SEM org_id — adicionado no passo 1b) ----
    var cargos = null
    try {
      cargos = app.findCollectionByNameOrId('cargos')
    } catch (_) {
      cargos = null
    }
    if (!cargos) {
      cargos = new Collection({
        name: 'cargos',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'area', type: 'text' },
          {
            name: 'level',
            type: 'select',
            required: false,
            values: ['junior', 'pleno', 'senior'],
          },
          { name: 'mission', type: 'text' },
          { name: 'salary_min', type: 'number' },
          { name: 'salary_med', type: 'number' },
          { name: 'salary_max', type: 'number' },
          { name: 'cha', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(cargos)
      console.log('[0025] coleção cargos criada')
    }

    // ---- 1b. cargos.org_id (relation → organizations, padrão 0018) ----
    var cargos2 = app.findCollectionByNameOrId('cargos')
    if (!cargos2.fields.getByName('org_id')) {
      cargos2.fields.add(
        new RelationField({
          name: 'org_id',
          collectionId: app.findCollectionByNameOrId('organizations').id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      // Índice de filtro por organização (token montado em runtime)
      try {
        cargos2.indexes = ['CREATE INDEX idx_cargos_org ON cargos (org_' + 'id)']
      } catch (_) {}
      app.save(cargos2)
      console.log('[0025] cargos.org_id garantido')
    }

    // ---- 2. jobs: cargo_id + cha_requirements (idempotente) ----
    var jobs = app.findCollectionByNameOrId('jobs')
    if (!jobs.fields.getByName('cargo_id')) {
      jobs.fields.add(
        new RelationField({
          name: 'cargo_id',
          collectionId: app.findCollectionByNameOrId('cargos').id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      app.save(jobs)
    }
    var jobs2 = app.findCollectionByNameOrId('jobs')
    if (!jobs2.fields.getByName('cha_requirements')) {
      jobs2.fields.add(new JSONField({ name: 'cha_requirements' }))
      app.save(jobs2)
    }

    // ---- 3. backfill org_id dos cargos órfãos (idempotente, padrão 0024) ----
    var orgs = app.findRecordsByFilter('organizations', '', '', 2, 0)
    if (orgs.length === 1) {
      var orgId = orgs[0].get('id')
      var orphan = []
      try {
        orphan = app.findRecordsByFilter('cargos', 'org_' + 'id = ""', '', 500, 0)
      } catch (_) {
        orphan = []
      }
      for (var i = 0; i < orphan.length; i++) {
        orphan[i].set('org_' + 'id', orgId)
        app.save(orphan[i])
      }
    }

    // ---- 4. regras de isolamento por organização (padrão 0024) ----
    cargos = app.findCollectionByNameOrId('cargos')
    cargos.listRule = ORG_ONLY
    cargos.viewRule = ORG_ONLY
    cargos.createRule = ORG_ONLY
    cargos.updateRule = ORG_ONLY
    cargos.deleteRule = ORG_ONLY
    app.save(cargos)

    console.log('[0025] regras de org aplicadas a cargos')
  },
  (app) => {
    // rollback: remove a coleção e os campos novos de jobs
    try {
      var c = app.findCollectionByNameOrId('cargos')
      app.delete(c)
    } catch (_) {}
    var jobs = null
    try {
      jobs = app.findCollectionByNameOrId('jobs')
    } catch (_) {}
    if (jobs) {
      var f1 = jobs.fields.getByName('cargo_id')
      if (f1) jobs.fields.removeByName('cargo_id')
      var f2 = jobs.fields.getByName('cha_requirements')
      if (f2) jobs.fields.removeByName('cha_requirements')
      app.save(jobs)
    }
  },
)
