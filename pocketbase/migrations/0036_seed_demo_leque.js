//
// Migração 0036 — SEED DE DEMONSTRAÇÃO em leque (pedido do usuário para a
// versão de teste: "criar todo um leque de dados fictícios em todas as abas").
//
// Idempotente por design: cada bloco SÓ grava quando a condição de existência
// falha (findFirst... por chave natural — slug/email/node_key/combinação).
// Rodar 2x não duplica nada; em banco já populado é no-op.
//
// Popula: organization + usuários (admin/recrutador/gestor, senha Skip@Pass),
// organograma vigente (2 níveis, posições em RASCUNHO/EM_APROVACAO/APROVADA),
// cargos CHA completos (conhecimentos/habilidades/atitudes, pesos 1-5,
// finalidades e status variados), ~9 vagas (opened_at espalhados em 120 dias),
// ~36 candidatas distribuídas no funil com origens variadas, audit_logs com
// as transições (base dos indicadores de conversão), DISC results e fichas CHA.
//
migrate(
  (app) => {
    var now = new Date()
    function daysAgo(n, h, m) {
      var d = new Date(now.getTime() - n * 86400000)
      d.setUTCHours(h || 12, m || 0, 0, 0)
      return d.toISOString().replace('T', ' ').replace('Z', '000Z') // 'YYYY-MM-DD HH:mm:ss.SSSZ'
    }
    function isoDate(n) {
      return new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10)
    }

    function findOne(col, filter) {
      try {
        return app.findFirstRecordByFilter(col, filter)
      } catch (_) {
        return null
      }
    }
    function exists(col, filter) {
      return findOne(col, filter) !== null
    }
    function put(colName, col, data, dateFields) {
      var rec = new Record(col)
      for (var k in data) {
        if (data[k] !== undefined && data[k] !== null) rec.set(k, data[k])
      }
      app.save(rec)
      return rec
    }

    // ------------------------------------------------ 1. organização
    var org = findOne('organizations', "slug = 'vanguard-demo'")
    if (!org) {
      org = put('organizations', app.findCollectionByNameOrId('organizations'), {
        name: 'Vanguard Soluções PME',
        slug: 'vanguard-demo',
        is_active: true,
      })
    }

    // ------------------------------------------------ 2. usuários (3 papéis)
    var users = app.findCollectionByNameOrId('_pb_users_auth_')
    function ensureUser(email, name, role) {
      var u = null
      try {
        u = app.findAuthRecordByEmail('_pb_users_auth_', email)
      } catch (_) {
        u = null
      }
      if (!u) {
        u = new Record(users)
        u.setEmail(email)
        u.setPassword('Skip@Pass')
        u.setVerified(true)
        u.set('name', name)
        u.set('role', role)
        u.set('org_id', org.id)
        u.set('company_name', 'Vanguard Soluções PME')
        app.save(u)
      }
      return u
    }
    var admin = ensureUser('admin@vanguard.com.br', 'Thomas August (Admin)', 'admin')
    var recruiter = ensureUser(
      'recrutador@vanguard.com.br',
      'Juliana Silveira (Recrutadora)',
      'recruiter',
    )
    var manager = ensureUser('gestor@vanguard.com.br', 'Carlos Mendes (Gestor de TI)', 'manager')

    // ------------------------------------------------ 3. organograma vigente
    // versão APROVADA vigente (período atual) + uma EM_APROVACAO para o ciclo
    var verId = ''
    var ver = findOne('org_versions', "org_id = '" + org.id + "' && status = 'APROVADA'")
    if (!ver) {
      ver = put('org_versions', app.findCollectionByNameOrId('org_versions'), {
        org_id: org.id,
        version_number: 1,
        label: 'v1.0 — Demo',
        status: 'APROVADA',
        vigencia_inicio: isoDate(120),
        published_at: isoDate(120),
        approved_by: admin ? admin.id : '',
        approved_by_role: 'admin',
        created_by: admin ? admin.id : '',
        created_by_role: 'admin',
      })
    }
    verId = ver.id
    var verDraft = findOne('org_versions', "org_id = '" + org.id + "' && status = 'EM_APROVACAO'")
    if (!verDraft) {
      put('org_versions', app.findCollectionByNameOrId('org_versions'), {
        org_id: org.id,
        version_number: 2,
        label: 'v1.1 — Proposta (demo)',
        status: 'EM_APROVACAO',
        submitted_by: manager ? manager.getString('name') : '',
        submitted_at: daysAgo(5, 15),
        next_approver_role: 'admin',
        created_by: manager ? manager.id : '',
        created_by_role: 'manager',
      })
    }

    function ensureNode(nodeKey, data) {
      var n = findOne('org_nodes', "node_key = '" + nodeKey + "'")
      if (n) return n
      return put('org_nodes', app.findCollectionByNameOrId('org_nodes'), data)
    }
    var ceo = ensureNode('demo-ceo', {
      node_key: 'demo-ceo',
      name: 'Helena Duarte',
      role_title: 'CEO',
      area: 'Diretoria',
      manager: '',
      email: 'helena.duarte@vanguard.com.br',
      location: 'São Paulo, SP',
      contract_type: 'clt',
      status: 'ativo',
      company: 'Vanguard Soluções PME',
    })
    ensureNode('demo-dir-com', {
      node_key: 'demo-dir-com',
      name: 'Rafael Nogueira',
      role_title: 'Diretor Comercial',
      area: 'Comercial',
      manager: 'demo-ceo',
      email: 'rafael.nogueira@vanguard.com.br',
      location: 'São Paulo, SP',
      contract_type: 'clt',
      status: 'ativo',
      company: 'Vanguard Soluções PME',
    })
    ensureNode('demo-dir-ops', {
      node_key: 'demo-dir-ops',
      name: 'Patrícia Lemos',
      role_title: 'Diretora de Operações',
      area: 'Operações',
      manager: 'demo-ceo',
      email: 'patricia.lemos@vanguard.com.br',
      location: 'São Paulo, SP',
      contract_type: 'clt',
      status: 'ativo',
      company: 'Vanguard Soluções PME',
    })
    ensureNode('demo-dir-rh', {
      node_key: 'demo-dir-rh',
      name: 'Camila Ferraz',
      role_title: 'Gerente de RH',
      area: 'RH',
      manager: 'demo-ceo',
      email: 'camila.ferraz@vanguard.com.br',
      location: 'São Paulo, SP',
      contract_type: 'clt',
      status: 'ativo',
      company: 'Vanguard Soluções PME',
    })
    ensureNode('demo-dir-ti', {
      node_key: 'demo-dir-ti',
      name: 'Carlos Mendes',
      role_title: 'Gerente de Tecnologia',
      area: 'Tecnologia',
      manager: 'demo-ceo',
      email: 'carlos.mendes@vanguard.com.br',
      location: 'São Paulo, SP',
      contract_type: 'clt',
      status: 'ativo',
      company: 'Vanguard Soluções PME',
    })
    ensureNode('demo-dir-fin', {
      node_key: 'demo-dir-fin',
      name: 'Beatriz Vasques',
      role_title: 'Gerente Financeiro',
      area: 'Financeiro',
      manager: 'demo-ceo',
      email: 'beatriz.vasques@vanguard.com.br',
      location: 'São Paulo, SP',
      contract_type: 'clt',
      status: 'ativo',
      company: 'Vanguard Soluções PME',
    })
    // Nível 2: posições com estados variados (ciclo de aprovação)
    ensureNode('demo-pos-vendas1', {
      node_key: 'demo-pos-vendas1',
      name: 'Joana Prado',
      role_title: 'Executiva de Contas',
      area: 'Comercial',
      manager: 'demo-dir-com',
      email: 'joana.prado@vanguard.com.br',
      contract_type: 'clt',
      status: 'ativo',
      company: 'Vanguard Soluções PME',
      cost_center: 'CC-1001',
      position_type: 'efetivo',
      is_new_position: false,
    })
    ensureNode('demo-pos-vendas2', {
      node_key: 'demo-pos-vendas2',
      name: 'Vaga aberta — Executivo de Contas',
      role_title: 'Executivo de Contas Pleno',
      area: 'Comercial',
      manager: 'demo-dir-com',
      contract_type: 'clt',
      status: 'vaga_aberta',
      company: 'Vanguard Soluções PME',
      cost_center: 'CC-1002',
      position_type: 'efetivo',
      is_new_position: true,
    })
    ensureNode('demo-pos-suporte1', {
      node_key: 'demo-pos-suporte1',
      name: 'Diego Martins',
      role_title: 'Analista de Suporte',
      area: 'Operações',
      manager: 'demo-dir-ops',
      email: 'diego.martins@vanguard.com.br',
      contract_type: 'clt',
      status: 'ativo',
      company: 'Vanguard Soluções PME',
      cost_center: 'CC-2001',
      position_type: 'efetivo',
      is_new_position: false,
    })
    ensureNode('demo-pos-cs2', {
      node_key: 'demo-pos-cs2',
      name: 'Vaga aberta — Analista de CS',
      role_title: 'Analista de Customer Success',
      area: 'Operações',
      manager: 'demo-dir-ops',
      contract_type: 'clt',
      status: 'vaga_aberta',
      company: 'Vanguard Soluções PME',
      cost_center: 'CC-2002',
      position_type: 'efetivo',
      is_new_position: true,
    })
    ensureNode('demo-pos-estagio', {
      node_key: 'demo-pos-estagio',
      name: 'Ana Beatriz Souza',
      role_title: 'Estagiária de RH',
      area: 'RH',
      manager: 'demo-dir-rh',
      email: 'ana.souza@vanguard.com.br',
      contract_type: 'internship',
      status: 'ativo',
      company: 'Vanguard Soluções PME',
      cost_center: 'CC-3001',
      position_type: 'efetivo',
      is_new_position: false,
    })
    // posição EM_APROVACAO (rascunho do ciclo de aprovação)
    ensureNode('demo-pos-dev3', {
      node_key: 'demo-pos-dev3',
      name: 'Vaga aberta — Desenvolvedor(a) Mobile',
      role_title: 'Desenvolvedor(a) Mobile',
      area: 'Tecnologia',
      manager: 'demo-dir-ti',
      contract_type: 'clt',
      status: 'vaga_aberta',
      company: 'Vanguard Soluções PME',
      cost_center: 'CC-4003',
      position_type: 'efetivo',
      is_new_position: true,
    })
    ensureNode('demo-pos-dev1', {
      node_key: 'demo-pos-dev1',
      name: 'Fernanda Aoki',
      role_title: 'Dev Sênior',
      area: 'Tecnologia',
      manager: 'demo-dir-ti',
      email: 'fernanda.aoki@vanguard.com.br',
      contract_type: 'clt',
      status: 'ativo',
      company: 'Vanguard Soluções PME',
      cost_center: 'CC-4001',
      position_type: 'efetivo',
      is_new_position: false,
    })
    ensureNode('demo-pos-dev2', {
      node_key: 'demo-pos-dev2',
      name: 'Pedro Henrique Salles',
      role_title: 'Dev Pleno',
      area: 'Tecnologia',
      manager: 'demo-dir-ti',
      email: 'pedro.salles@vanguard.com.br',
      contract_type: 'clt',
      status: 'ativo',
      company: 'Vanguard Soluções PME',
      cost_center: 'CC-4002',
      position_type: 'efetivo',
      is_new_position: false,
    })
    ensureNode('demo-pos-fin1', {
      node_key: 'demo-pos-fin1',
      name: 'Roberta Campos',
      role_title: 'Analista Financeiro',
      area: 'Financeiro',
      manager: 'demo-dir-fin',
      email: 'roberta.campos@vanguard.com.br',
      contract_type: 'clt',
      status: 'ativo',
      company: 'Vanguard Soluções PME',
      cost_center: 'CC-5001',
      position_type: 'efetivo',
      is_new_position: false,
    })
    // posição rascunho (nova, ainda sem aprovação)
    ensureNode('demo-pos-fin2', {
      node_key: 'demo-pos-fin2',
      name: 'Vaga aberta — Analista de Custos',
      role_title: 'Analista de Custos Jr.',
      area: 'Financeiro',
      manager: 'demo-dir-fin',
      contract_type: 'clt',
      status: 'vaga_aberta',
      company: 'Vanguard Soluções PME',
      cost_center: 'CC-5002',
      position_type: 'temporario',
      is_new_position: true,
    })

    // ------------------------------------------------ 4. cargos CHA completos
    function chaData(items) {
      return JSON.stringify({
        conhecimentos: { items: items.k },
        habilidades: { items: items.h },
        atitudes: { items: items.a },
      })
    }
    function item(id, desc, req, w) {
      return { id: 'cha_' + id, description: desc, required: req, weight: w }
    }

    var cargosCol = app.findCollectionByNameOrId('cargos')
    function ensureCargo(key, data) {
      var c = findOne('cargos', "title = '" + data.title + "' && org_id = '" + org.id + "'")
      if (c) return c
      return put('cargos', cargosCol, data)
    }

    var cargoDev = ensureCargo('dev', {
      org_id: org.id,
      title: 'Desenvolvedor(a) Full Stack',
      area: 'Tecnologia',
      level: 'pleno',
      mission:
        'Construir e evoluir a plataforma SaaS da Vanguard, garantindo qualidade, performance e experiências que resolvem problemas reais de PMEs brasileiras.',
      salary_min: 7000,
      salary_med: 8500,
      salary_max: 10500,
      salary_defined: true,
      purpose: 'PREENCHIMENTO',
      status: 'APROVADO',
      created_by: admin ? admin.id : '',
      created_by_role: 'admin',
      approved_by: admin ? admin.id : '',
      approved_by_role: 'admin',
      approved_at: daysAgo(110, 10),
      submitted_at: daysAgo(112, 10),
      cha: chaData({
        k: [
          item('k1', 'TypeScript e React em produção', true, 5),
          item('k2', 'Node.js e APIs REST', true, 5),
          item('k3', 'PostgreSQL e modelagem relacional', true, 4),
          item('k4', 'Docker e pipelines CI/CD', false, 3),
          item('k5', 'Inglês técnico de leitura', false, 2),
        ],
        h: [
          item('h1', 'Construir telas completas com autonomia', true, 5),
          item('h2', 'Depurar bugs de produção com logs distribuídos', true, 4),
          item('h3', 'Escrever testes automatizados estáveis', true, 3),
        ],
        a: [
          item('a1', 'Reporta riscos de prazo antecipadamente, sem supervisão', true, 4),
          item('a2', 'Documenta decisões técnicas nos PRs', true, 3),
          item('a3', 'Mentora colegas juniores nas revisões de código', false, 2),
        ],
      }),
    })
    var cargoCS = ensureCargo('cs', {
      org_id: org.id,
      title: 'Analista de Customer Success',
      area: 'Operações',
      level: 'junior',
      mission:
        'Acompanhar a jornada dos clientes PME no pós-venda, garantindo adoção da plataforma, retenção e expansão de carteira.',
      salary_min: 3800,
      salary_med: 4600,
      salary_max: 5600,
      salary_defined: true,
      purpose: 'PREENCHIMENTO',
      status: 'APROVADO',
      created_by: admin ? admin.id : '',
      created_by_role: 'admin',
      approved_by: admin ? admin.id : '',
      approved_by_role: 'admin',
      approved_at: daysAgo(100, 14),
      submitted_at: daysAgo(102, 14),
      cha: chaData({
        k: [
          item('k1', 'CRM (HubSpot ou similar)', true, 4),
          item('k2', 'Métricas de CS: NPS, CSAT, churn', true, 4),
          item('k3', 'Excel intermediário', false, 2),
        ],
        h: [
          item('h1', 'Conduzir reuniões de acompanhamento com clientes', true, 5),
          item('h2', 'Detectar sinais de churn e agir sobre eles', true, 4),
          item('h3', 'Negociar renovações simples sem escalada', false, 3),
        ],
        a: [
          item('a1', 'Responde cliente no mesmo dia, mesmo sem solução definitiva', true, 5),
          item('a2', 'Registra cada interação no CRM sem ser lembrado', true, 3),
        ],
      }),
    })
    var cargoVendas = ensureCargo('vendas', {
      org_id: org.id,
      title: 'Executivo(a) de Vendas SaaS',
      area: 'Comercial',
      level: 'pleno',
      mission:
        'Prospectar e fechar novas contas PME, conduzindo o ciclo comercial do primeiro contato à assinatura.',
      salary_min: 5000,
      salary_med: 6500,
      salary_max: 9000,
      salary_defined: true,
      purpose: 'ESTRUTURAL',
      status: 'APROVADO',
      created_by: admin ? admin.id : '',
      approved_by: admin ? admin.id : '',
      approved_at: daysAgo(95, 9),
      cha: chaData({
        k: [
          item('k1', 'Venda B2B de software', true, 5),
          item('k2', 'Funil CRM e forecast', true, 3),
        ],
        h: [
          item('h1', 'Conduzir demo de produto ao vivo', true, 5),
          item('h2', 'Fechar ciclo em 30-60 dias', true, 4),
        ],
        a: [
          item('a1', 'Segue o processo comercial registrado no CRM', true, 4),
          item('a2', 'Trata objeção com escuta e proposta', true, 3),
        ],
      }),
    })
    var cargoFin = ensureCargo('fin', {
      org_id: org.id,
      title: 'Analista Financeiro',
      area: 'Financeiro',
      level: 'pleno',
      mission:
        'Executar fechamento mensal, contas a pagar/receber e apoiar o orçamento da operação.',
      salary_min: 4500,
      salary_med: 5500,
      salary_max: 6800,
      salary_defined: true,
      purpose: 'PREENCHIMENTO',
      status: 'EM_APROVACAO',
      created_by: manager ? manager.id : '',
      created_by_role: 'manager',
      submitted_at: daysAgo(8, 11),
      cha: chaData({
        k: [
          item('k1', 'Fechamento contábil mensal', true, 5),
          item('k2', 'ERP Totvs ou similar', true, 4),
        ],
        h: [
          item('h1', 'Conciliar contas em volume alto sem erro', true, 5),
          item('h2', 'Montar DRE gerencial', true, 4),
        ],
        a: [
          item('a1', 'Confere lançamentos antes de fechar o mês', true, 4),
          item('a2', 'Escala divergência ao gestor com dados prontos', true, 3),
        ],
      }),
    })
    var cargoRH = ensureCargo('rh', {
      org_id: org.id,
      title: 'Analista de RH Generalista',
      area: 'RH',
      level: 'pleno',
      mission: 'Cuidar do ciclo completo: recrutamento, admissão, desenvolvimento e desligamento.',
      salary_min: 4200,
      salary_med: 5200,
      salary_max: 6300,
      salary_defined: true,
      purpose: 'SUCCESSAO',
      status: 'RASCUNHO',
      created_by: admin ? admin.id : '',
      created_by_role: 'admin',
      cha: chaData({
        k: [
          item('k1', 'Rotinas de DP e eSocial', true, 4),
          item('k2', 'Leis trabalhistas vigentes', true, 3),
        ],
        h: [
          item('h1', 'Conduz entrevistas por competência', true, 5),
          item('h2', 'Fechar posição em SLA curto', true, 4),
        ],
        a: [item('a1', 'Mantém candidatos informados em cada etapa', true, 5)],
      }),
    })
    var cargoMobile = ensureCargo('mobile', {
      org_id: org.id,
      title: 'Desenvolvedor(a) Mobile',
      area: 'Tecnologia',
      level: 'pleno',
      mission: 'Evoluir o app companion da plataforma (React Native) usado por gestores em campo.',
      salary_min: 7500,
      salary_med: 9000,
      salary_max: 11000,
      salary_defined: true,
      purpose: 'ESTRUTURAL',
      status: 'APROVADO',
      created_by: admin ? admin.id : '',
      approved_by: admin ? admin.id : '',
      approved_at: daysAgo(60, 15),
      cha: chaData({
        k: [
          item('k1', 'React Native e Expo', true, 5),
          item('k2', 'Publicação nas stores', true, 4),
        ],
        h: [item('h1', 'Entregar feature mobile ponta a ponta', true, 5)],
        a: [item('a2', 'Testa em dispositivo real antes de abrir PR', true, 4)],
      }),
    })

    // ciclo de aprovação do cargo financeiro (trilha cargo_approvals)
    if (cargoFin && !exists('cargo_approvals', "cargo_id = '" + cargoFin.id + "'")) {
      var approvalsCol = app.findCollectionByNameOrId('cargo_approvals')
      put('cargo_approvals', approvalsCol, {
        cargo_id: cargoFin.id,
        cargo_title: cargoFin.getString('title'),
        step: 'ENVIO',
        decision: '—',
        from_status: 'RASCUNHO',
        to_status: 'EM_APROVACAO',
        comment: 'Enviado para aprovação da diretoria.',
        user_name: manager ? manager.getString('name') : 'Carlos Mendes',
        user_role: 'manager',
        user_id: manager ? manager.id : '',
        org_id: org.id,
      })
    }

    // ------------------------------------------------ 5. vagas (~9, opened_at 120d)
    var jobsCol = app.findCollectionByNameOrId('jobs')
    var DEFAULT_STAGES = JSON.stringify([
      { id: 'applied', label: 'Inscrição', color: '#64748b' },
      { id: 'screening', label: 'Triagem', color: '#3b82f6' },
      { id: 'interview_hr', label: 'Entrevista RH', color: '#8b5cf6' },
      { id: 'tech_interview', label: 'Entrevista Técnica', color: '#06b6d4' },
      { id: 'proposal', label: 'Proposta', color: '#f59e0b' },
      { id: 'hired', label: 'Contratado', color: '#10b981' },
      { id: 'rejected', label: 'Reprovado', color: '#ef4444' },
    ])
    function ensureJob(slug, data, cha) {
      var j = findOne('jobs', "slug = '" + slug + "'")
      if (j) return j
      var payload = {
        title: data.title,
        slug: slug,
        org_id: org.id,
        company_id: org.id,
        department: data.department,
        location: data.location,
        workplace_type: data.workplace_type || 'hybrid',
        employment_type: 'clt',
        seniority: data.seniority,
        salary_min: data.salary_min,
        salary_max: data.salary_max,
        salary_disclosed: true,
        status: data.status || 'published',
        stages: DEFAULT_STAGES,
        manager_id: manager ? manager.id : admin.id,
        created_by: admin.id,
        description: data.description,
        requirements: data.requirements,
        benefits: data.benefits,
        opened_at: data.opened_at,
      }
      if (data.cargo_id) payload.cargo_id = data.cargo_id
      if (cha)
        payload.cha_requirements = JSON.stringify({
          cargo: cha,
          specific: {
            conhecimentos: { items: [] },
            habilidades: { items: [] },
            atitudes: { items: [] },
          },
        })
      var j2 = put('jobs', jobsCol, payload)
      return j2
    }
    function parseCha(data) {
      return typeof data === 'string' ? data : data
    }

    var jobDev = ensureJob(
      'demo-dev-fullstack',
      {
        title: 'Desenvolvedor(a) Full Stack Pleno',
        department: 'Tecnologia',
        location: 'São Paulo - SP (Híbrido)',
        seniority: 'mid',
        salary_min: 7500,
        salary_max: 9500,
        status: 'published',
        opened_at: daysAgo(110, 9),
        cargo_id: cargoDev ? cargoDev.id : '',
        description:
          'Atuar na evolução da plataforma SaaS da Vanguard, construindo funcionalidades de backend e frontend com escalabilidade e qualidade.',
        requirements:
          '• React, TypeScript e Node.js em produção;\n• Banco relacional e APIs REST;\n• Testes automatizados e Git flow.',
        benefits:
          '• VR/VA R$ 1.100/mês;\n• Plano de saúde sem coparticipação;\n• Auxílio home office R$ 250/mês.',
      },
      cargoDev ? cargoDev.getString('cha') : null,
    )
    var jobCS = ensureJob(
      'demo-analista-cs',
      {
        title: 'Analista de Sucesso do Cliente',
        department: 'Operações',
        location: 'Remoto (Brasil)',
        workplace_type: 'remote',
        seniority: 'junior',
        salary_min: 4200,
        salary_max: 5300,
        status: 'published',
        opened_at: daysAgo(85, 14),
        cargo_id: cargoCS ? cargoCS.id : '',
        description:
          'Acompanhar a jornada dos clientes PME no pós-venda, garantindo retenção e redução de churn.',
        requirements:
          '• Experiência em CS/suporte B2B;\n• CRM e métricas de satisfação;\n• Ótima comunicação.',
        benefits:
          '• VR R$ 900/mês;\n• Assistência médica e odontológica;\n• Verba anual de capacitação.',
      },
      cargoCS ? cargoCS.getString('cha') : null,
    )
    var jobVendas = ensureJob(
      'demo-executivo-vendas',
      {
        title: 'Executivo(a) de Vendas SaaS',
        department: 'Comercial',
        location: 'São Paulo - SP (Híbrido)',
        seniority: 'mid',
        salary_min: 6000,
        salary_max: 8500,
        status: 'published',
        opened_at: daysAgo(70, 10),
        cargo_id: cargoVendas ? cargoVendas.id : '',
        description: 'Prospectar e fechar novas contas PME, conduzindo o ciclo comercial completo.',
        requirements: '• Venda B2B de software;\n• Condução de demo ao vivo;\n• CRM e forecast.',
        benefits: '• Comissão variada agressiva;\n• VR e assistência médica.',
      },
      cargoVendas ? cargoVendas.getString('cha') : null,
    )
    var jobFin = ensureJob(
      'demo-analista-financeiro',
      {
        title: 'Analista Financeiro',
        department: 'Financeiro',
        location: 'São Paulo - SP (Presencial)',
        workplace_type: 'on_site',
        seniority: 'mid',
        salary_min: 4800,
        salary_max: 6200,
        status: 'published',
        opened_at: daysAgo(55, 11),
        cargo_id: cargoFin ? cargoFin.id : '',
        description: 'Fechamento mensal, contas a pagar/receber e apoio ao orçamento.',
        requirements: '• Fechamento contábil;\n• ERP Totvs;\n• Excel avançado.',
        benefits: '• VR executivo;\n• Estacionamento.',
      },
      cargoFin ? cargoFin.getString('cha') : null,
    )
    var jobRH = ensureJob(
      'demo-analista-rh',
      {
        title: 'Analista de RH Generalista',
        department: 'RH',
        location: 'São Paulo - SP (Híbrido)',
        seniority: 'mid',
        salary_min: 4500,
        salary_max: 5800,
        status: 'published',
        opened_at: daysAgo(40, 16),
        cargo_id: cargoRH ? cargoRH.id : '',
        description:
          'Ciclo completo de RH: recrutamento, admissão, desenvolvimento e desligamento.',
        requirements: '• DP e eSocial;\n• Entrevistas por competência.',
        benefits: '• VR;\n• Plano de saúde.',
      },
      cargoRH ? cargoRH.getString('cha') : null,
    )
    var jobMobile = ensureJob(
      'demo-dev-mobile',
      {
        title: 'Desenvolvedor(a) Mobile Pleno',
        department: 'Tecnologia',
        location: 'Remoto (Brasil)',
        workplace_type: 'remote',
        seniority: 'mid',
        salary_min: 8000,
        salary_max: 10500,
        status: 'published',
        opened_at: daysAgo(30, 13),
        cargo_id: cargoMobile ? cargoMobile.id : '',
        description: 'Evoluir o app companion (React Native) usado por gestores em campo.',
        requirements: '• React Native/Expo;\n• Publicação nas stores.',
        benefits: '• Auxílio home office;\n• Plano de saúde.',
      },
      cargoMobile ? cargoMobile.getString('cha') : null,
    )
    var jobEstagio = ensureJob('demo-estagio-rh', {
      title: 'Estagiário(a) de RH',
      department: 'RH',
      location: 'São Paulo - SP (Presencial)',
      workplace_type: 'on_site',
      seniority: 'junior',
      salary_min: 1600,
      salary_max: 2000,
      status: 'published',
      opened_at: daysAgo(20, 10),
      description: 'Apoio nas rotinas de recrutamento, seleção e treinamento.',
      requirements: '• Cursando psicologia, administração ou áreas afins.',
      benefits: '• VT;\n• Seguro de vida.',
    })
    var jobSuporte = ensureJob('demo-analista-suporte', {
      title: 'Analista de Suporte Técnico',
      department: 'Operações',
      location: 'São Paulo - SP (Presencial)',
      workplace_type: 'on_site',
      seniority: 'junior',
      salary_min: 2800,
      salary_max: 3500,
      status: 'published',
      opened_at: daysAgo(15, 9),
      description:
        'Atendimento a clientes via ticket e telefone, com registro e encaminhamento corretos.',
      requirements: '• Boa comunicação;\n• Noções de SQL e ferramentas de ticket.',
      benefits: '• VR;\n• Plano odontológico.',
    })
    var jobCoord = ensureJob('demo-coordenador-financeiro', {
      title: 'Coordenador Financeiro & Controladoria',
      department: 'Financeiro',
      location: 'São Paulo - SP (Presencial)',
      workplace_type: 'on_site',
      seniority: 'lead',
      salary_min: 11000,
      salary_max: 14000,
      status: 'closed',
      opened_at: daysAgo(118, 10),
      description: 'Liderar fechamento mensal, DRE, fluxo de caixa e auditoria externa.',
      requirements:
        '• Contábeis com liderança;\n• Excel avançado e ERPs;\n• Lucro Real e Presumido.',
      benefits: '• PLR;\n• Estacionamento;\n• Plano premium.',
    })

    // ------------------------------------------------ 6. candidatas + logs + DISC + CHA evals
    var candidatesCol = app.findCollectionByNameOrId('candidates')
    var applicationsCol = app.findCollectionByNameOrId('applications')
    var logsCol = app.findCollectionByNameOrId('audit_logs')
    var discCol = null
    try {
      discCol = app.findCollectionByNameOrId('disc_results')
    } catch (_) {
      discCol = null
    }
    var chaEvalCol = null
    try {
      chaEvalCol = app.findCollectionByNameOrId('cha_evaluations')
    } catch (_) {
      chaEvalCol = null
    }

    // Nomes fictícios brasileiros (idade/sexo variados — todos de demonstração)
    var NAMES = [
      'Beatriz Oliveira Costa',
      'Lucas Ramos Albuquerque',
      'Mariana Vasconcelos',
      'Felipe Andrade Souza',
      'Camila Ribeiro Pinto',
      'Gustavo Ferreira Lima',
      'Larissa Duarte Melo',
      'Rodrigo Barros Alves',
      'Aline Cardoso Freitas',
      'Thiago Nascimento Rocha',
      'Juliana Castro Dias',
      'Marcelo Teixeira Gomes',
      'Vanessa Correia Braga',
      'Bruno Almeida Costa',
      'Renata Moraes Silva',
      'Eduardo Pires Santos',
      'Priscila Lopes Ramos',
      'André Luiz Fonseca',
      'Tatiane Barbosa Cruz',
      'Rafael Monteiro Lima',
      'Carolina Antunes Vidal',
      'Fabiana Guedes Reis',
      'Leandro Paiva Torres',
      'Sofia Mendonça Peixoto',
      'Wagner Dias Brito',
      'Elaine Cristina Prado',
      'Vinícius Sampaio Neto',
      'Débora Cristina Alencar',
      'Otávio Bernardes Cruz',
      'Isabela Farias Lemos',
      'Henrique Vasconcelos Pires',
      'Natália Bueno Rocha',
      'Danilo Carvalho Freire',
      'Alessandra Ramos Vieira',
      'Murilo Tavares Bastos',
      'Gabriela Sodré Pinto',
    ]

    var SOURCES = ['google_for_jobs', 'direct_link', 'whatsapp', 'referral', 'linkedin']
    // Categorização das reprovações deve bater com a do hook (por palavras-chave)
    var REJECTION_TEXTS = {
      perfil_tecnico:
        'Experiência insuficiente com as tecnologias centrais da vaga; curriculo não atende aos requisitos.',
      pretensao_salarial:
        'Pretensão salarial acima do orçamento da posição; remuneracao fora da faixa aprovada.',
      fit_cultura:
        'Bom técnico, mas estilo de trabalho pouco alinhado com os valores e o ritmo da equipe (fit).',
      desistencia_candidato:
        'Candidato desistiu do processo e aceitou outra proposta antes da etapa final.',
      outros: 'Processo encerrado por decisão combinada com o gestor da área.',
    }

    function mkEmail(name, idx) {
      var parts = String(name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z ]/g, '')
        .trim()
        .split(/ +/)
      return parts[0] + '.' + (parts[1] || 'silva') + idx + '@exemplo.com.br'
    }
    function seniorityFor(idx) {
      var opts = ['junior', 'mid', 'senior', 'lead']
      return opts[idx % 4]
    }

    // ---- cenários: um por "faixa" — cada linha é uma candidatura completa
    // [job, nameIdx, source, stageAtual, status, appliedAgo, firstMoveHours, diasNaEtapa]
    var SCENARIOS = [
      // === Vaga Dev Full Stack (aberta há 110d) — funil cheio + contratação
      [jobDev, 0, 'linkedin', 'hired', 'hired', 108, 6, 0],
      [jobDev, 1, 'google_for_jobs', 'hired', 'hired', 95, 30, 0],
      [jobDev, 2, 'referral', 'hired', 'hired', 72, 20, 0],
      [jobDev, 3, 'whatsapp', 'proposal', 'active', 40, 10, 3],
      [jobDev, 4, 'linkedin', 'tech_interview', 'active', 35, 26, 5],
      [jobDev, 5, 'direct_link', 'interview_hr', 'active', 28, 40, 4],
      [jobDev, 6, 'google_for_jobs', 'screening', 'active', 18, 70, 6],
      [jobDev, 7, 'linkedin', 'rejected', 'rejected', 60, 8, 0],
      [jobDev, 8, 'direct_link', 'rejected', 'rejected', 52, 96, 0],
      // === Vaga CS (85d) — funil em execução
      [jobCS, 9, 'whatsapp', 'hired', 'hired', 80, 18, 0],
      [jobCS, 10, 'linkedin', 'hired', 'hired', 60, 50, 0],
      [jobCS, 11, 'google_for_jobs', 'proposal', 'active', 25, 8, 2],
      [jobCS, 12, 'referral', 'tech_interview', 'active', 22, 30, 4],
      [jobCS, 13, 'direct_link', 'screening', 'active', 12, 30, 5],
      [jobCS, 14, 'whatsapp', 'rejected', 'rejected', 45, 24, 0],
      // === Vaga Vendas (70d) — contratação + reprovação salarial
      [jobVendas, 15, 'linkedin', 'hired', 'hired', 65, 12, 0],
      [jobVendas, 16, 'google_for_jobs', 'proposal', 'active', 30, 20, 6],
      [jobVendas, 17, 'referral', 'tech_interview', 'active', 20, 15, 3],
      [jobVendas, 18, 'direct_link', 'rejected', 'rejected', 50, 40, 0],
      // === Vaga Financeiro (55d)
      [jobFin, 19, 'linkedin', 'hired', 'hired', 50, 24, 0],
      [jobFin, 20, 'whatsapp', 'tech_interview', 'active', 30, 18, 4],
      [jobFin, 21, 'linkedin', 'interview_hr', 'active', 22, 60, 5],
      [jobFin, 22, 'google_for_jobs', 'rejected', 'rejected', 40, 30, 0],
      // === Vaga RH (40d)
      [jobRH, 23, 'referral', 'proposal', 'active', 30, 10, 2],
      [jobRH, 24, 'linkedin', 'screening', 'active', 15, 20, 6],
      [jobRH, 25, 'whatsapp', 'rejected', 'rejected', 25, 100, 0],
      // === Vaga Mobile (30d)
      [jobMobile, 26, 'linkedin', 'tech_interview', 'active', 20, 12, 4],
      [jobMobile, 27, 'google_for_jobs', 'screening', 'active', 10, 55, 3],
      // === Vaga Estágio (20d)
      [jobEstagio, 28, 'direct_link', 'interview_hr', 'active', 12, 8, 3],
      [jobEstagio, 29, 'whatsapp', 'screening', 'active', 7, 28, 4],
      // === Vaga Suporte (15d)
      [jobSuporte, 30, 'google_for_jobs', 'screening', 'active', 6, 20, 2],
      [jobSuporte, 31, 'linkedin', 'screening', 'active', 4, 100, 1],
      // === Vaga Coordenador Financeiro (118d, fechada) — 3 hired com TTH variado
      [jobCoord, 32, 'referral', 'hired', 'hired', 110, 14, 0],
      [jobCoord, 33, 'linkedin', 'hired', 'hired', 100, 36, 0],
      [jobCoord, 34, 'direct_link', 'rejected', 'rejected', 90, 48, 0],
    ]

    // Distribuição de reprovações: 5 categorias com pesos realistas (4/4/3/3/2)
    var REJECT_PLAN = [0, 1, 2, 3, 4, 0, 1, 2, 3, 2, 4, 0, 1, 3, 4, 2]
    var rejectCursor = 0

    for (var s = 0; s < SCENARIOS.length; s++) {
      var sc = SCENARIOS[s]
      var job = sc[0]
      if (!job) continue
      var nameIdx = sc[1]
      var source = sc[2]
      var targetStage = sc[3]
      var appStatus = sc[4]
      var appliedAgo = sc[5]
      var firstMoveHours = sc[6]
      var daysInStage = sc[7]
      var candName = NAMES[nameIdx]
      var candEmail = mkEmail(candName, nameIdx)

      // --- candidata (idempotente por email)
      var cand = findOne('candidates', "email = '" + candEmail + "'")
      if (!cand) {
        var candData = {
          name: candName,
          email: candEmail,
          phone:
            '(11) 9' + String(80000000 + nameIdx * 137).slice(0, 4) + '-' + String(4000 + nameIdx),
          cpf: '',
          linkedin: 'https://linkedin.com/in/demo-' + nameIdx,
          location: 'São Paulo, SP',
          seniority: seniorityFor(nameIdx),
          skills: 'Comunicação, Excel, CRM, Metodologias Ágeis, Inglês Intermediário',
          availability:
            nameIdx % 3 === 0 ? 'immediate' : nameIdx % 3 === 1 ? 'two_weeks' : 'one_month',
          lgpd_consent: true,
          lgpd_consent_date: daysAgo(appliedAgo - 1, 9),
          lgpd_consent_version: 'LGPD-v1.0-2025',
          notes: 'Candidata de demonstração gerada no seed (cenário ' + s + ').',
          org_id: org.id,
        }
        cand = put('candidates', candidatesCol, candData)
      }

      // --- candidatura
      var application = findOne(
        'applications',
        "candidate_id = '" + cand.id + "' && job_id = '" + job.id + "'",
      )
      if (application) continue // já seedada — não duplicar candidatura nem logs

      var appliedTs = daysAgo(appliedAgo, 10)
      var stageUpdated =
        targetStage === 'rejected' ? daysAgo(appliedAgo - 3, 15) : daysAgo(daysInStage, 11)
      var rejectionCat =
        targetStage === 'rejected' ? REJECT_PLAN[rejectCursor++ % REJECT_PLAN.length] : null
      var rejectionText =
        rejectionCat !== null ? REJECTION_TEXTS[Object.keys(REJECTION_TEXTS)[rejectionCat]] : ''
      application = put('applications', applicationsCol, {
        org_id: org.id,
        candidate_id: cand.id,
        job_id: job.id,
        stage_id: targetStage === 'rejected' ? 'rejected' : targetStage,
        status: appStatus,
        source: source,
        rejection_reason: rejectionText,
        stage_updated_at: stageUpdated,
        created: appliedTs,
      })
      // `created` é autodate — forçar a data real da candidatura:
      try {
        application.set('created', appliedTs)
        app.save(application)
      } catch (_) {}

      // --- trilha de auditoria coerente com a candidatura
      // 1) ingresso no funil: applied → screening (tempo de 1ª resposta)
      var screeningTs = daysAgo(appliedAgo, 10, Math.round(firstMoveHours))
      put('audit_logs', logsCol, {
        org_id: org.id,
        application_id: application.id,
        candidate_id: cand.id,
        user_id: recruiter ? recruiter.id : admin.id,
        user_name: recruiter ? recruiter.getString('name') : 'Juliana Silveira',
        user_role: 'recruiter',
        action: 'stage_changed',
        from_stage: 'applied',
        to_stage: 'screening',
        reason:
          firstMoveHours < 24
            ? 'Triagem iniciada no mesmo dia da candidatura.'
            : firstMoveHours < 72
              ? 'Triagem iniciada em até 3 dias da candidatura.'
              : 'Triagem iniciada após 3 dias da candidatura.',
        created: screeningTs,
      })
      // 2) progressão até a etapa alvo (screening → … → targetStage)
      var CHAIN = ['screening', 'interview_hr', 'tech_interview', 'proposal', 'hired']
      var chainUntil = CHAIN.indexOf(targetStage)
      var curDays = appliedAgo
      for (var ci = 0; ci < chainUntil; ci++) {
        var from = CHAIN[ci]
        var to = CHAIN[ci + 1]
        curDays = Math.max(1, curDays - 5)
        var actor = ci === 0 ? recruiter : manager
        put('audit_logs', logsCol, {
          org_id: org.id,
          application_id: application.id,
          candidate_id: cand.id,
          user_id: actor ? actor.id : admin.id,
          user_name: actor ? actor.getString('name') : 'Carlos Mendes',
          user_role: actor === recruiter ? 'recruiter' : 'manager',
          action: 'stage_changed',
          from_stage: from,
          to_stage: to,
          reason:
            'Aprovação na etapa ' + STAGE_LABEL(from) + ' — ' + candName + ' avançou no processo.',
          created: daysAgo(curDays, 14),
        })
      }
      // 3) reprovação (se for o caso)
      if (targetStage === 'rejected') {
        put('audit_logs', logsCol, {
          org_id: org.id,
          application_id: application.id,
          candidate_id: cand.id,
          user_id: recruiter ? recruiter.id : admin.id,
          user_name: recruiter ? recruiter.getString('name') : 'Juliana Silveira',
          user_role: 'recruiter',
          action: 'stage_changed',
          from_stage: 'screening',
          to_stage: 'rejected',
          reason: rejectionText,
          created: daysAgo(Math.max(1, appliedAgo - 3), 16),
        })
      }
      // 4) contratação (se for o caso) — data alvo do time-to-hire
      if (appStatus === 'hired') {
        put('audit_logs', logsCol, {
          org_id: org.id,
          application_id: application.id,
          candidate_id: cand.id,
          user_id: admin.id,
          user_name: admin.getString('name'),
          user_role: 'admin',
          action: 'stage_changed',
          from_stage: 'proposal',
          to_stage: 'hired',
          reason: 'Proposta aceita e admissão iniciada.',
          created: daysAgo(Math.max(1, appliedAgo - 25), 17),
        })
      }

      // --- DISC (algumas candidatas)
      if (discCol && s % 4 === 0 && !exists('disc_results', "candidate_id = '" + cand.id + "'")) {
        var discProfile = ['D', 'I', 'S', 'C'][nameIdx % 4]
        put('disc_results', discCol, {
          org_id: org.id,
          candidate_id: cand.id,
          token: 'demo-' + nameIdx + '-' + s,
          status: 'completed',
          profile: discProfile,
          d: 60 + (nameIdx % 3) * 10,
          i: 40 + (nameIdx % 4) * 12,
          s: 30 + (nameIdx % 5) * 10,
          c: 25 + (nameIdx % 4) * 15,
          answers: JSON.stringify({ demo: true }),
          completed_at: daysAgo(Math.max(1, appliedAgo - 2), 15),
        })
      }

      // --- ficha CHA avaliada (para o caminho technical_source='cha' do score)
      if (
        chaEvalCol &&
        job &&
        s % 3 === 0 &&
        (targetStage === 'hired' ||
          targetStage === 'proposal' ||
          targetStage === 'tech_interview') &&
        !exists('cha_evaluations', "application_id = '" + application.id + "'")
      ) {
        var grades = buildDemoGrades(job, candName, nameIdx)
        if (grades) {
          put('cha_evaluations', chaEvalCol, {
            org_id: org.id,
            job_id: job.id,
            application_id: application.id,
            grades: JSON.stringify(grades.grades),
            weighted_score: grades.score,
            block_scores: JSON.stringify(grades.blocks),
            evaluator: recruiter ? recruiter.id : admin.id,
          })
        }
      }
    } // fim loop cenários

    console.log('[0036] seed demo aplicado (org ' + org.id + ')')
  },
  (app) => {
    // rollback: nada — o seed é idempotente e sem efeitos colaterais de schema
  },
)

