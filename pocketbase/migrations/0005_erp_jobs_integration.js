/// <reference path="../pb_data/types.d.ts" />
//
// 0005 — Integração ERP:
// 1. companies: api_key_hash (hash SHA-256 da chave de API, campo oculto) e
//    api_key_prefix (8 primeiros caracteres, para exibição no painel).
// 2. jobs: source (origem da vaga: "manual" | "erp") e external_id (identificador
//    do cargo no ERP do cliente, usado para idempotência).
// 3. audit_logs: novas ações para registrar cada sincronização recebida do ERP.

migrate(
  (app) => {
    // ---- 1. companies: chave de API -----------------------------------------
    const companies = app.findCollectionByNameOrId('companies')
    if (!companies.fields.getByName('api_key_hash')) {
      companies.fields.add(
        new TextField({
          name: 'api_key_hash',
          required: false,
          hidden: true, // nunca sai pela API normal; só hooks/superuser
        }),
      )
    }
    if (!companies.fields.getByName('api_key_prefix')) {
      companies.fields.add(
        new TextField({
          name: 'api_key_prefix',
          required: false,
          max: 12,
        }),
      )
    }
    app.save(companies)

    // ---- 2. jobs: origem + external_id --------------------------------------
    const jobs = app.findCollectionByNameOrId('jobs')
    if (!jobs.fields.getByName('source')) {
      jobs.fields.add(
        new SelectField({
          name: 'source',
          values: ['manual', 'erp'],
          maxSelect: 1,
          required: false,
        }),
      )
    }
    if (!jobs.fields.getByName('external_id')) {
      jobs.fields.add(
        new TextField({
          name: 'external_id',
          required: false,
          max: 120,
        }),
      )
    }
    jobs.addIndex('idx_jobs_external_id', false, 'external_id', '')
    app.save(jobs)

    // ---- 3. audit_logs: ações de sincronização ERP --------------------------
    const auditLogs = app.findCollectionByNameOrId('audit_logs')
    const actionField = auditLogs.fields.getByName('action')
    if (actionField) {
      const current = actionField.values || []
      const additions = ['erp_job_created', 'erp_job_updated', 'erp_job_rejected']
      additions.forEach((v) => {
        if (current.indexOf(v) === -1) current.push(v)
      })
      actionField.values = current
      app.save(auditLogs)
    }
  },
  (app) => {
    const companies = app.findCollectionByNameOrId('companies')
    if (companies.fields.getByName('api_key_hash')) {
      companies.fields.removeByName('api_key_hash')
    }
    if (companies.fields.getByName('api_key_prefix')) {
      companies.fields.removeByName('api_key_prefix')
    }
    app.save(companies)

    const jobs = app.findCollectionByNameOrId('jobs')
    if (jobs.fields.getByName('source')) {
      jobs.fields.removeByName('source')
    }
    if (jobs.fields.getByName('external_id')) {
      jobs.fields.removeByName('external_id')
    }
    jobs.removeIndex('idx_jobs_external_id')
    app.save(jobs)

    const auditLogs = app.findCollectionByNameOrId('audit_logs')
    const actionField = auditLogs.fields.getByName('action')
    if (actionField) {
      actionField.values = actionField.values.filter(
        (v) => v !== 'erp_job_created' && v !== 'erp_job_updated' && v !== 'erp_job_rejected',
      )
      app.save(auditLogs)
    }
  },
)
