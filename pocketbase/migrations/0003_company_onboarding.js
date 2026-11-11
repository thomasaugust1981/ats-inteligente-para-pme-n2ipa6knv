migrate(
  (app) => {
    // 1. companies: cor de marca + status do onboarding
    const companies = app.findCollectionByNameOrId('companies')
    if (!companies.fields.getByName('brand_color')) {
      companies.fields.add(
        new TextField({
          name: 'brand_color',
          // hex #RRGGBB
          pattern: '^#[0-9a-fA-F]{6}$',
          required: false,
        }),
      )
    }
    if (!companies.fields.getByName('onboarding_status')) {
      companies.fields.add(
        new SelectField({
          name: 'onboarding_status',
          values: ['not_started', 'in_progress', 'completed', 'skipped'],
          maxSelect: 1,
          required: false,
        }),
      )
    }
    app.save(companies)

    // 2. team_invites: convites pendentes visíveis no app (sem envio real de e-mail)
    const teamInvites = new Collection({
      name: 'team_invites',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'email', type: 'email', required: true },
        {
          name: 'role',
          type: 'select',
          values: ['admin', 'recruiter', 'manager'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'accepted', 'cancelled'],
          maxSelect: 1,
        },
        { name: 'invited_by', type: 'text' }, // nome do administrador que convidou
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_team_invites_email ON team_invites (email)'],
    })
    app.save(teamInvites)
  },
  (app) => {
    try {
      const teamInvites = app.findCollectionByNameOrId('team_invites')
      app.delete(teamInvites)
    } catch (_) {}
    const companies = app.findCollectionByNameOrId('companies')
    if (companies.fields.getByName('brand_color')) {
      companies.fields.removeByName('brand_color')
    }
    if (companies.fields.getByName('onboarding_status')) {
      companies.fields.removeByName('onboarding_status')
    }
    app.save(companies)
  },
)
