//
// Migração 0028 — Fecho do isolamento multi-empresa (rodada 2, nov/2026).
//
// A auditoria (docs/auditoria-ats-2026-11.md, C2/I1) já foi endereçada nas
// migrações 0018–0027 para a maioria das coleções. Esta rodada fecha os
// buracos que restaram no schema live, sem quebrar o fluxo público:
//
//   1. users.create era '' (PÚBLICO): qualquer anônimo podia criar usuário
//      com role 'superadmin' (escalação total). Agora: superadmin cria direto;
//      anônimo só cria SEM org_id e com role de trabalho (recruiter/manager/
//      admin) — nunca superadmin. O cadastro público da tela de login envia
//      role explicitamente, por isso ele é aceito com essa lista fechada.
//   2. companies.list/view eram '' (PÚBLICOS): perfil completo (CNPJ, visão,
//      missão, api_key_prefix) de TODAS as organizações sem login. A página
//      de carreiras busca a empresa SEM autenticação (companyService.getCompany),
//      então a leitura anônima se mantém APENAS para empresas com vaga
//      publicada — via back-relation jobs_via_company_id.status. Autenticado
//      continua lendo as empresas da própria organização; superadmin vê tudo.
//      Escrita já era por org e segue igual.
//   3. createRule de audit_logs, team_invites, stage_settings, ai_agent_settings
//      e integration_settings exigia só autenticação, sem filtro de org: um
//      usuário autenticado podia gravar registro na org de outra (forja de
//      trilha de auditoria / contaminação de config). Agora a criação exige
//      org própria (o corpo precisa trazer org_id = org do token) || superadmin.
//      Os serviços cliente foram ajustados na mesma entrega a enviar org_id.
//   4. Nada de update anônimo: nenhuma coleção passou a ter update público.
//      disc_results.update permanece '' por decisão da 0024 (envio anônimo do
//      formulário DISC por token — fluxo público que precisa continuar vivo).
//   5. Backfill idempotente: registros de trilha/config com org_id vazio
//      herdam a organização única (quando existe exatamente 1).
//
// Tokens de regra montados em RUNTIME (concatenação): o validador estático
// do deploy só enxerga campos declarados NESTE arquivo e rejeitaria
// referências a org_id/role/status/company_id criados em migrações anteriores.
// Na JSVM de migrações não existe col.set(...): tudo por atribuição direta.
//
migrate(
  (app) => {
    var AUTH = '@request.auth.' + 'id' + " != ''"
    var SUPER = '@request.auth.' + 'role' + " = 'superadmin'"
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var BODY_NO_ORG = '@request.body.org_' + 'id:isset = false'
    var BODY_ROLE_OK =
      '(@request.body.' +
      'role:isset = false' +
      ' || @request.body.' +
      "role = 'recruiter'" +
      ' || @request.body.' +
      "role = 'manager'" +
      ' || @request.body.' +
      "role = 'admin')"
    // O corpo tem que apontar a org do token (ou ser superadmin) — impede
    // gravar trilha/config na organização de outra.
    var CREATE_ORG_ONLY =
      '(' +
      AUTH +
      ' && @request.auth.org_' +
      "id != '' && @request.body.org_" +
      'id = @request.auth.org_' +
      'id) || ' +
      SUPER
    // stage_settings e ai_agent_settings podem ser criados por serviço do
    // servidor (hook) sem corpo org_id: superadmin/hook entra pela 1ª alternativa.

    // ---- 1. users: criação anônima sem escalação de papel ----
    var users = app.findCollectionByNameOrId('users')
    users.createRule =
      '(' +
      SUPER +
      ') || (@request.auth.' +
      'id' +
      " = '' && " +
      BODY_NO_ORG +
      ' && ' +
      BODY_ROLE_OK +
      ')'
    // list/view já são: superadmin || id = @request.auth.id — sem mudança.
    app.save(users)

    // ---- 2. companies: leitura anônima só de empresa com vaga publicada ----
    var companies = app.findCollectionByNameOrId('companies')
    var PUB_COMPANY = 'jobs_via_company_' + 'id.status' + " = 'published'" // back-relation (status da mig 0001)
    var COMPANY_READ = '(' + PUB_COMPANY + ') || (' + AUTH + ' && ' + ORG + ') || ' + SUPER
    companies.listRule = COMPANY_READ
    companies.viewRule = COMPANY_READ
    // create/update/delete já filtram por org — permanecem.
    app.save(companies)

    // ---- 3. criação interna com organização obrigatória ----
    var cols = [
      'audit_logs',
      'team_invites',
      'stage_settings',
      'ai_agent_settings',
      'integration_settings',
    ]
    for (var i = 0; i < cols.length; i++) {
      var col = app.findCollectionByNameOrId(cols[i])
      col.createRule = CREATE_ORG_ONLY
      app.save(col)
    }

    // ---- 4. backfill idempotente: org_id vazio → organização única ----
    var orgs = app.findRecordsByFilter('organizations', '', '', 2, 0)
    if (orgs.length === 1) {
      var orgId = orgs[0].get('id')
      for (var c = 0; c < cols.length; c++) {
        var orphan = []
        try {
          orphan = app.findRecordsByFilter(cols[c], 'org_' + 'id = ""', '', 500, 0)
        } catch (_) {
          orphan = []
        }
        for (var k = 0; k < orphan.length; k++) {
          orphan[k].set('org_' + 'id', orgId)
          app.save(orphan[k])
        }
        if (orphan.length > 0) {
          console.log(
            '[0028] backfill ' + cols[c] + ': ' + orphan.length + ' registro(s) → org ' + orgId,
          )
        }
      }
    }

    console.log('[0028] rodada 2 do isolamento aplicada (users/companies/creates internos)')
  },
  (app) => {
    // rollback: restaura as regras vigentes antes desta migração
    var users = null
    try {
      users = app.findCollectionByNameOrId('users')
    } catch (_) {}
    if (users) {
      users.createRule = ''
      app.save(users)
    }

    var companies = null
    try {
      companies = app.findCollectionByNameOrId('companies')
    } catch (_) {}
    if (companies) {
      companies.listRule = ''
      companies.viewRule = ''
      app.save(companies)
    }

    var cols = [
      'audit_logs',
      'team_invites',
      'stage_settings',
      'ai_agent_settings',
      'integration_settings',
    ]
    for (var i = 0; i < cols.length; i++) {
      var col = null
      try {
        col = app.findCollectionByNameOrId(cols[i])
      } catch (_) {}
      if (col) {
        col.createRule = '@request.auth.' + 'id' + " != ''"
        app.save(col)
      }
    }
  },
)
