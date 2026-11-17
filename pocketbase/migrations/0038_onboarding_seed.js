//
// Migração 0038 — SEED DE ONBOARDING (dados fictícios para a página /onboarding,
// pedido do usuário: "preencher tb o onboarding da empresa com dados fictícios").
//
// Complementa o leque da 0036 (o seed só cobria vagas/candidatos/candidaturas —
// o onboarding continuava vazio). Preenche:
//   1. companies  — marca, nome fantasia, CNPJ, site, cidade/UF, visão e missão
//   2. team_invites — convites pendentes (passo 3 do onboarding)
//   3. stage_settings — responsáveis/lembretes por etapa (passo 4, job_id '__default__')
//
// Idempotente: cada bloco SÓ grava quando a condição de existência falha —
// companies por org_id, invites por (org_id+email), stage_settings por
// (org_id+job_id+stage_id). Rodar 2x não duplica nada; em banco populado é no-op.
// NÃO muda o fluxo do onboarding: usuário ainda pode editar tudo e avançar.
//
migrate(
  (app) => {
    function daysAgo(n, h, m) {
      var d = new Date(Date.now() - n * 86400000)
      d.setUTCHours(h || 12, m || 0, 0, 0)
      return d.toISOString().replace('T', ' ').replace('Z', '000Z')
    }
    function findOne(col, filter) {
      try {
        return app.findFirstRecordByFilter(col, filter)
      } catch (_) {
        return null
      }
    }
    function put(colName, col, data) {
      var rec = new Record(col)
      for (var k in data) {
        if (data[k] !== undefined && data[k] !== null) rec.set(k, data[k])
      }
      app.save(rec)
      return rec
    }

    // ---------------------------------------------- 1. empresa do onboarding
    // Mesma organização do leque demo (org do admin seed thomas.august1981).
    var org = null
    try {
      org = app.findAuthRecordByEmail('_pb_users_auth_', 'thomas.august1981@gmail.com')
        ? app.findFirstRecordByData(
            'organizations',
            'id',
            app
              .findAuthRecordByEmail('_pb_users_auth_', 'thomas.august1981@gmail.com')
              .getString('org_id'),
          )
        : null
    } catch (_) {
      org = null
    }
    if (!org) {
      try {
        org = app.findFirstRecordByData('organizations', 'slug', 'vanguard-solucoes-pme')
      } catch (_) {
        org = null
      }
    }
    if (!org) {
      console.log('[0038] org demo não encontrada — seed de onboarding ignorado')
      return
    }

    var companiesCol = app.findCollectionByNameOrId('companies')
    var company = findOne('companies', "org_id = '" + org.id + "'")
    if (!company) {
      company = put('companies', companiesCol, {
        org_id: org.id,
        name: 'Vanguard Soluções PME',
        trade_name: 'Vanguard Tecnologia',
        brand_color: '#0284c7',
        onboarding_status: 'in_progress',
        description:
          'Empresa brasileira de tecnologia especializada em soluções de gestão, inteligência de processos e automação para pequenas e médias empresas.',
        website: 'https://vanguardtecnologia.com.br',
        cnpj: '12.345.678/0001-90',
        company_type: 'matriz',
        city: 'São Paulo',
        state: 'SP',
        is_active: true,
      })
      console.log('[0038] empresa demo criada (org ' + org.id + ')')
    }

    // Visão e missão (passo 5): preenche só se o campo estiver vazio.
    // Altera o registro JÁ CARREGADO (nunca um Record novo só com id: o save
    // validaria required fields como em branco — foi exatamente o erro
    // "name: cannot be blank" da 1ª tentativa desta migração).
    var needsMission = !company.getString('mission')
    var needsVision = !company.getString('vision')
    if (needsMission || needsVision) {
      if (needsVision)
        company.set(
          'vision',
          'Ser reconhecida até 2030 como a plataforma de recrutamento mais adotada por PMEs brasileiras em crescimento.',
        )
      if (needsMission)
        company.set(
          'mission',
          'Simplificar a contratação de talentos para pequenas e médias empresas com tecnologia acessível, IA e processos claros.',
        )
      app.save(company)
    }

    // ---------------------------------------------- 2. convites de equipe
    var invitesCol = app.findCollectionByNameOrId('team_invites')
    var invitedBy = 'Thomas August (Admin)'
    var existingInvites = app.findRecordsByFilter(
      'team_invites',
      "org_id = '" + org.id + "'",
      'created',
      0,
      50,
    )
    function ensureInvite(email, role, status, days) {
      var em = email.toLowerCase()
      for (var i = 0; i < existingInvites.length; i++) {
        if ((existingInvites[i].getString('email') || '').toLowerCase() === em) return
      }
      put('team_invites', invitesCol, {
        org_id: org.id,
        email: em,
        role: role,
        status: status,
        invited_by: invitedBy,
        created: daysAgo(days, 10),
      })
    }
    ensureInvite('fernanda.aoki@vanguard.com.br', 'manager', 'pending', 12)
    ensureInvite('pedro.salles@vanguard.com.br', 'recruiter', 'pending', 9)
    ensureInvite('diego.martins@vanguard.com.br', 'recruiter', 'accepted', 20)
    ensureInvite('camila.ferraz@vanguard.com.br', 'admin', 'cancelled', 25)

    // ---------------------------------------------- 3. responsáveis das etapas
    // job_id sentinela '__default__' = padrão aplicado às novas vagas.
    // owner_user_id é texto; apontamos para os usuários demo do seed.
    var stagesCol = app.findCollectionByNameOrId('stage_settings')
    var admin = null
    try {
      admin = app.findAuthRecordByEmail('_pb_users_auth_', 'thomas.august1981@gmail.com')
    } catch (_) {
      admin = null
    }
    var recruiter = null
    try {
      recruiter = app.findAuthRecordByEmail('_pb_users_auth_', 'recrutamento@vanguard.com.br')
    } catch (_) {
      recruiter = null
    }
    var manager = null
    try {
      manager = app.findAuthRecordByEmail('_pb_users_auth_', 'gestor.ti@vanguard.com.br')
    } catch (_) {
      manager = null
    }

    var stageOwners = [
      { stage_id: 'applied', user: recruiter, email: 'triagem@vanguard.com.br', days: 2 },
      { stage_id: 'screening', user: recruiter, email: '', days: 2 },
      { stage_id: 'interview_hr', user: recruiter, email: '', days: 3 },
      { stage_id: 'tech_interview', user: manager, email: 'dev@vanguard.com.br', days: 3 },
      { stage_id: 'proposal', user: admin, email: '', days: 1 },
      { stage_id: 'disc', user: recruiter, email: '', days: 4 },
    ]
    for (var si = 0; si < stageOwners.length; si++) {
      var so = stageOwners[si]
      var stageKey =
        "org_id = '" + org.id + "' && job_id = '__default__' && stage_id = '" + so.stage_id + "'"
      if (findOne('stage_settings', stageKey)) continue
      put('stage_settings', stagesCol, {
        org_id: org.id,
        job_id: '__default__',
        stage_id: so.stage_id,
        owner_user_id: so.user ? so.user.id : '',
        owner_email: so.email,
        reminder_enabled: true,
        reminder_days: so.days,
      })
    }

    console.log('[0038] seed de onboarding aplicado (org ' + org.id + ')')
  },
  (app) => {
    // rollback: nada — o seed é idempotente e sem efeitos colaterais de schema
  },
)
