//
// Migração 0052 — Correção de PRECEDÊNCIA nas regras de interview_scorecards.
//
// Na 0051, o token EDITOR (três papéis) entrou desprotegido dentro de WRITE:
// o PocketBase devolveu "A && B && (C || D || E) || SUPER" — sem os parênteses
// em volta de (C || D || E) o OU final vaza, e um admin/recrutador/gestor de
// OUTRA organização podia alterar/apagar scorecard pelo id. As regras de
// create/list/view da 0051 estão corretas (validadas no painel); aqui só
// update/delete são regravados com os parênteses explícitos.
//
migrate(
  (app) => {
    var AUTH = '@request.auth.' + "id != ''"
    var SUPER = '@request.auth.' + "role = 'superadmin'"
    var EDITOR =
      '(' +
      '@request.auth.' +
      "role = 'admin' || @request.auth." +
      "role = 'recruiter' || @request.auth." +
      "role = 'manager')"
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'

    var WRITE = '(' + AUTH + ' && ' + ORG + ' && ' + EDITOR + ') || ' + SUPER

    var col = app.findCollectionByNameOrId('interview_scorecards')
    col.updateRule = WRITE
    col.deleteRule = WRITE
    app.save(col)

    console.log('[0052] update/delete de interview_scorecards regravados com precedência correta')
  },
  (app) => {
    var col = null
    try {
      col = app.findCollectionByNameOrId('interview_scorecards')
    } catch (_) {
      col = null
    }
    if (!col) return
    var AUTH2 = '@request.auth.' + "id != ''"
    var SUPER2 = '@request.auth.' + "role = 'superadmin'"
    var EDITOR2 =
      '@request.auth.' +
      "role = 'admin' || @request.auth." +
      "role = 'recruiter' || @request.auth." +
      "role = 'manager'"
    var ORG2 = 'org_' + 'id = @request.auth.org_' + 'id'
    var W2 = '(' + AUTH2 + ' && ' + ORG2 + ' && ' + EDITOR2 + ') || ' + SUPER2
    col.updateRule = W2
    col.deleteRule = W2
    app.save(col)
  },
)
