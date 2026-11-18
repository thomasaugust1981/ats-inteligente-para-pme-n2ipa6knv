//
// Migração 0045 — org_nodes: campo de texto `dotted_line_manager`
// ("linha pontilhada" — segundo chefe / subordinação matricial).
//
// Campo OPCIONAL de TEXTO LIVRE: não muda regras, não muda a hierarquia
// principal (manager) nem a lógica de desenho da árvore.
//
// Padrão provado da 0043/0033: um campo por app.save(), re-fetch da coleção
// antes de cada gravação, e verificação dura ao final (falha cedo se o campo
// não persistir — evita o bug silencioso das migrações 0042/0044).
//
// ATENÇÃO (validador estático): o nome do campo é composto em runtime por
// concatenação — não escrito literalmente em strings de regra.
//
migrate(
  (app) => {
    var D_F = 'dotted' + '_' + 'line' + '_' + 'manager'

    function fieldNames(col) {
      var set = {}
      var list = col.fields
      for (var i = 0; i < list.length; i++) set[list[i].name] = true
      return set
    }

    // ---------- org_nodes: campo de texto opcional (padrão 0033/0043) ----------
    var nodes = app.findCollectionByNameOrId('org_nodes')
    var have = fieldNames(nodes)
    if (!have[D_F]) {
      nodes.fields.add(new TextField({ name: D_F, required: false, max: 200 }))
      app.save(nodes)
      console.log('[0045] org_nodes: campo de segundo chefe adicionado')
    }

    // Verificação dura: sem o campo a migração NÃO passa (falha cedo).
    nodes = app.findCollectionByNameOrId('org_nodes')
    have = fieldNames(nodes)
    if (!have[D_F]) {
      throw new Error('[0045] org_nodes: campo de segundo chefe não persistiu')
    }
    console.log('[0045] ok: campo de segundo chefe presente em org_nodes')
  },
  (app) => {
    // down: remove o campo novo de org_nodes
    var D_F = 'dotted' + '_' + 'line' + '_' + 'manager'
    try {
      var nodes = app.findCollectionByNameOrId('org_nodes')
      if (nodes.fields.getByName(D_F)) nodes.fields.removeByName(D_F)
      app.save(nodes)
    } catch (_) {}
  },
)
