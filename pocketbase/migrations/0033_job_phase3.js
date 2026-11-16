//
// Migração 0033 — FASE 3 do fluxo Organograma → Cargo → Vaga: a VAGA.
//
//   • jobs: campos novos —
//       org_node_id            relation → org_nodes (posição herdada, read-only)
//       organograma_version_id relation → org_versions (versão vigente na abertura)
//       manager_name           text   (gestor responsável, herdado da posição)
//       cost_center            text   (centro de custo, herdado da posição)
//       headcount              number (quantidade de posições — editável)
//       deadline               date   (prazo — editável)
//       urgent                 bool   (urgência — editável)
//       extra_requirements     text   (requisitos ESPECÍFICOS da vaga — separado
//                               do CHA/requirements do cargo)
//       cargo_snapshot         json   (snapshot do cargo na abertura)
//       organograma_snapshot   json   (snapshot da posição/versão na abertura)
//       opened_at / opened_by / opened_by_id (auditoria da abertura)
//   • audit_logs: novos valores no select action — job_opened | job_published
//     (transições da vaga gravam na mesma trilha das outras).
//   • salary_min/salary_max/department/cargo_id/cha_requirements JÁ EXISTEM em
//     jobs — herdados do cargo, sem recriar.
//
// Tokens de regra montados em RUNTIME por concatenação (validador estático só
// enxerga campos declarados NESTE arquivo). JSVM não tem col.set().
//
migrate(
  (app) => {
    var jobs = app.findCollectionByNameOrId('jobs')

    // ---- relations ----
    if (!jobs.fields.getByName('org_node_id')) {
      jobs.fields.add(
        new RelationField({
          name: 'org_node_id',
          collectionId: app.findCollectionByNameOrId('org_nodes').id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      app.save(jobs)
    }
    if (!jobs.fields.getByName('organograma_version_id')) {
      jobs.fields.add(
        new RelationField({
          name: 'organograma_version_id',
          collectionId: app.findCollectionByNameOrId('org_versions').id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      app.save(jobs)
    }

    // ---- textos ----
    var texts = ['manager_name', 'cost_center', 'extra_requirements', 'opened_by', 'opened_by_id']
    for (var t = 0; t < texts.length; t++) {
      if (!jobs.fields.getByName(texts[t])) {
        jobs.fields.add(new TextField({ name: texts[t] }))
        app.save(jobs)
      }
    }

    // ---- number / date / bool ----
    if (!jobs.fields.getByName('headcount')) {
      jobs.fields.add(new NumberField({ name: 'headcount' }))
      app.save(jobs)
    }
    if (!jobs.fields.getByName('deadline')) {
      jobs.fields.add(new DateField({ name: 'deadline' }))
      app.save(jobs)
    }
    if (!jobs.fields.getByName('urgent')) {
      jobs.fields.add(new BoolField({ name: 'urgent' }))
      app.save(jobs)
    }
    if (!jobs.fields.getByName('opened_at')) {
      jobs.fields.add(new DateField({ name: 'opened_at' }))
      app.save(jobs)
    }

    // ---- snapshots JSON ----
    if (!jobs.fields.getByName('cargo_snapshot')) {
      jobs.fields.add(new JSONField({ name: 'cargo_snapshot', maxSize: 2000000 }))
      app.save(jobs)
    }
    if (!jobs.fields.getByName('organograma_snapshot')) {
      jobs.fields.add(new JSONField({ name: 'organograma_snapshot', maxSize: 2000000 }))
      app.save(jobs)
    }

    // ---- índices ----
    jobs = app.findCollectionByNameOrId('jobs')
    jobs.addIndex('idx_jobs_cargo', false, 'cargo_id', '')
    jobs.addIndex('idx_jobs_org_node', false, 'org_node_id', '')
    app.save(jobs)

    // ---- audit_logs: novos valores de action (idempotente) ----
    try {
      var audit = app.findCollectionByNameOrId('audit_logs')
      var actionField = audit.fields.getByName('action')
      var values = actionField.values || []
      var hasOpened = false
      var hasPublished = false
      for (var i = 0; i < values.length; i++) {
        if (values[i] === 'job_opened') hasOpened = true
        if (values[i] === 'job_published') hasPublished = true
      }
      if (!hasOpened || !hasPublished) {
        var next = []
        for (var j = 0; j < values.length; j++) next.push(values[j])
        if (!hasOpened) next.push('job_opened')
        if (!hasPublished) next.push('job_published')
        actionField.values = next
        app.save(audit)
        console.log('[0033] audit_logs.action: job_opened/job_published adicionados')
      }
    } catch (err) {
      console.log('[0033] ajuste do enum audit_logs.action falhou: ' + err)
    }

    console.log('[0033] FASE 3 (vaga) aplicada')
  },
  (app) => {
    try {
      var jobs = app.findCollectionByNameOrId('jobs')
      var drop = [
        'org_node_id',
        'organograma_version_id',
        'manager_name',
        'cost_center',
        'headcount',
        'deadline',
        'urgent',
        'extra_requirements',
        'cargo_snapshot',
        'organograma_snapshot',
        'opened_at',
        'opened_by',
        'opened_by_id',
      ]
      for (var i = 0; i < drop.length; i++) {
        jobs.fields.removeByName(drop[i])
      }
      jobs.removeIndex('idx_jobs_cargo')
      jobs.removeIndex('idx_jobs_org_node')
      app.save(jobs)
    } catch (_) {}
  },
)
