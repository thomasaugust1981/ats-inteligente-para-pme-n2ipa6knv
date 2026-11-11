migrate(
  (app) => {
    // 1. Atualizar coleção users com campos necessários: role, company_name
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: ['admin', 'recruiter', 'manager'],
          maxSelect: 1,
          required: false,
        }),
      )
    }
    if (!users.fields.getByName('company_name')) {
      users.fields.add(
        new TextField({
          name: 'company_name',
          required: false,
        }),
      )
    }
    app.save(users)

    // 2. Coleção companies (empresa cliente)
    const companies = new Collection({
      name: 'companies',
      type: 'base',
      listRule: '', // leitura pública para carregar marca na página de carreiras
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'trade_name', type: 'text' },
        { name: 'description', type: 'text' },
        {
          name: 'logo',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
        },
        { name: 'website', type: 'url' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(companies)

    // 3. Coleção jobs (vagas)
    const jobs = new Collection({
      name: 'jobs',
      type: 'base',
      listRule: '', // leitura pública (para página de carreiras) ou autenticado
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'description', type: 'text', required: true },
        { name: 'department', type: 'text' },
        { name: 'location', type: 'text' },
        {
          name: 'workplace_type',
          type: 'select',
          values: ['remote', 'hybrid', 'on_site'],
          maxSelect: 1,
        },
        {
          name: 'employment_type',
          type: 'select',
          values: ['clt', 'pj', 'internship', 'temporary'],
          maxSelect: 1,
        },
        {
          name: 'seniority',
          type: 'select',
          values: ['intern', 'junior', 'mid', 'senior', 'lead', 'specialist'],
          maxSelect: 1,
        },
        { name: 'requirements', type: 'text' },
        { name: 'benefits', type: 'text' },
        { name: 'salary_min', type: 'number' },
        { name: 'salary_max', type: 'number' },
        { name: 'salary_disclosed', type: 'bool' },
        {
          name: 'status',
          type: 'select',
          values: ['draft', 'published', 'paused', 'closed'],
          maxSelect: 1,
        },
        { name: 'stages', type: 'json' }, // Etapas configuráveis: [{ id: "applied", label: "Inscrição" }, ...]
        {
          name: 'manager_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_jobs_status ON jobs (status)',
        'CREATE INDEX idx_jobs_manager ON jobs (manager_id)',
      ],
    })
    app.save(jobs)

    // 4. Coleção candidates (dados pessoais + currículo + consentimento LGPD)
    const candidates = new Collection({
      name: 'candidates',
      type: 'base',
      listRule: "@request.auth.id != ''", // recrutadores/gestores logados
      viewRule: "@request.auth.id != ''",
      createRule: '', // candidatura pública permite criação
      updateRule: "@request.auth.id != '' || @request.body.email = email", // para banco de talentos
      deleteRule: "@request.auth.id != ''", // exclusão real LGPD
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'phone', type: 'text' },
        { name: 'cpf', type: 'text' },
        { name: 'linkedin', type: 'url' },
        { name: 'location', type: 'text' },
        {
          name: 'seniority',
          type: 'select',
          values: ['intern', 'junior', 'mid', 'senior', 'lead', 'specialist'],
          maxSelect: 1,
        },
        { name: 'skills', type: 'text' }, // tags separadas por vírgula para busca e filtros
        {
          name: 'availability',
          type: 'select',
          values: ['immediate', 'two_weeks', 'one_month', 'exploring'],
          maxSelect: 1,
        },
        {
          name: 'resume',
          type: 'file',
          maxSelect: 1,
          maxSize: 15728640,
          mimeTypes: ['application/pdf'],
        },
        { name: 'lgpd_consent', type: 'bool' },
        { name: 'lgpd_consent_date', type: 'date' },
        { name: 'lgpd_consent_version', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_candidates_email ON candidates (email)',
        'CREATE INDEX idx_candidates_seniority ON candidates (seniority)',
      ],
    })
    app.save(candidates)

    // 5. Coleção applications (candidaturas ligando candidato à vaga e etapa do funil)
    const candidateColId = app.findCollectionByNameOrId('candidates').id
    const jobColId = app.findCollectionByNameOrId('jobs').id

    const applications = new Collection({
      name: 'applications',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '', // pública: candidato se inscreve
      updateRule: "@request.auth.id != ''", // recrutador/gestor move no pipeline
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'candidate_id',
          type: 'relation',
          collectionId: candidateColId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'job_id',
          type: 'relation',
          collectionId: jobColId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'stage_id', type: 'text', required: true }, // ex: "applied", "screening", "interview", "offer", "hired", "rejected"
        {
          name: 'status',
          type: 'select',
          values: ['active', 'hired', 'rejected', 'withdrawn'],
          maxSelect: 1,
        },
        {
          name: 'source',
          type: 'select',
          values: ['google_for_jobs', 'direct_link', 'whatsapp', 'referral', 'linkedin', 'other'],
          maxSelect: 1,
        },
        { name: 'rejection_reason', type: 'text' },
        { name: 'rejection_note', type: 'text' },
        { name: 'stage_updated_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_applications_job ON applications (job_id)',
        'CREATE INDEX idx_applications_candidate ON applications (candidate_id)',
        'CREATE INDEX idx_applications_stage ON applications (job_id, stage_id)',
      ],
    })
    app.save(applications)

    // 6. Coleção audit_logs (trilha de auditoria: quem viu currículo, quem moveu, quem reprovou, justificativa)
    const appColId = app.findCollectionByNameOrId('applications').id

    const auditLogs = new Collection({
      name: 'audit_logs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null, // imutável por segurança
      deleteRule: null, // imutável
      fields: [
        {
          name: 'application_id',
          type: 'relation',
          collectionId: appColId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'candidate_id',
          type: 'relation',
          collectionId: candidateColId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'user_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'user_name', type: 'text' },
        { name: 'user_role', type: 'text' },
        {
          name: 'action',
          type: 'select',
          values: [
            'viewed_resume',
            'stage_changed',
            'candidate_rejected',
            'candidate_hired',
            'note_added',
            'candidate_created',
            'candidate_deleted',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'from_stage', type: 'text' },
        { name: 'to_stage', type: 'text' },
        { name: 'reason', type: 'text' },
        { name: 'details', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_application ON audit_logs (application_id)',
        'CREATE INDEX idx_audit_candidate ON audit_logs (candidate_id)',
      ],
    })
    app.save(auditLogs)
  },
  (app) => {
    try {
      const auditLogs = app.findCollectionByNameOrId('audit_logs')
      app.delete(auditLogs)
    } catch (_) {}
    try {
      const applications = app.findCollectionByNameOrId('applications')
      app.delete(applications)
    } catch (_) {}
    try {
      const candidates = app.findCollectionByNameOrId('candidates')
      app.delete(candidates)
    } catch (_) {}
    try {
      const jobs = app.findCollectionByNameOrId('jobs')
      app.delete(jobs)
    } catch (_) {}
    try {
      const companies = app.findCollectionByNameOrId('companies')
      app.delete(companies)
    } catch (_) {}
  },
)
