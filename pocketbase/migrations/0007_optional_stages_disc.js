migrate(
  (app) => {
    // ---- jobs: alto impacto estratégico + etapas opcionais habilitadas ----
    const jobs = app.findCollectionByNameOrId('jobs')
    if (!jobs.fields.getByName('high_impact')) {
      jobs.fields.add(new BoolField({ name: 'high_impact' }))
    }
    if (!jobs.fields.getByName('optional_stages')) {
      jobs.fields.add(new JSONField({ name: 'optional_stages', maxSize: 2000 }))
    }
    app.save(jobs)

    // ---- companies: visão e missão (opcionais, alimentam o FIT cultural) ----
    const companies = app.findCollectionByNameOrId('companies')
    if (!companies.fields.getByName('vision')) {
      companies.fields.add(new TextField({ name: 'vision', max: 2000 }))
    }
    if (!companies.fields.getByName('mission')) {
      companies.fields.add(new TextField({ name: 'mission', max: 2000 }))
    }
    app.save(companies)

    // ---- disc_results: resultado do formulário DISC por candidatura ----
    // O link é público por token (/disc/:token); a submissão é anônima, por isso
    // list/view/update liberados e create apenas via hook (bypassa regras).
    let disc
    try {
      disc = app.findCollectionByNameOrId('disc_results')
    } catch (_) {
      disc = null
    }
    if (!disc) {
      disc = new Collection({
        name: 'disc_results',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: null,
        updateRule: '',
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'application_id', type: 'text', required: true },
          { name: 'token', type: 'text', required: true },
          { name: 'status', type: 'text' }, // pending | completed
          { name: 'score_d', type: 'number' },
          { name: 'score_i', type: 'number' },
          { name: 'score_s', type: 'number' },
          { name: 'score_c', type: 'number' },
          { name: 'profile', type: 'text' }, // perfil dominante (ex: "DI")
          { name: 'completed_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_disc_results_token ON disc_results (token)',
          'CREATE INDEX idx_disc_results_application ON disc_results (application_id)',
        ],
      })
    }
    app.save(disc)
  },
  (app) => {
    try {
      const disc = app.findCollectionByNameOrId('disc_results')
      app.delete(disc)
    } catch (_) {}
    try {
      const jobs = app.findCollectionByNameOrId('jobs')
      if (jobs.fields.getByName('high_impact')) {
        jobs.fields.removeByName('high_impact')
      }
      if (jobs.fields.getByName('optional_stages')) {
        jobs.fields.removeByName('optional_stages')
      }
      app.save(jobs)
    } catch (_) {}
    try {
      const companies = app.findCollectionByNameOrId('companies')
      if (companies.fields.getByName('vision')) companies.fields.removeByName('vision')
      if (companies.fields.getByName('mission')) companies.fields.removeByName('mission')
      app.save(companies)
    } catch (_) {}
  },
)
