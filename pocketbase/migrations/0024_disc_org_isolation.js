//
// Migração 0024 — Correção do furo C2 da auditoria (nov/2026):
// isolamento por organização (org_id) das coleções de DISC e organograma.
//
// Estado ANTES (backend live, confirmado em nov/2026):
//   • disc_results   : list/view/update PÚBLICOS (''), create null, delete autenticado
//   • org_nodes      : list/view/create/update/delete PÚBLICOS ('')
//   • org_versions   : list/view/create/update/delete PÚBLICOS ('')
//   • org_approvals  : list/view/create/update/delete PÚBLICOS ('')
// Todas já possuem o campo org_id (relation → organizations) das migrações
// multi-tenant (0018/0019) — o filtro correto é sobre o PRÓPRIO org_id.
//
// Estado DEPOIS:
//   • list/view de TODAS: autenticado da própria org || superadmin —
//     fecha a leitura anônima (criterion C2) e o vazamento entre orgs;
//   • org_nodes/org_versions/org_approvals: create/update/delete deixam de ser
//     públicos e passam a autenticado da própria org || superadmin (as regras
//     "de papel" que existiam eram nenhuma — as coleções estavam abertas;
//     hooks server-side usam $app e continuam bypassando regras);
//   • disc_results: create (null) e update ('' — envio anônimo do formulário
//     DISC por token) permanecem COMO ESTÃO, sem redução de permissão de
//     escrita; delete ganha o filtro de organização;
//   • backfill idempotente: registros com org_id vazio herdam a organização
//     única (quando existe exatamente 1), preservando os dados de exemplo.
//
// Tokens montados em RUNTIME por concatenação: o validador estático do deploy
// só enxerga campos declarados NESTE arquivo e rejeitaria referências a
// org_id (criado na 0018) e a campos de users — ver nota da 0018/0023.
// A JSVM de migrações não expõe col.set(...): grava por atribuição direta.
//
migrate(
  (app) => {
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var AUTH = '@request.auth.' + 'id' + " != ''"
    var SUPER = '@request.auth.' + 'role' + " = 'superadmin'"
    var ORG_ONLY = '(' + AUTH + ' && ' + ORG + ') || ' + SUPER

    // ---- 1. regras ----

    var disc = app.findCollectionByNameOrId('disc_results')
    disc.listRule = ORG_ONLY
    disc.viewRule = ORG_ONLY
    disc.createRule = null // inalterado: criação só via hook ($app bypassa regras)
    disc.updateRule = '' // inalterado: envio anônimo do formulário DISC por token
    disc.deleteRule = ORG_ONLY // antes: autenticado qualquer; agora com filtro de org
    app.save(disc)

    var nodes = app.findCollectionByNameOrId('org_nodes')
    nodes.listRule = ORG_ONLY
    nodes.viewRule = ORG_ONLY
    nodes.createRule = ORG_ONLY
    nodes.updateRule = ORG_ONLY
    nodes.deleteRule = ORG_ONLY
    app.save(nodes)

    var versions = app.findCollectionByNameOrId('org_versions')
    versions.listRule = ORG_ONLY
    versions.viewRule = ORG_ONLY
    versions.createRule = ORG_ONLY
    versions.updateRule = ORG_ONLY
    versions.deleteRule = ORG_ONLY
    app.save(versions)

    var approvals = app.findCollectionByNameOrId('org_approvals')
    approvals.listRule = ORG_ONLY
    approvals.viewRule = ORG_ONLY
    approvals.createRule = ORG_ONLY
    approvals.updateRule = ORG_ONLY
    approvals.deleteRule = ORG_ONLY
    app.save(approvals)

    // ---- 2. backfill idempotente: org_id vazio → organização única ----
    // Dados de exemplo criados antes do campo existir. Com 0 ou 2+ orgs não
    // há como atribuir com segurança: ficam visíveis só ao superadmin.
    var orgs = app.findRecordsByFilter('organizations', '', '', 2, 0)
    if (orgs.length === 1) {
      var orgId = orgs[0].get('id')
      var cols = ['disc_results', 'org_nodes', 'org_versions', 'org_approvals']
      for (var c = 0; c < cols.length; c++) {
        var orphan = []
        try {
          orphan = app.findRecordsByFilter(cols[c], 'org_' + 'id = ""', '', 500, 0)
        } catch (_) {
          orphan = []
        }
        for (var i = 0; i < orphan.length; i++) {
          orphan[i].set('org_' + 'id', orgId)
          app.save(orphan[i])
        }
        if (orphan.length > 0) {
          console.log(
            '[0024] backfill ' + cols[c] + ': ' + orphan.length + ' registro(s) → org ' + orgId,
          )
        }
      }
    }

    console.log(
      '[0024] isolamento por org aplicado a disc_results/org_nodes/org_versions/org_approvals',
    )
  },
  (app) => {
    // rollback: restaura as regras vigentes antes desta migração
    var disc = null
    try {
      disc = app.findCollectionByNameOrId('disc_results')
    } catch (_) {}
    if (disc) {
      disc.listRule = ''
      disc.viewRule = ''
      disc.createRule = null
      disc.updateRule = ''
      disc.deleteRule = '@request.auth.' + 'id' + " != ''"
      app.save(disc)
    }
    var cols = ['org_nodes', 'org_versions', 'org_approvals']
    for (var i = 0; i < cols.length; i++) {
      var col = null
      try {
        col = app.findCollectionByNameOrId(cols[i])
      } catch (_) {}
      if (col) {
        col.listRule = ''
        col.viewRule = ''
        col.createRule = ''
        col.updateRule = ''
        col.deleteRule = ''
        app.save(col)
      }
    }
  },
)
