migrate(
  (app) => {
    // Origem "suggested": candidaturas criadas a partir do painel de
    // "Candidatos sugeridos para esta vaga" (banco de talentos).
    const applications = app.findCollectionByNameOrId('applications')
    const source = applications.fields.getByName('source')
    if (source && !source.values.includes('suggested')) {
      source.values.push('suggested')
    }
    app.save(applications)

    // Ação de auditoria dedicada: sistema sugeriu o candidato e um usuário o inscreveu.
    const auditLogs = app.findCollectionByNameOrId('audit_logs')
    const action = auditLogs.fields.getByName('action')
    if (action && !action.values.includes('candidate_suggested')) {
      action.values.push('candidate_suggested')
    }
    app.save(auditLogs)
  },
  (app) => {
    try {
      const applications = app.findCollectionByNameOrId('applications')
      const source = applications.fields.getByName('source')
      if (source) {
        source.values = source.values.filter((v) => v !== 'suggested')
      }
      app.save(applications)
    } catch (_) {}
    try {
      const auditLogs = app.findCollectionByNameOrId('audit_logs')
      const action = auditLogs.fields.getByName('action')
      if (action) {
        action.values = action.values.filter((v) => v !== 'candidate_suggested')
      }
      app.save(auditLogs)
    } catch (_) {}
  },
)
