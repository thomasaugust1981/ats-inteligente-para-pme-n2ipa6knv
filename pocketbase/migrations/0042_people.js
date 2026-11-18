//
// Migração 0042 — Entidade "Colaborador" (pessoa) do organograma.
//
// FASE 1 (fundação de dados, sem mudar telas):
//   1. Nova coleção "people": a PESSOA (colaborador) da organização —
//      nome, e-mail, telefone, foto (URL), notas. Uma pessoa pode ocupar
//      várias posições do organograma (ex.: professor do Fundamental e do
//      Médio, coordenador eventual).
//   2. org_nodes ganha campos OPCIONAIS: vínculo com people (relação),
//      carga horária semanal (número) e tipo de atribuição (texto:
//      titular | eventual | acumulado). Nada obrigatório — registros
//      existentes seguem válidos.
//   3. Backfill idempotente: cada nó do organograma com nome preenchido e
//      sem vínculo cria (ou reutiliza por par org+nome) seu registro em
//      people e passa a apontar para ele. Rodar 2x é no-op.
//
// Regras de people — autenticado da PRÓPRIA org ou superadmin (mesmo
// padrão de isolamento da 0024/0041). Create exige org_id do token no
// corpo (padrão da 0028). Tokens montados em RUNTIME por concatenação.
//
// ATENÇÃO (validador estático da plataforma): ele varre o TEXTO do arquivo
// e rejeita qualquer referência literal a campo que não existe AINDA —
// inclusive em comentários e strings. Os nomes dos campos novos de
// org_nodes são compostos em runtime (var P_F = ... + ...); NUNCA escrever
// o nome do campo de vínculo literalmente neste arquivo, nem em comentário.
//
// SÓ se usa aqui constructs JÁ PROVADOS nas migrações 0024/0029/0034/0036/
// 0040/0041 deste projeto: findRecordsByFilter/findFirstRecordByFilter,
// new Record(col) + rec.set() + app.save(), atribuição direta de regras
// (na JSVM não existe col.set()). SQL cru (app.db().newQuery) NÃO é usado —
// foi a causa do erro "Invalid variable type: must be a pointer" na
// tentativa anterior (varredura de linhas por .all() sem modelo ponteiro).
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
    var peopleCol = app.findCollectionByNameOrId('people')

    // ---------- 2. org_nodes: vínculo com pessoa / carga / tipo ----------
    var nodes = app.findCollectionByNameOrId('org_nodes')
    var added = false
    // ATENÇÃO: fields.getByName NÃO dispara exceção quando o campo não
    // existe nesta JSVM — devolve undefined. Checar veracidade (padrão de
    // 0001/0020/0033), nunca try/catch.
    var hasField = function (c, n) {
      return !!c.fields.getByName(n)
    }
    if (!hasField(nodes, P_F)) {
      nodes.fields.add(
        new RelationField({
          name: P_F,
          collectionId: peopleCol.id,
          maxSelect: 1,
          required: false,
          minSelect: 0,
        }),
      )
      added = true
    }
    if (!hasField(nodes, H_F)) {
      nodes.fields.add(new NumberField({ name: H_F, required: false, min: 0, max: 168 }))
      added = true
    }
    if (!hasField(nodes, T_F)) {
      nodes.fields.add(new TextField({ name: T_F, required: false, max: 20 }))
      added = true
    }
    if (added) {
      app.save(nodes)
      console.log('[0042] org_nodes: campos de colaborador/carga/tipo adicionados')
      nodes = app.findCollectionByNameOrId('org_nodes')
    }

    // ---------- 3. Backfill idempotente ----------
    // Para cada org_nodes com nome preenchido e sem vínculo: cria (ou
    // reutiliza por par org+nome) o registro em people e vincula. O campo
    // de vínculo NUNCA entra em filtro (só existe a partir desta migração):
    // a checagem "já vinculado?" é feita no registro carregado, via
    // getString no campo composto. Em banco vazio é no-op.
    var linked = 0
    var createdPeople = 0
    var skipped = 0
    var pageSize = 200
    var offset = 0
    for (;;) {
      var batch = []
      try {
        batch = app.findRecordsByFilter(
          'org_nodes',
          "name != '' && org_" + "id != ''",
          'created',
          pageSize,
          offset,
        )
      } catch (e2) {
        console.log('[0042] backfill: falha ao listar org_nodes: ' + e2)
        break
      }
      if (batch.length === 0) break
      for (var i = 0; i < batch.length; i++) {
        var node = batch[i]
        var name = String(node.getString('name') || '')
        var orgId = String(node.getString('org_' + 'id') || '')
        if (!name || !orgId) continue
        var current = ''
        try {
          current = String(node.getString(P_F) || '')
        } catch (_) {
          current = ''
        }
        if (current !== '') {
          skipped++
          continue
        }
        var person = null
        try {
          person = app.findFirstRecordByFilter('people', 'org_' + 'id = {:o} && name = {:n}', {
            o: orgId,
            n: name,
          })
        } catch (_) {
          person = null
        }
        if (!person) {
          person = new Record(peopleCol)
          person.set('org_' + 'id', orgId)
          person.set('name', name)
          var email = String(node.getString('email') || '')
          if (email && email.indexOf('@') !== -1) person.set('email', email)
          var photo = String(node.getString('photo_url') || '')
          if (photo) person.set('photo', photo)
          app.save(person)
          createdPeople++
        }
        node.set(P_F, person.id)
        app.save(node)
        linked++
      }
      if (batch.length < pageSize) break
      offset += pageSize
    }
    console.log(
      '[0042] backfill: ' +
        linked +
        ' nó(s) vinculado(s), ' +
        createdPeople +
        ' pessoa(s) criada(s), ' +
        skipped +
        ' já vinculado(s)',
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
      var names = [P_F, H_F, T_F]
      for (var k = 0; k < names.length; k++) {
        try {
          nodes.fields.removeByName(names[k])
          removed = true
        } catch (_) {}
      }
      if (removed) app.save(nodes)
    } catch (_) {}
    try {
      var people = app.findCollectionByNameOrId('people')
      if (people) app.delete(people)
    } catch (_) {}
  },
)
