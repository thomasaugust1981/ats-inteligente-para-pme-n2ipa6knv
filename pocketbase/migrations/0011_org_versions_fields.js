//
// Migração 0011 — ajustes no versionamento/workflow do Organograma:
//   1. org_versions: adiciona 'approved_by'/'approved_by_role' (quem completou
//      a aprovação) e índice único parcial que garante, no próprio banco, a
//      regra de negócio "apenas UMA versão APROVADA vigente por empresa".
//   2. org_approvals: 'user_id' (id do usuário autenticado quando houver) e
//      'instance' (1 = Gerente de RH, 2 = Gerente Administrativo) para o
//      painel de pendências.
// Idempotente: verifica a existência de cada campo antes de adicionar.
//
migrate(
  (app) => {
    const versions = app.findCollectionByNameOrId('org_versions')

    const hasField = (col, name) => col.fields.getByName && !!col.fields.getByName(name)

    if (!hasField(versions, 'approved_by')) {
      versions.fields.add(new TextField({ name: 'approved_by' }))
    }
    if (!hasField(versions, 'approved_by_role')) {
      versions.fields.add(new TextField({ name: 'approved_by_role' }))
    }
    app.save(versions)

    try {
      app
        .db()
        .newQuery(
          "CREATE UNIQUE INDEX IF NOT EXISTS idx_org_versions_current ON org_versions (company) WHERE status = 'APROVADA'",
        )
        .execute()
    } catch (err) {
      console.log('0011: índice parcial já existia ou falhou: ' + err)
    }

    try {
      const approvals = app.findCollectionByNameOrId('org_approvals')
      if (!hasField(approvals, 'user_id')) {
        approvals.fields.add(new TextField({ name: 'user_id' }))
      }
      if (!hasField(approvals, 'instance')) {
        approvals.fields.add(new NumberField({ name: 'instance', onlyInt: true }))
      }
      app.save(approvals)
    } catch (err) {
      console.log('0011: org_approvals não encontrada: ' + err)
    }
  },
  (app) => {
    try {
      app.db().newQuery('DROP INDEX IF EXISTS idx_org_versions_current').execute()
    } catch (_) {}
  },
)
