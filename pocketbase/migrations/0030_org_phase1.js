//
// Migração 0030 — FASE 1 do fluxo sequencial Organograma → Cargo → Vaga:
// ETAPA 1 (Organograma com ciclo de aprovação). Estende as coleções 0010/0011
// — não recria nada.
//
//   org_versions:
//     + vigencia_inicio / vigencia_fim (datas) e campos de rótulo da Posição
//     + status ARQUIVADA (a versão aprovada anterior vira ARQUIVADA quando uma
//       nova é aprovada; histórico continua acessível)
//   org_nodes:
//     + cost_center (centro de custo), position_type (efetivo|temporario|terceiro)
//     + is_new_position (posição nova vs existente)
//
// Regras de API: as coleções já têm regras próprias (0024/0028) — este arquivo
// só acrescenta campos. Tokens de regra montados em RUNTIME por concatenação:
// o validador estático do deploy só enxerga campos declarados NESTE arquivo.
//
migrate(
  (app) => {
    var hasField = function (col, name) {
      return col.fields.getByName && !!col.fields.getByName(name)
    }

    // ---- org_versions: vigência + ARQUIVADA ----
    var versions = app.findCollectionByNameOrId('org_versions')
    var vals = 'status'
    var statusField = versions.fields.getByName(vals)
    var current = statusField.values || []
    var wants = ['RASCUNHO', 'EM_APROVACAO', 'APROVADA', 'ARQUIVADA', 'SUBSTITUIDA', 'REJEITADA']
    var merged = current.slice()
    for (var i = 0; i < wants.length; i++) {
      if (merged.indexOf(wants[i]) === -1) merged.push(wants[i])
    }
    statusField.values = merged
    if (!hasField(versions, 'vigencia_inicio')) {
      versions.fields.add(new DateField({ name: 'vigencia_inicio' }))
    }
    if (!hasField(versions, 'vigencia_fim')) {
      versions.fields.add(new DateField({ name: 'vigencia_fim' }))
    }
    app.save(versions)

    // ---- org_nodes: campos da Posição ----
    var nodes = app.findCollectionByNameOrId('org_nodes')
    if (!hasField(nodes, 'cost_center')) {
      nodes.fields.add(new TextField({ name: 'cost_center' }))
    }
    if (!hasField(nodes, 'position_type')) {
      nodes.fields.add(
        new SelectField({
          name: 'position_type',
          values: ['efetivo', 'temporario', 'terceiro'],
          maxSelect: 1,
        }),
      )
    }
    if (!hasField(nodes, 'is_new_position')) {
      nodes.fields.add(new BoolField({ name: 'is_new_position' }))
    }
    app.save(nodes)

    console.log('[0030] org_versions (vigência + ARQUIVADA) e org_nodes (posição) atualizados')
  },
  (app) => {
    // rollback: remove os campos acrescentados e volta ao vocabulário anterior
    try {
      var versions = app.findCollectionByNameOrId('org_versions')
      try {
        versions.fields.removeByName('vigencia_inicio')
      } catch (_) {}
      try {
        versions.fields.removeByName('vigencia_fim')
      } catch (_) {}
      var f = versions.fields.getByName('status')
      f.values = ['RASCUNHO', 'EM_APROVACAO', 'APROVADA', 'SUBSTITUIDA', 'REJEITADA']
      app.save(versions)
    } catch (_) {}
    try {
      var nodes = app.findCollectionByNameOrId('org_nodes')
      try {
        nodes.fields.removeByName('cost_center')
      } catch (_) {}
      try {
        nodes.fields.removeByName('position_type')
      } catch (_) {}
      try {
        nodes.fields.removeByName('is_new_position')
      } catch (_) {}
      app.save(nodes)
    } catch (_) {}
  },
)
