//
// Configuração do agente de score de IA (single-tenant, 1 registro global).
// Coleção ai_agent_settings: enabled, pesos das 3 dimensões (soma 100, validado
// no hook OnRecordValidate), gatilhos automáticos ligáveis individualmente e
// updated_by. Leitura para usuários autenticados; escrita apenas admin —
// um recrutador/gestor que tentar gravar pelo SDK recebe 403/400.
//
migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'

    const collection = new Collection({
      name: 'ai_agent_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin'",
      updateRule: "@request.auth.role = 'admin'",
      deleteRule: null,
      fields: [
        { name: 'enabled', type: 'bool' },
        { name: 'weight_technical', type: 'number', onlyInt: true, min: 0, max: 100 },
        { name: 'weight_behavioral', type: 'number', onlyInt: true, min: 0, max: 100 },
        { name: 'weight_cultural', type: 'number', onlyInt: true, min: 0, max: 100 },
        { name: 'trigger_new_application', type: 'bool' },
        { name: 'trigger_stage_change', type: 'bool' },
        { name: 'trigger_disc_completed', type: 'bool' },
        { name: 'trigger_note_added', type: 'bool' },
        { name: 'updated_by', type: 'relation', collectionId: usersColId, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)

    // Seed idempotente: um único registro global (padrões = comportamento atual).
    let seeded = false
    try {
      app.findFirstRecordByData('ai_agent_settings', 'enabled', true)
      seeded = true
    } catch (_) {}
    if (!seeded) {
      try {
        app.findFirstRecordByData('ai_agent_settings', 'enabled', false)
        seeded = true
      } catch (_) {}
    }
    if (!seeded) {
      const record = new Record(collection)
      record.set('enabled', true)
      record.set('weight_technical', 50)
      record.set('weight_behavioral', 30)
      record.set('weight_cultural', 20)
      record.set('trigger_new_application', true)
      record.set('trigger_stage_change', true)
      record.set('trigger_disc_completed', true)
      record.set('trigger_note_added', true)
      app.save(record)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ai_agent_settings')
      app.delete(col)
    } catch (_) {}
  },
)
