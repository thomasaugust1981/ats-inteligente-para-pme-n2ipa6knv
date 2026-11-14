//
// Provedor de IA próprio do cliente (BYOK) na coleção ai_agent_settings.
// Novos campos:
//   ai_provider       — select: native (padrão) | openai | gemini
//   ai_api_key        — texto HIDDEN: gravável apenas pelo admin, e JAMAIS
//                       retornada em list/view/realtime (hidden fields não são
//                       serializados para clientes nem filtráveis via regras).
//   ai_model          — modelo opcional; vazio = default razoável do provedor.
//   ai_key_last4      — 4 últimos dígitos, para exibição mascarada na UI.
//   ai_key_updated_at — data da última gravação da chave.
// Seed idempotente: o registro existente fica com ai_provider = 'native'.
//
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ai_agent_settings')

    if (!col.fields.getByName('ai_provider')) {
      col.fields.add(
        new SelectField({
          name: 'ai_provider',
          values: ['native', 'openai', 'gemini'],
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('ai_api_key')) {
      col.fields.add(new TextField({ name: 'ai_api_key', hidden: true, min: 0, max: 500 }))
    }
    if (!col.fields.getByName('ai_model')) {
      col.fields.add(new TextField({ name: 'ai_model', max: 100 }))
    }
    if (!col.fields.getByName('ai_key_last4')) {
      col.fields.add(new TextField({ name: 'ai_key_last4', max: 4 }))
    }
    if (!col.fields.getByName('ai_key_updated_at')) {
      col.fields.add(new DateField({ name: 'ai_key_updated_at' }))
    }
    app.save(col)

    // Seed idempotente: registro global existente → provider 'native'.
    const records = app.findRecordsByFilter('ai_agent_settings', 'id != ""', '', 10, 0)
    for (const record of records) {
      if (!record.get('ai_provider')) {
        record.set('ai_provider', 'native')
        app.save(record)
      }
    }
  },
  (app) => {
    // Revert: remove os campos BYOK.
    try {
      const col = app.findCollectionByNameOrId('ai_agent_settings')
      for (const name of [
        'ai_provider',
        'ai_api_key',
        'ai_model',
        'ai_key_last4',
        'ai_key_updated_at',
      ]) {
        try {
          col.fields.removeByName(name)
        } catch (_) {}
      }
      app.save(col)
      const records = app.findRecordsByFilter('ai_agent_settings', 'id != ""', '', 10, 0)
      for (const record of records) {
        record.set('ai_api_key', '')
        record.set('ai_key_last4', '')
        record.set('ai_key_updated_at', null)
        app.save(record)
      }
    } catch (_) {}
  },
)
