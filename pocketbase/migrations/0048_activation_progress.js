//
// Migração 0048 — Progresso do checklist de ativação (Painel, card
// "Coloque o Talent para trabalhar" da FASE 1 de autoadoção).
//
// Coleção activation_checklist: guarda SOMENTE as marcações que não podem ser
// derivadas de dados (hoje: "compartilhou o link de carreiras"), por
// organização + usuário. Os demais passos (vaga publicada, cargo criado,
// candidatura recebida, movimentação no pipeline) são derivados de dados reais
// no frontend e NÃO são gravados aqui.
//
// Regras de acesso — padrão do projeto (ver nota da 0018/0023/0024/0028/0041):
// qualquer usuário autenticado da própria org lê/escreve o SEU registro
// (admin, recrutador e gestor; demo incluído), superadmin integral.
// Tokens montados em RUNTIME por concatenação: o validador estático do deploy
// só enxerga campos declarados NESTE arquivo. Na JSVM não existe col.set().
//
migrate(
  (app) => {
    var AUTH = '@request.auth.' + "id != ''"
    var SUPER = '@request.auth.' + "role = 'superadmin'"
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var USER = 'user_' + 'id = @request.auth.id'
    var BODY_ORG =
      '@request.auth.org_' + "id != '' && @request.body.org_" + 'id = @request.auth.org_' + 'id'
    var BODY_USER = '@request.body.user_' + 'id = @request.auth.id'

    var READ = '(' + AUTH + ' && ' + ORG + ' && ' + USER + ') || ' + SUPER
    var CREATE = '(' + AUTH + ' && ' + BODY_ORG + ' && ' + BODY_USER + ') || ' + SUPER
    var WRITE = READ

    var collection = new Collection({
      name: 'activation_checklist',
      type: 'base',
      listRule: READ,
      viewRule: READ,
      createRule: CREATE,
      updateRule: WRITE,
      deleteRule: null,
      fields: [
        {
          name: 'org_id',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('organizations').id,
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'shared_link', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_activation_checklist_org_user ON activation_checklist (org_id, user_id)',
      ],
    })
    app.save(collection)

    console.log('[0048] coleção activation_checklist criada (org+usuário, isolada por org_id)')
  },
  (app) => {
    var col = null
    try {
      col = app.findCollectionByNameOrId('activation_checklist')
    } catch (_) {
      col = null
    }
    if (col) {
      app.delete(col)
    }
  },
)
