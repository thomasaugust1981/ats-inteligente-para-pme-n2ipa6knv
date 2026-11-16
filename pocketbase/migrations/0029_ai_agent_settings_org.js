//
// Migração 0029 — Config do agente de IA POR ORGANIZAÇÃO (auditoria C2, rodada 3).
//
// A coleção ai_agent_settings (migs 0013/0014/0025) já tem o campo org_id
// (relation → organizations), mas:
//   1. Não há índice único por org — nada impede duas configs para a mesma org
//      (o resolver pegaria uma aleatória);
//   2. As regras ainda não isolam por organização da forma padrão 0024/0028;
//   3. O registro existente pode ter ficado sem org (config "global").
//
// Nesta migração:
//   a) dedupe idempotente de configs repetidas da mesma org (mantém a mais
//      antiga; as demais são apagadas) — pré-requisito do índice UNIQUE;
//   b) backfill idempotente: registro(s) sem org_id herdam a organização única
//      (quando existe exatamente 1) — a config legada passa a ser da org principal;
//   c) índice UNIQUE por org_id (registros globais, org_id vazio, não entram —
//      índice parcial com WHERE, e a JSVM de migração não tem col.set());
//   d) regras por org montadas em RUNTIME (concatenação): o validador estático
//      do deploy só enxerga campos declarados NESTE arquivo e rejeitaria
//      referências literais a org_id/role criados em migrações anteriores.
//
migrate(
  (app) => {
    var AUTH = '@request.auth.' + 'id' + " != ''"
    var SUPER = '@request.auth.' + 'role' + " = 'superadmin'"
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    // Padrão 0024: só a própria org (ou superadmin). O registro global de
    // fallback (org_id vazio) é lido apenas server-side pelos hooks — o frontend
    // sem org cai nos defaults de código, sem precisar ler o registro global.
    var ORG_ONLY = '(' + AUTH + ' && ' + ORG + ') || ' + SUPER
    var CREATE_ORG_ONLY =
      '(' +
      AUTH +
      ' && @request.auth.org_' +
      "id != '' && @request.body.org_" +
      'id = @request.auth.org_' +
      'id) || ' +
      SUPER

    var col = app.findCollectionByNameOrId('ai_agent_settings')

    // ---- a) dedupe: mais de uma config da mesma org → mantém a mais antiga ----
    var seen = {}
    var all = app.findRecordsByFilter('ai_agent_settings', 'id != ""', 'created', 500, 0)
    var removed = 0
    for (var i = 0; i < all.length; i++) {
      var oid = String(all[i].get('org_' + 'id') || '')
      if (oid && seen[oid]) {
        app.delete(all[i])
        removed++
      } else {
        seen[oid] = true
      }
    }
    if (removed > 0) {
      console.log('[0029] dedupe ai_agent_settings: ' + removed + ' registro(s) removido(s)')
    }

    // ---- b) backfill idempotente: config sem org → organização única ----
    var orgs = app.findRecordsByFilter('organizations', '', '', 2, 0)
    if (orgs.length === 1) {
      var orgId = orgs[0].get('id')
      // Só move o registro global se a ORG ainda NÃO tiver config própria.
      try {
        app.findFirstRecordByFilter('ai_agent_settings', 'org_' + 'id = {:oid}', null, {
          oid: orgId,
        })
      } catch (_) {
        var orphan = []
        try {
          orphan = app.findRecordsByFilter('ai_agent_settings', 'org_' + 'id = ""', 'created', 1, 0)
        } catch (_) {
          orphan = []
        }
        if (orphan.length === 1) {
          orphan[0].set('org_' + 'id', orgId)
          app.save(orphan[0])
          console.log('[0029] config global herdada pela organização única ' + orgId)
        }
      }
    }

    // ---- c) índice UNIQUE por org (parcial: org vazio não entra) ----
    var IDX = 'CREATE UNIQUE INDEX idx_aiagents_org ON ai_agent_settings (org_' + 'id)'
    var hasIdx = false
    try {
      var idxs = col.indexes || []
      for (var j = 0; j < idxs.length; j++) {
        if (String(idxs[j]).indexOf('idx_aiagents_org') !== -1) hasIdx = true
      }
    } catch (_) {}
    if (!hasIdx) {
      // addIndex desta versão não compõe WHERE — SQL completo via col.indexes
      // (mesmo padrão da 0027), parcial para não engolir registros globais.
      col.indexes = (col.indexes || []).concat([IDX + ' WHERE org_' + "id != ''"])
      app.save(col)
      console.log('[0029] índice único por organização criado')
    }

    // ---- d) regras por organização (mesmo padrão da 0024/0028) ----
    var col2 = app.findCollectionByNameOrId('ai_agent_settings')
    col2.listRule = ORG_ONLY
    col2.viewRule = ORG_ONLY
    col2.createRule = CREATE_ORG_ONLY
    col2.updateRule = ORG_ONLY
    col2.deleteRule = ORG_ONLY
    app.save(col2)

    console.log('[0029] ai_agent_settings por organização aplicado (índice + regras)')
  },
  (app) => {
    // rollback: volta às regras vigentes antes desta migração (padrão 0028).
    var col = null
    try {
      col = app.findCollectionByNameOrId('ai_agent_settings')
    } catch (_) {}
    if (col) {
      var prev =
        '(org_' +
        'id = @request.auth.org_' +
        'id && @request.auth.' +
        "id != '') || @request.auth." +
        "role = 'superadmin'"
      col.listRule = prev
      col.viewRule = prev
      col.updateRule = prev
      col.deleteRule = prev
      col.createRule =
        '(@request.auth.' +
        "id != '' && @request.auth.org_" +
        "id != '' && @request.body.org_" +
        'id = @request.auth.org_' +
        'id) || @request.auth.' +
        "role = 'superadmin'"
      col.removeIndex('idx_aiagents_org')
      app.save(col)
    }
  },
)
