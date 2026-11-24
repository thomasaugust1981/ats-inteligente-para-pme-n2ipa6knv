//
// Migração 0054 — Novos valores no select action de audit_logs.
//
// A carta de proposta registra a ação "proposal_sent" (etapa Proposta do
// pipeline). Aproveita para garantir os valores de requisição de vaga
// (requisition_created/approved/rejected), usados desde a v0.0.117.
//
// Padrão da mig 0005: carregar o campo select, acrescentar valores ausentes
// e salvar a coleção (sem col.set(), atribuição direta).
//
migrate(
  (app) => {
    const auditLogs = app.findCollectionByNameOrId('audit_logs')
    const actionField = auditLogs.fields.getByName('action')
    if (!actionField) return
    const current = actionField.values || []
    const additions = [
      'proposal_sent',
      'requisition_created',
      'requisition_approved',
      'requisition_rejected',
    ]
    additions.forEach((v) => {
      if (current.indexOf(v) === -1) current.push(v)
    })
    actionField.values = current
    app.save(auditLogs)
    console.log('[0054] valores de action garantidos em audit_logs')
  },
  (app) => {
    try {
      const auditLogs = app.findCollectionByNameOrId('audit_logs')
      const actionField = auditLogs.fields.getByName('action')
      if (!actionField) return
      actionField.values = (actionField.values || []).filter((v) => v !== 'proposal_sent')
      app.save(auditLogs)
    } catch (_) {}
  },
)
