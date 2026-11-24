//
// Handoff admissional (Departamento Pessoal) — criação automática do processo
// de admissão quando uma candidatura é movida para a etapa "hired".
//
// Coleções (migração 0057): admissions + admission_checklist_items.
// Tudo atrás da API padrão do PocketBase; este hook é somente o gatilho.
//
// Importante (JSVM): helpers vivem DENTRO do callback — declarações top-level
// não são visíveis no pool da VM. Falha de criação é logada, nunca quebra a
// request de atualização da candidatura.
//
onRecordAfterUpdateSuccess((e) => {
  try {
    var app = e.app
    var record = e.record

    var stageId = record.get('stage_id') || ''
    if (stageId !== 'hired') {
      e.next()
      return
    }

    // Só dispara quando a etapa REALMENTE mudou para hired (evita recriar em
    // qualquer update de candidatura já contratada; o índice único por
    // application_id é a segunda barreira).
    var previousStage = ''
    try {
      var original = record.original()
      if (original) previousStage = original.get('stage_id') || ''
    } catch (_) {}
    if (previousStage === 'hired') {
      e.next()
      return
    }

    // Idempotência: se o processo já existe, não cria outro.
    try {
      app.findFirstRecordByFilter('admissions', 'application_id = {:id}', { id: record.id })
      console.log('[admissions] processo admissional já existe para', record.id)
      e.next()
      return
    } catch (_) {
      // não existe — segue para criar
    }

    function safeFind(collection, id) {
      try {
        if (!id) return null
        return app.findRecordById(collection, id)
      } catch (_) {
        return null
      }
    }

    var orgId = record.get('org_id') || ''
    var jobId = record.get('job_id') || ''
    var candidateId = record.get('candidate_id') || ''

    var candidate = safeFind('candidates', candidateId)
    var job = safeFind('jobs', jobId)
    var organization = safeFind('organizations', orgId)

    var candidateName = candidate ? candidate.get('name') || 'Candidato' : 'Candidato'
    var candidateContact = candidate
      ? [candidate.get('email') || '', candidate.get('phone') || ''].filter(Boolean).join(' · ')
      : ''
    var candidateCpf = candidate ? candidate.get('cpf') || '' : ''

    var jobTitle = job ? job.get('title') || '' : ''

    // Cargo: relation cargo_id → cargos.title; fallback no snapshot da vaga.
    var cargoTitle = ''
    if (job) {
      var cargoRec = safeFind('cargos', job.get('cargo_id') || '')
      if (cargoRec) cargoTitle = cargoRec.get('title') || ''
      if (!cargoTitle) {
        try {
          var snap = JSON.parse(job.get('cargo_snapshot') || 'null')
          if (snap && snap.title) cargoTitle = snap.title
        } catch (_) {}
      }
      if (!cargoTitle) cargoTitle = job.get('department') || jobTitle
    }

    var orgName = organization ? organization.get('name') || '' : ''

    // Gestor da vaga: relation manager_id → users.name; fallback manager_name.
    var managerId = job ? job.get('manager_id') || '' : ''
    var managerName = job ? job.get('manager_name') || '' : ''
    if (managerId) {
      var managerUser = safeFind('users', managerId)
      if (managerUser) {
        var mName = managerUser.get('name') || managerUser.email() || ''
        if (mName) managerName = mName
      }
    }

    // Data da contratação: quando a candidatura entrou em "hired" (agora).
    var hireDate = new Date().toISOString()

    var admissionsCol = app.findCollectionByNameOrId('admissions')
    var admission = new Record(admissionsCol)
    admission.set('org_id', orgId)
    admission.set('application_id', record.id)
    admission.set('job_id', jobId || null)
    admission.set('manager_id', managerId || null)
    admission.set('candidate_name', candidateName)
    admission.set('candidate_contact', candidateContact)
    admission.set('candidate_cpf', candidateCpf)
    admission.set('job_title', jobTitle)
    admission.set('cargo_title', cargoTitle)
    admission.set('org_name', orgName)
    admission.set('manager_name', managerName)
    admission.set('status', 'pendente')
    admission.set('hire_date', hireDate)
    admission.set('notes', '')
    app.save(admission)

    // Checklist admissional padrão (item de ERP com o nome exato da marca).
    var DEFAULT_ITEMS = [
      'Exame médico admissional',
      'Documentação (RG, CPF, CTPS, título de eleitor, comprovante de residência, foto 3x4)',
      'Assinatura da proposta/contrato',
      'Cadastro no Goldway ERP',
      'Onboarding — primeira semana agendada',
    ]
    var checksCol = app.findCollectionByNameOrId('admission_checklist_items')
    for (var i = 0; i < DEFAULT_ITEMS.length; i++) {
      var item = new Record(checksCol)
      item.set('org_id', orgId)
      item.set('admission_id', admission.id)
      item.set('title', DEFAULT_ITEMS[i])
      item.set('done', false)
      item.set('sort_order', i + 1)
      app.save(item)
    }

    console.log(
      '[admissions] processo admissional criado para candidatura',
      record.id,
      '| candidato:',
      candidateName,
    )
  } catch (err) {
    // Nunca quebra a request de movimentação do pipeline.
    console.error('[admissions] falha ao criar processo admissional:', err)
  } finally {
    e.next()
  }
}, 'applications')
