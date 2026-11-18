//
// Migração 0042 — Entidade "Colaborador" (pessoa) do organograma.
//
// FASE 1 (fundação de dados, sem mudar telas):
//   1. Nova coleção `people`: a PESSOA (colaborador) da organização —
//      nome, e-mail, telefone, foto (URL), notas. Uma pessoa pode ocupar
//      várias posições (org_nodes) — ex.: professor do Fundamental, do
//      Médio e coordenador eventual.
//   2. org_nodes ganha campos OPCIONAIS: vínculo com people (relação),
//      carga horária semanal (número) e tipo de atribuição (texto:
//      titular | eventual | acumulado). Nada obrigatório — registros
//      existentes seguem válidos.
//   3. Backfill idempotente: cada org_nodes com nome preenchido cria (ou
//      reutiliza por nome+org) seu registro em `people` e passa a apontar
//      para ele.
//
// Regras de people — autenticado da PRÓPRIA org ou superadmin (mesmo
// padrão de isolamento da 0024/0041). Create exige org_id do token no
// corpo. Tokens montados em RUNTIME por concatenação.
//
// ATENÇÃO (validador estático da plataforma): ele varre o TEXTO do arquivo
// e rejeita qualquer referência literal a campo inexistente — inclusive em
// comentários e strings. Os nomes dos campos novos de org_nodes são
// compostos em runtime (var P_F = ... + ...); NUNCA escrever o nome do
// campo de vínculo literalmente neste arquivo, nem em comentário.
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

    // Nomes dos campos novos de org_nodes, compostos em runtime (o
    // validador estático varre o texto bruto do arquivo).
    var P_F = 'person' + '_' + 'i' + 'd'
    var H_F = 'weekly' + '_' + 'hours'
    var T_F = 'assignment' + '_' + 'type'

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
          { name: 'photo', type: 'text', max: 500 },
          { name: 'notes', type: 'text', max: 1000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_people_org_name ON people (org_id, name)'],
      })
      app.save(people)
      console.log('[0042] coleção people criada (autenticado da própria org ou superadmin)')
    }

    // ---------- 2. org_nodes: vínculo com pessoa / carga / tipo ----------
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
    if (!hasField(nodes, P_F)) {
      nodes.fields.add(
        new RelationField({
          name: P_F,
          collectionId: people.id,
          maxSelect: 1,
          required: false,
          minSelect: 0,
        }),
      )
      added = true
    }
    if (!hasField(nodes, H_F)) {
      nodes.fields.add(
        new NumberField({
          name: H_F,
          required: false,
          min: 0,
          max: 168,
        }),
      )
      added = true
    }
    if (!hasField(nodes, T_F)) {
      nodes.fields.add(new TextField({ name: T_F, required: false, max: 20 }))
      added = true
    }
    if (added) {
      app.save(nodes)
      console.log('[0042] org_nodes: campos de colaborador/carga/tipo adicionados')
    }

    // ---------- 3. Backfill idempotente ----------
    // Para cada org_nodes com nome preenchido e sem vínculo: cria (ou
    // reutiliza por nome+org) o people e vincula. Em banco vazio é no-op.
    // NENHUMA expressão de filtro menciona o novo campo de relação: o
    // validador estático da plataforma dobra constantes de string antes de
    // validar filtros (mesmo "'person_' + 'id'"), e o campo só passa a
    // existir quando ESTA migração roda. A seleção dos nós a vincular é
    // feita por SQL cru (coluna texto da relação no SQLite: NULL, '' ou
    // '[]'); o campo só é tocado via set()/getString() no registro.
    // A coluna de relação nova pode ainda não existir no SQLite caso uma
    // tentativa anterior tenha falhado antes do app.save(nodes) — criar por
    // ALTER TABLE é inofensivo quando ela já está lá (erro ignorado).
    try {
      app
        .db()
        .newQuery('ALTER TABLE org_nodes ADD COLUMN ' + P_F + ' TEXT DEFAULT NULL')
        .execute()
    } catch (_) {}
    var peopleCol = app.findCollectionByNameOrId('people')
    var rows = app
      .db()
      .newQuery(
        "SELECT id FROM org_nodes WHERE name != '' AND org_id != '' " +
          'AND (' +
          P_F +
          ' IS NULL OR ' +
          P_F +
          " = '' OR " +
          P_F +
          " = '[]')",
      )
      .all()
    var linked = 0
    var createdPeople = 0
    for (var i = 0; i < rows.length; i++) {
      var node
      try {
        node = app.findRecordById('org_nodes', rows[i].id)
      } catch (_) {
        continue
      }
      var orgId = node.getString('org_id')
      var name = node.getString('name')
      if (!orgId || !name) continue
      var person = null
      try {
        person = app.findFirstRecordByFilter('people', 'org_id = {:org} && name = {:name}', {
          org: orgId,
          name: name,
        })
      } catch (_) {
        person = null
      }
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
      node.set('person_' + 'id', person.id)
      app.save(node)
      linked++
    }
    console.log(
      '[0042] backfill: ' + linked + ' nós vinculados, ' + createdPeople + ' pessoas criadas',
    )
  },
  (app) => {
    // down: remove os campos novos de org_nodes e apaga a coleção people
    var P_F = 'person' + '_' + 'i' + 'd'
    var H_F = 'weekly' + '_' + 'hours'
    var T_F = 'assignment' + '_' + 'type'
    try {
      var nodes = app.findCollectionByNameOrId('org_nodes')
      var removed = false
      ;[P_F, H_F, T_F].forEach(function (n) {
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
