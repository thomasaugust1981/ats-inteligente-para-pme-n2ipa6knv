/// <reference path="../pb_data/types.d.ts" />
//
// Migração 0056 — correção das regras update/delete de offer_letters.
//
// A 0055 criou a coleção, mas as regras update/delete saíram com bug de
// precedência de operadores (lição da 0052): "... && A || B || C) || superadmin"
// — os papéis precisam de parênteses próprios dentro da conjunção. Esta
// migração corrige updateRule/deleteRule para o padrão canônico:
//   ((auth && org && (admin || recruiter || manager))) || superadmin
//
// Regras montadas em RUNTIME por concatenação (o validador estático só enxerga
// campos declarados NESTE arquivo — lição das migrações 0051/0052). Alteração
// de coleção EXISTENTE: carregue com findCollectionByNameOrId, atribua as
// regras por atribuição direta (col.updateRule = ... — na JSVM col.set() não
// existe) e salve com app.save(col).
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
      "role = 'manager'" +
      ')'
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'

    var READ = '(' + AUTH + ' && ' + ORG + ') || ' + SUPER
    var WRITE = '((' + AUTH + ' && ' + ORG + ' && ' + EDITOR + ')) || ' + SUPER

    var col = app.findCollectionByNameOrId('offer_letters')
    col.listRule = READ
    col.viewRule = READ
    col.createRule =
      '(' +
      AUTH +
      ' && @request.body.' +
      'org_id = @request.auth.org_id && ' +
      EDITOR +
      ') || ' +
      SUPER
    col.updateRule = WRITE
    col.deleteRule = WRITE
    app.save(col)

    console.log('[0056] offer_letters: regras update/delete corrigidas (parênteses explícitos)')
  },
  (app) => {
    // Down: restaura as regras com o bug de precedência da 0055 (histórico;
    // o estado correto é o da up).
    var col = app.findCollectionByNameOrId('offer_letters')
    var AUTH = '@request.auth.' + "id != ''"
    var SUPER = '@request.auth.' + "role = 'superadmin'"
    var EDITOR =
      '@request.auth.' +
      "role = 'admin' || @request.auth." +
      "role = 'recruiter' || @request.auth." +
      "role = 'manager'"
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var WRITE = '(' + AUTH + ' && ' + ORG + ' && ' + EDITOR + ') || ' + SUPER
    col.updateRule = WRITE
    col.deleteRule = WRITE
    app.save(col)
  },
)