function STAGE_LABEL(stage) {
  var m = {
    applied: 'Inscrição',
    screening: 'Triagem',
    interview_hr: 'Entrevista RH',
    tech_interview: 'Entrevista Técnica',
    proposal: 'Proposta',
    hired: 'Contratado',
  }
  return m[stage] || stage
}

/** Monta grades CHA coerentes com os requisitos efetivos da vaga. */
function buildDemoGrades(job, candName, nameIdx) {
  try {
    var raw = job.getString('cha_requirements')
    var parsed = JSON.parse(raw)
    var cha = parsed && parsed.cargo ? parsed.cargo : null
    if (!cha) return null
    var grades = []
    var blocks = { conhecimentos: 0, habilidades: 0, atitudes: 0 }
    var keys = ['conhecimentos', 'habilidades', 'atitudes']
    var totals = { conhecimentos: 0, habilidades: 0, atitudes: 0 }
    var base = 3 + (nameIdx % 3) // 3/4/5 variando por candidata
    for (var ki = 0; ki < keys.length; ki++) {
      var key = keys[ki]
      var items = (cha[key] && cha[key].items) || []
      var wsum = 0
      var scsum = 0
      for (var ii = 0; ii < items.length; ii++) {
        var it = items[ii]
        var grade = Math.min(5, base + (ii % 2 === 0 ? 0 : -1))
        grades.push({
          key: it.id || 'cha_' + key + '_' + ii,
          block: key,
          description: it.description,
          weight: it.weight || 3,
          grade: grade,
          evidence: 'Avaliação demo para ' + candName,
        })
        wsum += it.weight || 3
        scsum += (it.weight || 3) * grade
      }
      if (wsum > 0) {
        blocks[key] = Math.round((scsum / (wsum * 5)) * 100)
        totals[key] = wsum
      }
    }
    var totalW = totals.conhecimentos + totals.habilidades + totals.atitudes
    var totalS =
      (totals.conhecimentos ? (blocks.conhecimentos * totals.conhecimentos) / 5 : 0) +
      (totals.habilidades ? (blocks.habilidades * totals.habilidades) / 5 : 0) +
      (totals.atitudes ? (blocks.atitudes * totals.atitudes) / 5 : 0)
    var score = totalW > 0 ? Math.round((totalS / totalW) * 100) / 1 : 0
    return { grades: grades, blocks: blocks, score: score }
  } catch (_) {
    return null
  }
}
