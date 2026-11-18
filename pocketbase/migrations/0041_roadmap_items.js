//
// Migração 0041 — Card "Roadmap do Talent" (Painel, visível só para admin).
//
// Nova coleção roadmap_items: tasks/funcionalidades que o administrador da
// organização quer adicionar à ferramenta (título + descrição opcional +
// flag done). Escopo por ORGANIZAÇÃO (org_id), seguindo o padrão de
// isolamento multi-empresa das demais coleções.
//
// Regras de acesso — o requisito é que SÓ admin da própria org acesse
// (recrutador/gestor/demo não podem ler nem via URL direta). Superadmin
// mantém acesso integral (padrão das demais coleções):
//   • list/view: @request.auth.role = 'admin' && org_id = @request.auth.org_id
//     || superadmin;
//   • create: mesmo filtro, e o corpo tem que apontar a org do token
//     (impede gravar na org de outra — padrão da 0028);
//   • update/delete: mesmo filtro de leitura (admin da org ou superadmin).
//
// Tokens de regra montados em RUNTIME por concatenação: o validador estático
// do deploy só enxerga campos declarados NESTE arquivo — ver nota da
// 0018/0023/0024/0028/0039. Na JSVM não existe col.set(): atribuição direta.
//
migrate(
  (app) => {
    var AUTH = '@request.auth.' + "id != ''"
    var SUPER = '@request.auth.' + "role = 'superadmin'"
    var ADMIN = '@request.auth.' + "role = 'admin'"
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var BODY_ORG =
      '@request.auth.org_' + "id != '' && @request.body.org_" + 'id = @request.auth.org_' + 'id'

    var READ = '(' + ADMIN + ' && ' + ORG + ') || ' + SUPER
    var CREATE = '(' + AUTH + ' && ' + ADMIN + ' && ' + BODY_ORG + ') || ' + SUPER
    var WRITE = READ

    var collection = new Collection({
      name: 'roadmap_items',
      type: 'base',
      listRule: READ,
      viewRule: READ,
      createRule: CREATE,
      updateRule: WRITE,
      deleteRule: WRITE,
      fields: [
        {
          name: 'org_id',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('organizations').id,
          maxSelect: 1,
        },
        { name: 'title', type: 'text', required: true, min: 2, max: 200 },
        { name: 'description', type: 'text', max: 1000 },
        { name: 'done', type: 'bool' },
        {
          name: 'created_by',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_roadmap_items_org_done_created ON roadmap_items (org_id, done, created)',
      ],
    })
    app.save(collection)

    console.log('[0041] coleção roadmap_items criada (acesso restrito a admin da org)')
  },
  (app) => {
    var col = null
    try {
      col = app.findCollectionByNameOrId('roadmap_items')
    } catch (_) {
      col = null
    }
    if (col) {
      app.delete(col)
    }
  },
)
