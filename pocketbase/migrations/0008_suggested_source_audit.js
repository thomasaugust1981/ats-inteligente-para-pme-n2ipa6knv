/// <reference path="../pb_data/types.d.ts" />
// 0008: origem "suggested" (candidato sugerido pelo sistema ao cadastrar vaga)
// e ação de auditoria "candidate_suggested" (trilha de inscrição via sugestão).
migrate(
  (app) => {
    const applications = app.findCollectionByNameOrId('applications')
    const sourceField = applications.fields.getByName('source')
    if (sourceField && !sourceField.values.includes('suggested')) {
      sourceField.values.push('suggested')
    }
    app.save(applications)

    const auditLogs = app.findCollectionByNameOrId('audit_logs')
    const actionField = auditLogs.fields.getByName('action')
    if (actionField && !actionField.values.includes('candidate_suggested')) {
      actionField.values.push('candidate_suggested')
    }
    app.save(auditLogs)
  },
  (app) => {
    const applications = app.findCollectionByNameOrId('applications')
    const sourceField = applications.fields.getByName('source')
    if (sourceField) {
      sourceField.values = sourceField.values.filter((v) => v !== 'suggested')
    }
    app.save(applications)

    const auditLogs = app.findCollectionByNameOrId('audit_logs')
    const actionField = auditLogs.fields.getByName('action')
    if (actionField) {
      actionField.values = actionField.values.filter((v) => v !== 'candidate_suggested')
    }
    app.save(auditLogs)
  },
)
