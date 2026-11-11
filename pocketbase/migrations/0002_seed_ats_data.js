migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const companies = app.findCollectionByNameOrId('companies')
    const jobs = app.findCollectionByNameOrId('jobs')
    const candidates = app.findCollectionByNameOrId('candidates')
    const applications = app.findCollectionByNameOrId('applications')
    const auditLogs = app.findCollectionByNameOrId('audit_logs')

    // 1. Criar empresa cliente inicial
    let companyId = ''
    try {
      const existing = app.findFirstRecordByData('companies', 'name', 'Vanguard Soluções PME')
      companyId = existing.id
    } catch (_) {
      const company = new Record(companies)
      company.set('name', 'Vanguard Soluções PME')
      company.set('trade_name', 'Vanguard Tecnologia')
      company.set(
        'description',
        'Empresa brasileira de tecnologia especializada em soluções de gestão, inteligência de processos e automação para médias e pequenas empresas.',
      )
      company.set('website', 'https://vanguardtecnologia.com.br')
      company.set('city', 'São Paulo')
      company.set('state', 'SP')
      app.save(company)
      companyId = company.id
    }

    // 2. Criar usuários: Administrador (thomas.august1981@gmail.com), Recrutador e Gestor Solicitante
    let adminUser = null
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'thomas.august1981@gmail.com')
      adminUser.set('role', 'admin')
      adminUser.set('name', 'Thomas August (Admin)')
      adminUser.set('company_name', 'Vanguard Soluções PME')
      app.save(adminUser)
    } catch (_) {
      adminUser = new Record(users)
      adminUser.setEmail('thomas.august1981@gmail.com')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Thomas August (Admin)')
      adminUser.set('role', 'admin')
      adminUser.set('company_name', 'Vanguard Soluções PME')
      app.save(adminUser)
    }

    let recruiterUser = null
    try {
      recruiterUser = app.findAuthRecordByEmail('_pb_users_auth_', 'recrutamento@vanguard.com.br')
    } catch (_) {
      recruiterUser = new Record(users)
      recruiterUser.setEmail('recrutamento@vanguard.com.br')
      recruiterUser.setPassword('Skip@Pass')
      recruiterUser.setVerified(true)
      recruiterUser.set('name', 'Juliana Silveira (Recrutadora)')
      recruiterUser.set('role', 'recruiter')
      recruiterUser.set('company_name', 'Vanguard Soluções PME')
      app.save(recruiterUser)
    }

    let managerUser = null
    try {
      managerUser = app.findAuthRecordByEmail('_pb_users_auth_', 'gestor.ti@vanguard.com.br')
    } catch (_) {
      managerUser = new Record(users)
      managerUser.setEmail('gestor.ti@vanguard.com.br')
      managerUser.setPassword('Skip@Pass')
      managerUser.setVerified(true)
      managerUser.set('name', 'Carlos Mendes (Gestor TI)')
      managerUser.set('role', 'manager')
      managerUser.set('company_name', 'Vanguard Soluções PME')
      app.save(managerUser)
    }

    // 3. Vagas iniciais
    const defaultStages = JSON.stringify([
      { id: 'applied', label: 'Inscrição', color: '#64748b' },
      { id: 'screening', label: 'Triagem', color: '#3b82f6' },
      { id: 'interview_hr', label: 'Entrevista RH', color: '#8b5cf6' },
      { id: 'tech_interview', label: 'Entrevista Técnica', color: '#06b6d4' },
      { id: 'proposal', label: 'Proposta', color: '#f59e0b' },
      { id: 'hired', label: 'Contratado', color: '#10b981' },
      { id: 'rejected', label: 'Reprovado', color: '#ef4444' },
    ])

    let job1 = null
    try {
      job1 = app.findFirstRecordByData('jobs', 'slug', 'desenvolvedor-full-stack-pleno')
    } catch (_) {
      job1 = new Record(jobs)
      job1.set('title', 'Desenvolvedor Full Stack Pleno')
      job1.set('slug', 'desenvolvedor-full-stack-pleno')
      job1.set('department', 'Tecnologia & Produto')
      job1.set('location', 'São Paulo - SP (Híbrido)')
      job1.set('workplace_type', 'hybrid')
      job1.set('employment_type', 'clt')
      job1.set('seniority', 'mid')
      job1.set('salary_min', 7500)
      job1.set('salary_max', 9500)
      job1.set('salary_disclosed', true)
      job1.set('status', 'published')
      job1.set('stages', defaultStages)
      job1.set('manager_id', managerUser ? managerUser.id : adminUser.id)
      job1.set('created_by', adminUser.id)
      job1.set(
        'description',
        'Estamos buscando um Desenvolvedor Full Stack Pleno para atuar na evolução de nossa plataforma principal SaaS, construindo novas funcionalidades de backend e frontend com alta escalabilidade.',
      )
      job1.set(
        'requirements',
        '• Experiência comprovada com React, TypeScript e Node.js;\n• Domínio de bancos relacionais (PostgreSQL/SQLite) e APIs REST;\n• Prática com testes automatizados e Git flow;\n• Capacidade analítica para discutir arquitetura e regras de negócio com o gestor.',
      )
      job1.set(
        'benefits',
        '• Vale Refeição/Alimentação flexível de R$ 1.100/mês;\n• Plano de saúde Bradesco Top Nacional sem coparticipação;\n• Plano odontológico SulAmérica;\n• Auxílio Home Office de R$ 250/mês;\n• Seguro de vida em grupo e Gympass Platinum.',
      )
      app.save(job1)
    }

    let job2 = null
    try {
      job2 = app.findFirstRecordByData('jobs', 'slug', 'analista-de-sucesso-do-cliente')
    } catch (_) {
      job2 = new Record(jobs)
      job2.set('title', 'Analista de Sucesso do Cliente (CS)')
      job2.set('slug', 'analista-de-sucesso-do-cliente')
      job2.set('department', 'Operações & Atendimento')
      job2.set('location', 'Remoto (Brasil)')
      job2.set('workplace_type', 'remote')
      job2.set('employment_type', 'clt')
      job2.set('seniority', 'junior')
      job2.set('salary_min', 4200)
      job2.set('salary_max', 5300)
      job2.set('salary_disclosed', true)
      job2.set('status', 'published')
      job2.set('stages', defaultStages)
      job2.set('manager_id', adminUser.id)
      job2.set('created_by', recruiterUser ? recruiterUser.id : adminUser.id)
      job2.set(
        'description',
        'Buscamos um(a) profissional apaixonado(a) pelo cliente para acompanhar a jornada dos nossos clientes PME no pós-venda, garantindo alta retenção, engajamento e redução de churn.',
      )
      job2.set(
        'requirements',
        '• Experiência prévia em Customer Success ou Suporte em empresas SaaS/B2B;\n• Boa comunicação verbal e escrita;\n• Domínio de ferramentas de CRM e métricas de satisfação (NPS, CSAT, Churn);\n• Empatia e resolução ágil de dúvidas do cliente.',
      )
      job2.set(
        'benefits',
        '• Vale Refeição de R$ 900/mês;\n• Assistência médica e odontológica;\n• Verba anual para cursos e capacitação;\n• Auxílio creche para filhos até 5 anos.',
      )
      app.save(job2)
    }

    let job3 = null
    try {
      job3 = app.findFirstRecordByData('jobs', 'slug', 'coordenador-financeiro-e-controladoria')
    } catch (_) {
      job3 = new Record(jobs)
      job3.set('title', 'Coordenador Financeiro & Controladoria')
      job3.set('slug', 'coordenador-financeiro-e-controladoria')
      job3.set('department', 'Financeiro & Administrativo')
      job3.set('location', 'São Paulo - SP (Presencial)')
      job3.set('workplace_type', 'on_site')
      job3.set('employment_type', 'clt')
      job3.set('seniority', 'lead')
      job3.set('salary_min', 11000)
      job3.set('salary_max', 14000)
      job3.set('salary_disclosed', false)
      job3.set('status', 'published')
      job3.set('stages', defaultStages)
      job3.set('manager_id', adminUser.id)
      job3.set('created_by', adminUser.id)
      job3.set(
        'description',
        'Liderança de fechamento mensal, DRE, fluxo de caixa, relacionamento com bancos, auditoria e planejamento orçamentário para expansão da empresa.',
      )
      job3.set(
        'requirements',
        '• Ensino superior completo em Ciências Contábeis, Economia ou Administração;\n• Experiência em liderança financeira de empresas de serviços ou tech;\n• Domínio avançado de Excel, ERPs e regimes tributários (Lucro Real e Presumido).',
      )
      job3.set(
        'benefits',
        '• Pacote executivo com PLR atrelada a metas corporativas;\n• Estacionamento no local e VR Executivo;\n• Plano de saúde premium.',
      )
      app.save(job3)
    }

    // 4. Candidatos de exemplo
    const candidate1Data = {
      name: 'Beatriz Oliveira Costa',
      email: 'beatriz.oliveira@exemplo.com.br',
      phone: '(11) 98765-4321',
      cpf: '123.456.789-00',
      linkedin: 'https://linkedin.com/in/beatriz-oliveira-dev',
      location: 'São Paulo, SP',
      seniority: 'mid',
      skills: 'React, TypeScript, Node.js, PostgreSQL, Docker, Tailwind CSS, Jest',
      availability: 'immediate',
      lgpd_consent: true,
      lgpd_consent_date: '2025-02-15 10:30:00.000Z',
      lgpd_consent_version: 'LGPD-v1.0-2025',
      notes:
        'Perfil muito sólido em front-end com boa bagagem em backend. Disponibilidade imediata.',
    }

    let cand1 = null
    try {
      cand1 = app.findFirstRecordByData('candidates', 'email', candidate1Data.email)
    } catch (_) {
      cand1 = new Record(candidates)
      for (const [k, v] of Object.entries(candidate1Data)) {
        cand1.set(k, v)
      }
      app.save(cand1)
    }

    const candidate2Data = {
      name: 'Lucas Ramos Albuquerque',
      email: 'lucas.ramos@exemplo.com.br',
      phone: '(21) 99123-8877',
      cpf: '234.567.890-11',
      linkedin: 'https://linkedin.com/in/lucas-ramos-cs',
      location: 'Rio de Janeiro, RJ',
      seniority: 'junior',
      skills: 'Customer Success, CRM HubSpot, Zendesk, Onboarding, Resolução de Conflitos, Inglês',
      availability: 'two_weeks',
      lgpd_consent: true,
      lgpd_consent_date: '2025-02-18 14:15:00.000Z',
      lgpd_consent_version: 'LGPD-v1.0-2025',
      notes:
        'Ótima comunicação, experiência anterior de 1 ano e meio com suporte e sucesso do cliente em startup.',
    }

    let cand2 = null
    try {
      cand2 = app.findFirstRecordByData('candidates', 'email', candidate2Data.email)
    } catch (_) {
      cand2 = new Record(candidates)
      for (const [k, v] of Object.entries(candidate2Data)) {
        cand2.set(k, v)
      }
      app.save(cand2)
    }

    const candidate3Data = {
      name: 'Mariana Vasconcelos',
      email: 'mariana.vasconcelos@exemplo.com.br',
      phone: '(31) 98456-1234',
      cpf: '345.678.901-22',
      linkedin: 'https://linkedin.com/in/mariana-vasconcelos-fin',
      location: 'Belo Horizonte, MG',
      seniority: 'lead',
      skills:
        'DRE, Fluxo de Caixa, Planejamento Orçamentário, ERP Totvs, Excel Avançado, Lucro Real',
      availability: 'one_month',
      lgpd_consent: true,
      lgpd_consent_date: '2025-02-10 09:00:00.000Z',
      lgpd_consent_version: 'LGPD-v1.0-2025',
      notes: 'Perfil sênior com vasta experiência em gestão e auditoria externa Big 4.',
    }

    let cand3 = null
    try {
      cand3 = app.findFirstRecordByData('candidates', 'email', candidate3Data.email)
    } catch (_) {
      cand3 = new Record(candidates)
      for (const [k, v] of Object.entries(candidate3Data)) {
        cand3.set(k, v)
      }
      app.save(cand3)
    }

    // 5. Candidaturas e logs de auditoria
    if (job1 && cand1) {
      let app1 = null
      try {
        app1 = app.findFirstRecordByFilter(
          'applications',
          `candidate_id = '${cand1.id}' && job_id = '${job1.id}'`,
        )
      } catch (_) {
        app1 = new Record(applications)
        app1.set('candidate_id', cand1.id)
        app1.set('job_id', job1.id)
        app1.set('stage_id', 'tech_interview')
        app1.set('status', 'active')
        app1.set('source', 'google_for_jobs')
        app1.set('stage_updated_at', '2025-02-18 16:00:00.000Z')
        app.save(app1)

        // Audit logs
        const log1 = new Record(auditLogs)
        log1.set('application_id', app1.id)
        log1.set('candidate_id', cand1.id)
        log1.set('user_id', recruiterUser ? recruiterUser.id : adminUser.id)
        log1.set('user_name', recruiterUser ? recruiterUser.getString('name') : 'Admin')
        log1.set('user_role', 'recruiter')
        log1.set('action', 'viewed_resume')
        log1.set(
          'details',
          'Currículo em PDF e perfil profissional visualizados na triagem inicial.',
        )
        app.save(log1)

        const log2 = new Record(auditLogs)
        log2.set('application_id', app1.id)
        log2.set('candidate_id', cand1.id)
        log2.set('user_id', managerUser ? managerUser.id : adminUser.id)
        log2.set('user_name', managerUser ? managerUser.getString('name') : 'Carlos Mendes')
        log2.set('user_role', 'manager')
        log2.set('action', 'stage_changed')
        log2.set('from_stage', 'interview_hr')
        log2.set('to_stage', 'tech_interview')
        log2.set(
          'reason',
          'Aprovada na conversa de cultura e alinhamento do RH. Avançando para teste prático de arquitetura.',
        )
        app.save(log2)
      }
    }

    if (job2 && cand2) {
      let app2 = null
      try {
        app2 = app.findFirstRecordByFilter(
          'applications',
          `candidate_id = '${cand2.id}' && job_id = '${job2.id}'`,
        )
      } catch (_) {
        app2 = new Record(applications)
        app2.set('candidate_id', cand2.id)
        app2.set('job_id', job2.id)
        app2.set('stage_id', 'screening')
        app2.set('status', 'active')
        app2.set('source', 'whatsapp')
        app2.set('stage_updated_at', '2025-02-19 11:20:00.000Z')
        app.save(app2)

        const log = new Record(auditLogs)
        log.set('application_id', app2.id)
        log.set('candidate_id', cand2.id)
        log.set('user_id', recruiterUser ? recruiterUser.id : adminUser.id)
        log.set('user_name', recruiterUser ? recruiterUser.getString('name') : 'Juliana Silveira')
        log.set('user_role', 'recruiter')
        log.set('action', 'stage_changed')
        log.set('from_stage', 'applied')
        log.set('to_stage', 'screening')
        log.set(
          'reason',
          'Candidatura recebida via WhatsApp institucional; triagem preliminar dos requisitos.',
        )
        app.save(log)
      }
    }

    if (job3 && cand3) {
      let app3 = null
      try {
        app3 = app.findFirstRecordByFilter(
          'applications',
          `candidate_id = '${cand3.id}' && job_id = '${job3.id}'`,
        )
      } catch (_) {
        app3 = new Record(applications)
        app3.set('candidate_id', cand3.id)
        app3.set('job_id', job3.id)
        app3.set('stage_id', 'proposal')
        app3.set('status', 'active')
        app3.set('source', 'referral')
        app3.set('stage_updated_at', '2025-02-17 18:00:00.000Z')
        app.save(app3)

        const log = new Record(auditLogs)
        log.set('application_id', app3.id)
        log.set('candidate_id', cand3.id)
        log.set('user_id', adminUser.id)
        log.set('user_name', adminUser.getString('name'))
        log.set('user_role', 'admin')
        log.set('action', 'stage_changed')
        log.set('from_stage', 'interview_hr')
        log.set('to_stage', 'proposal')
        log.set(
          'reason',
          'Excelente alinhamento estratégico com a diretoria; proposta salarial formulada.',
        )
        app.save(log)
      }
    }
  },
  (app) => {
    // rollback opcional
  },
)
