/// <reference path="../pb_data/types.d.ts" />
//
// Migração 0055 — coleção offer_letters (carta de proposta por candidatura).
//
// Padrão da 0051: coleção NOVA via new Collection() com fields como objetos
// planos ({ name, type }) — construtores tipados (new TextField) dentro do
// array de fields fazem o PocketBase descartar o fields inteiro silenciosamente
// e o validador do deploy rejeita a regra de acesso ("field 'org_id' not
// defined"). Isolamento por org nas regras, tokens compostos com parênteses
// explícitos (lição da 0052), regras montadas em RUNTIME por concatenação
// (o validador estático só enxerga campos declarados NESTE arquivo).
//
// Campos: org_id (relation organizations), application_id (relation
// applications, required, cascadeDelete), content (text), sent (bool —
// registro de envio manual), created/updated automáticos.
//
migrate(
  (app) => {
    var AUTH = '@request.auth.' + "id != ''"
    var SUPER = '@request.auth.' + "role = 'superadmin'"
    var EDITOR =
      '@request.auth.' +
      "role = 'admin' || @request.auth." +
      "role = 'recruiter' || @request.auth." +
      "role = 'manager'"
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var BODY_ORG =
      '@request.auth.org_' + "id != '' && @request.body.org_" + 'id = @request.auth.org_' + 'id'

    // Leitura: qualquer usuário autenticado da própria org (a carta aparece no
    // contexto da candidatura para toda a equipe); superadmin vê tudo.
    var READ = '(' + AUTH + ' && ' + ORG + ') || ' + SUPER
    // Escrita: admin/recrutador/gestor da org registram/editam; superadmin livre.
    var WRITE = '(' + AUTH + ' && ' + ORG + ' && ' + EDITOR + ') || ' + SUPER

    var organizationsId = app.findCollectionByNameOrId('organizations').id
    var applicationsId = app.findCollectionByNameOrId('applications').id

    var collection = new Collection({
      name: 'offer_letters',
      type: 'base',
      listRule: READ,
      viewRule: READ,
      createRule: '(' + AUTH + ' && ' + BODY_ORG + ' && (' + EDITOR + ')) || ' + SUPER,
      updateRule: WRITE,
      deleteRule: WRITE,
      fields: [
        {
          name: 'org_id',
          type: 'relation',
          required: true,
          collectionId: organizationsId,
          maxSelect: 1,
        },
        {
          name: 'application_id',
          type: 'relation',
          required: true,
          collectionId: applicationsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'content', type: 'text', required: true, max: 20000 },
        { name: 'sent', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_offerletters_app ON offer_letters (application_id)',
        'CREATE INDEX idx_offerletters_org ON offer_letters (org_id, created)',
      ],
    })
    app.save(collection)

    console.log('[0055] offer_letters criada (uma carta por candidatura, isolada por org)')
  },
  (app) => {
    var col = null
    try {
      col = app.findCollectionByNameOrId('offer_letters')
    } catch (_) {
      col = null
    }
    if (col) {
      app.delete(col)
    }
  },
)
