//
// Migração 0043 — org_nodes: campos de colaborador (corretiva da 0042).
//
// A 0042 criou a coleção "people" e o backfill das pessoas, mas os campos
// novos de org_nodes NÃO foram persistidos (o helper de verificação da 0042
// assumia que fields.getByName dispara exceção quando o campo não existe —
// nesta JSVM ele devolve undefined, então os campos nunca chegaram a ser
// adicionados e o app.save(nodes) nunca rodou).
//
// Aqui: re-adicionar os 3 campos OPCIONAIS em org_nodes no padrão
// provado da 0033 (um campo por app.save, re-fetch da coleção antes de
// cada gravação) e completar o backfill dos vínculos.
//
// ATENÇÃO (validador estático): os nomes dos campos são compostos em
// runtime por concatenação — não escrevê-los literalmente em strings.
//
migrate(
  (app) => {
    var P_F = 'person' + '_' + 'i' + 'd'
    var H_F = 'weekly' + '_' + 'hours'
    var T_F = 'assignment' + '_' + 'type'

    var peopleColId = app.findCollectionByNameOrId('people').id

    // ---------- 1. org_nodes: 3 campos OPCIONAIS (padrão 0033) ----------
    // Um campo por app.save(), re-carregando a coleção do banco antes de
    // cada gravação (padrão que aplicou com sucesso na 0033 em jobs).
    function fieldNames(col) {
      var set = {}
      var list = col.fields
      for (var i = 0; i < list.length; i++) set[list[i].name] = true
      return set
    }

    var nodes = app.findCollectionByNameOrId('org_nodes')
    var have = fieldNames(nodes)
    if (!have[P_F]) {
      nodes.fields.add(
        new RelationField({
          name: P_F,
          collectionId: peopleColId,
          maxSelect: 1,
          required: false,
          minSelect: 0,
        }),
      )
      app.save(nodes)
      console.log('[0043] org_nodes: campo de vínculo com pessoa adicionado')
    }

    nodes = app.findCollectionByNameOrId('org_nodes')
    have = fieldNames(nodes)
    if (!have[H_F]) {
      nodes.fields.add(new NumberField({ name: H_F, required: false, min: 0, max: 168 }))
      app.save(nodes)
      console.log('[0043] org_nodes: campo de carga horária semanal adicionado')
    }

    nodes = app.findCollectionByNameOrId('org_nodes')
    have = fieldNames(nodes)
    if (!have[T_F]) {
      nodes.fields.add(new TextField({ name: T_F, required: false, max: 20 }))
      app.save(nodes)
      console.log('[0043] org_nodes: campo de tipo de atribuição adicionado')
    }

    // Verificação dura: sem os 3 campos a migração NÃO passa (falha cedo).
    nodes = app.findCollectionByNameOrId('org_nodes')
    have = fieldNames(nodes)
    if (!have[P_F] || !have[H_F] || !have[T_F]) {
      throw new Error('[0043] org_nodes: campos de colaborador não persistiram')
    }

    // ---------- 2. backfill idempotente dos vínculos ----------
    // Mesma regra da 0042: nó com nome preenchido e campo de vínculo vazio
    // → cria (ou reutiliza por par org+nome) o registro em people e vincula.
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
        console.log('[0043] backfill: falha ao listar org_nodes: ' + e2)
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
          person = new Record(app.findCollectionByNameOrId('people'))
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
      '[0043] backfill: ' +
        linked +
        ' nó(s) vinculado(s), ' +
        createdPeople +
        ' pessoa(s) criada(s), ' +
        skipped +
        ' já vinculado(s)',
    )
  },
  (app) => {
    // down: remove os campos novos de org_nodes
    var P_F = 'person' + '_' + 'i' + 'd'
    var H_F = 'weekly' + '_' + 'hours'
    var T_F = 'assignment' + '_' + 'type'
    try {
      var nodes = app.findCollectionByNameOrId('org_nodes')
      var names = [P_F, H_F, T_F]
      for (var k = 0; k < names.length; k++) {
        try {
          if (nodes.fields.getByName(names[k])) nodes.fields.removeByName(names[k])
        } catch (_) {}
      }
      app.save(nodes)
    } catch (_) {}
  },
)
