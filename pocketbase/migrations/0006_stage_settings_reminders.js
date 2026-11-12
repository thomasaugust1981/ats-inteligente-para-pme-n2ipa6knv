migrate(
  (app) => {
    // stage_settings: responsável (usuário da equipe e/ou e-mail livre) e lembretes por etapa da vaga
    let settings
    try {
      settings = app.findCollectionByNameOrId('stage_settings')
    } catch (_) {
      settings = null
    }

    if (!settings) {
      settings = new Collection({
        name: 'stage_settings',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'job_id', type: 'text', required: true },
          { name: 'stage_id', type: 'text', required: true },
          { name: 'owner_user_id', type: 'text' }, // id do usuário da equipe responsável
          { name: 'owner_email', type: 'email' }, // e-mail adicional livre
          { name: 'reminder_enabled', type: 'bool' },
          { name: 'reminder_days', type: 'number' }, // dias pendentes antes de lembrar (padrão 2)
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_stage_settings_job_stage ON stage_settings (job_id, stage_id)',
        ],
      })
    }

    // Idempotência: campos podem faltar se a coleção já existir
    if (!settings.fields.getByName('owner_user_id')) {
      settings.fields.add(new TextField({ name: 'owner_user_id' }))
    }
    if (!settings.fields.getByName('owner_email')) {
      settings.fields.add(new EmailField({ name: 'owner_email' }))
    }
    if (!settings.fields.getByName('reminder_enabled')) {
      settings.fields.add(new BoolField({ name: 'reminder_enabled' }))
    }
    if (!settings.fields.getByName('reminder_days')) {
      settings.fields.add(new NumberField({ name: 'reminder_days', onlyInt: true }))
    }
    app.save(settings)

    // applications: controle do último lembrete enviado (anti-spam por candidato/etapa)
    const applications = app.findCollectionByNameOrId('applications')
    if (!applications.fields.getByName('last_stage_reminder_at')) {
      applications.fields.add(new DateField({ name: 'last_stage_reminder_at' }))
    }
    app.save(applications)
  },
  (app) => {
    try {
      const settings = app.findCollectionByNameOrId('stage_settings')
      app.delete(settings)
    } catch (_) {}
  },
)
