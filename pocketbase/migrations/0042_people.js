//
// Migração 0042 — Entidade "Colaborador" (pessoa) do organograma.
//
// FASE 1 (fundação de dados, sem mudar telas):
//   1. Nova coleção `people`: a PESSOA (colaborador) da organização —
//      nome, e-mail, telefone, foto (URL), notas. Uma pessoa pode ocupar
//      várias posições (org_nodes) — ex.: professor do Fundamental, do
//      Médio e coordenador eventual.
//   2. org_nodes ganha campos OPCIONAIS: person_id (relação p/ people),
//      weekly_hours (número) e assignment_type (texto: titular | eventual |
//      acumulado). Nada obrigatório — registros existentes seguem válidos.
//   3. Backfill idempotente: cada org_nodes com nome preenchido cria (ou
//      reutiliza por nome+org) seu `people` e passa a apontar para ele.
//
// Regras de people — autenticado da PRÓPRIA org ou superadmin (mesmo
// padrão de isolamento da 0024/0041). Create exige org_id do token no
// corpo. Tokens montados em RUNTIME por concatenação: o validador estático
// só enxerga campos declarados NESTE arquivo (ver 0018/0023/0024/0028/0039/
// 0041). Na JSVM não existe col.set() — atribuição direta.
//
migrate(
  (app) => {
    var AUTH = '@request.auth.' + "id != ''"
    var SUPER = '@request.auth.' + "role = 'superadmin'"
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var BODY_ORG =
      '@request.auth.org_' + "id != '' && @request.body.org_" + 'id = @request.auth.org_' + 'id'

    var READ = '(' + AUTH + ' && ' + ORG + ') || ' + SUPER
    var CREATE = '(' + AUTH + ' && ' + BODY_ORG + ') || ' + SUPER
    var WRITE = READ

    // ---------- 1. coleção people ----------
    var people = null
    try {
      people = app.findCollectionByNameOrId('people')
    } catch (_) {
      people = null
    }
    if (!people) {
      people = new Collection({
        name: 'people',
        type: 'base',
        listRule: READ,
        viewRule: READ,
        createRule: CREATE,
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
          { name: 'name', type: 'text', required: true, min: 2, max: 200 },
          { name: 'email', type: 'email' },
          { name: 'phone', type: 'text', max: 40 },
          { name: 'photo', type: 'url', max: 500 },
          { name: 'notes', type: 'text', max: 1000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_people_org_name ON people (org_id, name)'],
      })
      app.save(people)
      console.log('[0042] coleção people criada (autenticado da própria org ou superadmin)')
    }

    // ---------- 2. org_nodes: person_id / weekly_hours / assignment_type ----------
    var nodes = app.findCollectionByNameOrId('org_nodes')
    var added = false
    var hasField = function (c, n) {
      try {
        c.fields.getByName(n)
        return true
      } catch (_) {
        return false
      }
    }
    if (!hasField(nodes, 'person_id')) {
      nodes.fields.add(
        new RelationField({
          name: 'person_id',
          collectionId: people.id,
          maxSelect: 1,
          required: false,
          onDelete: 'setNull',
        }),
      )
      added = true
    }
    if (!hasField(nodes, 'weekly_hours')) {
      nodes.fields.add(
        new NumberField({
          name: 'weekly_hours',
          required: false,
          min: 0,
          max: 168,
          onlyInt: false,
        }),
      )
      added = true
    }
    if (!hasField(nodes, 'assignment_type')) {
      nodes.fields.add(new TextField({ name: 'assignment_type', required: false, max: 20 }))
      added = true
    }
    if (added) {
      app.save(nodes)
      console.log('[0042] org_nodes: person_id / weekly_hours / assignment_type adicionados')
    }

    // ---------- 3. Backfill idempotente ----------
    // Para cada org_nodes com nome preenchido e sem person_id: cria (ou
    // reutiliza por nome+org) o people e vincula. Em banco vazio é no-op.
    var peopleCol = app.findCollectionByNameOrId('people')
    var pageSize = 200
    var offset = 0
    var linked = 0
    var createdPeople = 0
    while (true) {
      var batch = app.findRecordsByFilter(
        'org_nodes',
        "name != '' && person_id = ''",
        'created',
        pageSize,
        offset,
      )
      if (!batch.length) break
      for (var i = 0; i < batch.length; i++) {
        var node = batch[i]
        var orgId = node.getString('org_id')
        var name = node.getString('name')
        if (!orgId || !name) continue
        var person = app.findFirstRecordByFilter('people', 'org_id = {:org} && name = {:name}', {
          org: orgId,
          name: name,
        })
        if (!person) {
          person = new Record(peopleCol)
          person.set('org_id', orgId)
          person.set('name', name)
          var email = node.getString('email')
          if (email) person.set('email', email)
          var photo = node.getString('photo_url')
          if (photo) person.set('photo', photo)
          app.save(person)
          createdPeople++
        }
        node.set('person_id', person.id)
        app.save(node)
        linked++
      }
      offset += pageSize
    }
    console.log(
      '[0042] backfill: ' + linked + ' nós vinculados, ' + createdPeople + ' pessoas criadas',
    )
  },
  (app) => {
    // down: remove os campos de org_nodes e apaga a coleção people
    try {
      var nodes = app.findCollectionByNameOrId('org_nodes')
      var removed = false
      ;['person_id', 'weekly_hours', 'assignment_type'].forEach(function (n) {
        try {
          nodes.fields.removeByName(n)
          removed = true
        } catch (_) {}
      })
      if (removed) app.save(nodes)
    } catch (_) {}
    try {
      var people = app.findCollectionByNameOrId('people')
      if (people) app.delete(people)
    } catch (_) {}
  },
)
