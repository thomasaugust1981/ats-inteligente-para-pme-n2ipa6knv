//
// Score de IA consultivo do candidato — agente NATIVO da Skip Cloud.
// Coleção ai_scores guarda: score numérico (0-100), justificativa textual
// (OBRIGATÓRIA — nunca número solto), notas por dimensão e um SNAPSHOT
// das informações usadas no cálculo (auditoria).
//
// Regras de segurança:
//  - createRule/updateRule/deleteRule = null → só o servidor (hook) grava.
//  - Score é SEMPRE consultivo; o agente não altera applications/audit_logs.
//

migrate(
  (app) => {
    const getColId = (name) => {
      try {
        return app.findCollectionByNameOrId(name).id
      } catch (err) {
        console.error('[migration 0012] coleção não encontrada:', name)
        throw err
      }
    }

    const collection = new Collection({
      type: 'base',
      name: 'ai_scores',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'application_id',
          type: 'relation',
          required: true,
          collectionId: getColId('applications'),
          maxSelect: 1,
          onDelete: 'Cascade',
        },
        {
          name: 'candidate_id',
          type: 'relation',
          required: true,
          collectionId: getColId('candidates'),
          maxSelect: 1,
          onDelete: 'Cascade',
        },
        {
          name: 'job_id',
          type: 'relation',
          required: false,
          collectionId: getColId('jobs'),
          maxSelect: 1,
          onDelete: 'SetNull',
        },
        {
          name: 'trigger',
          type: 'select',
          maxSelect: 1,
          values: [
            'manual',
            'stage_change',
            'disc_completed',
            'note_added',
            'stage_comment',
            'application_created',
          ],
        },
        { name: 'score', type: 'number', required: true },
        { name: 'score_technical', type: 'number' },
        { name: 'score_behavioral', type: 'number' },
        { name: 'score_cultural', type: 'number' },
        { name: 'justification', type: 'text', required: true },
        { name: 'insufficient_data', type: 'bool' },
        { name: 'snapshot', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE INDEX idx_ai_scores_application ON ai_scores (application_id)',
        'CREATE INDEX idx_ai_scores_candidate ON ai_scores (candidate_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('ai_scores'))
    } catch (_) {}
  },
)
