//
// Migração 0023 — Correção do furo C4 da auditoria (nov/2026):
// a regra de update de candidates aceita atualização anônima quando
// "@request.body.email = email" — qualquer pessoa que saiba o e-mail de um
// candidato podia SOBRESCREVER o cadastro dele (nome, CPF, currículo...).
//
// Novas regras de candidates:
//   • list/view: só autenticado da própria organização (ou superadmin) —
//     NADA de leitura anônima que exponha PII;
//   • create: continua público (@request.auth.id = "") — a candidatura pela
//     página de carreiras não exige login;
//   • update/delete: apenas organização autenticada ou superadmin (remove a
//     cláusula anônima por e-mail). O vínculo de e-mail existente passa a ser
//     resolvido server-side no hook pocketbase/hooks/application_dedupe.js.
//
// Regras autenticadas (isolamento por org_id) ficam exatamente como na 0018.
// Tokens de regra montados em runtime: o validador estático do deploy só
// enxerga campos declarados NESTE arquivo e rejeitaria referências a org_id
// (criado na 0018) e a campos de users — ver nota da 0018.
//
migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('candidates')

    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var AUTH = '@request.auth.' + 'id' + " != ''"
    var SUPER = '@request.auth.' + 'role' + " = 'superadmin'"
    var ANON_CREATE = '@request.auth.' + 'id' + ' = ""'

    // A JSVM de migrações não expõe col.set(...): grava por atribuição direta
    // (mesmo contrato usado na 0018).
    col.listRule = '(' + ORG + ' && ' + AUTH + ') || ' + SUPER
    col.viewRule = '(' + ORG + ' && ' + AUTH + ') || ' + SUPER
    col.createRule = ANON_CREATE
    col.updateRule = '(' + ORG + ' && ' + AUTH + ') || ' + SUPER

    app.save(col)
    console.log('[0023] regras de candidates endurecidas (sem update/leitura anônimos)')
  },
  (app) => {
    // rollback: restaura as regras vigentes antes desta migração
    var col = null
    try {
      col = app.findCollectionByNameOrId('candidates')
    } catch (_) {
      return
    }
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var AUTH = '@request.auth.' + 'id' + " != ''"
    var SUPER = '@request.auth.' + 'role' + " = 'superadmin'"
    col.listRule = '(' + ORG + ' && ' + AUTH + ') || ' + SUPER
    col.viewRule = '(' + ORG + ' && ' + AUTH + ') || ' + SUPER
    col.createRule = '@request.auth.' + 'id' + ' = ""'
    col.updateRule = '(' + ORG + ' && ' + AUTH + ') || @request.body.' + 'email = email || ' + SUPER
    app.save(col)
  },
)
