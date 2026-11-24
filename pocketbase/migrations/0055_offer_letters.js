/// <reference path="../pb_data/types.d.ts" />
/**
 * Migração 0055 — coleção offer_letters (carta de proposta por candidatura).
 * Padrão da 0051: coleção NOVA via new Collection() (em coleção existente o
 * fields.add + app.save não persiste no validador), com isolamento por org
 * nas regras e parênteses explícitos nos tokens compostos (lição da 0052).
 *
 * Campos: org_id (text), application_id (relation applications, required,
 * cascadeDelete), content (text), sent (bool — registro de envio manual),
 * created/updated automáticos do PocketBase.
 */
migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'offer_letters',
      listRule:
        "@request.auth.id != '' && (@request.auth.org_id != '' && org_id = @request.auth.org_id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.org_id != '' && org_id = @request.auth.org_id)",
      createRule:
        "@request.auth.id != '' && (@request.auth.org_id != '' && org_id = @request.auth.org_id)",
      updateRule:
        "@request.auth.id != '' && (@request.auth.org_id != '' && org_id = @request.auth.org_id)",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.org_id != '' && org_id = @request.auth.org_id)",
      fields: [
        new TextField({
          name: 'org_id',
          required: true,
          max: 40,
        }),
        new RelationField({
          name: 'application_id',
          required: true,
          collectionId: 'applications',
          cascadeDelete: true,
          maxSelect: 1,
        }),
        new TextField({
          name: 'content',
          required: true,
          max: 20000,
        }),
        new BoolField({
          name: 'sent',
        }),
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_offerletters_app ON offer_letters (application_id)',
        'CREATE INDEX idx_offerletters_org ON offer_letters (org_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    // Rollback: remove a coleção criada.
    const existing = app.findCollectionByNameOrId('offer_letters')
    if (existing) app.delete(existing)
  },
)
