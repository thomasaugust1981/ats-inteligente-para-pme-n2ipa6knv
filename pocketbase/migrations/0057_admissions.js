/// <reference path="../pb_data/types.d.ts" />
//
// Migração 0057 — fluxo de handoff admissional (Departamento Pessoal).
//
// Duas coleções NOVAS no padrão da 0051/0055:
//   admissions                 — processo de admissão de uma candidatura contratada
//   admission_checklist_items  — itens do checklist admissional do processo
//
// Regras montadas em RUNTIME por concatenação (o validador estático só enxerga
// campos declarados NESTE arquivo — lição 0051/0052/0056), com parênteses
// explícitos nos grupos de papéis (lição 0052) e org_id em toda coleção.
//
migrate(
  (app) => {
    var AUTH = '@request.auth.' + "id != ''"
    var SUPER = '@request.auth.' + "role = 'superadmin'"
    var STAFF =
      '(' +
      '@request.auth.' +
      "role = 'admin' || @request.auth." +
      "role = 'recruiter' || @request.auth." +
      "role = 'manager'" +
      ')'
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var BODY_ORG =
      '@request.auth.org_' + "id != '' && @request.body.org_" + 'id = @request.auth.org_' + 'id'

    // Leitura: usuários autenticados da própria org (admin/recrutador veem tudo
    // da org; gestor vê as das vagas dele — o filtro fino por gestor é feito no
    // frontend, a regra garante o isolamento por organização). Superadmin vê tudo.
    var READ = '(' + AUTH + ' && ' + ORG + ') || ' + SUPER
    // Escrita: admin/recrutador/gestor da org; superadmin livre.
    var WRITE = '((' + AUTH + ' && ' + ORG + ' && ' + STAFF + ')) || ' + SUPER
    var CREATE = '(' + AUTH + ' && ' + BODY_ORG + ' && ' + STAFF + ') || ' + SUPER

    var organizationsId = app.findCollectionByNameOrId('organizations').id
    var applicationsId = app.findCollectionByNameOrId('applications').id
    var jobsId = app.findCollectionByNameOrId('jobs').id
    var usersId = '_pb_users_auth_'

    // ---------- admissions ----------
    var admissions = new Collection({
      name: 'admissions',
      type: 'base',
      listRule: READ,
      viewRule: READ,
      createRule: CREATE,
      updateRule: WRITE,
      deleteRule: WRITE,
      fields: [
        {
          name: 'org_id',
          type: 'relation',
          required: true,
          collectionId: organizationsId,
          maxSelect: 1,
        },
        {
          name: 'application_id',
          type: 'relation',
          required: true,
          collectionId: applicationsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'job_id',
          type: 'relation',
          required: false,
          collectionId: jobsId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'manager_id',
          type: 'relation',
          required: false,
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        // snapshot em texto: candidato (nome/contato/CPF), cargo, vaga — dados
        // que o DP precisa, congelados na criação do processo.
        { name: 'candidate_name', type: 'text', required: true, max: 300 },
        { name: 'candidate_contact', type: 'text', max: 300 },
        { name: 'candidate_cpf', type: 'text', max: 40 },
        { name: 'job_title', type: 'text', max: 300 },
        { name: 'cargo_title', type: 'text', max: 300 },
        { name: 'org_name', type: 'text', max: 300 },
        { name: 'manager_name', type: 'text', max: 300 },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'em_andamento', 'concluido'],
          maxSelect: 1,
        },
        { name: 'hire_date', type: 'date' },
        { name: 'notes', type: 'text', max: 5000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_admissions_app ON admissions (application_id)',
        'CREATE INDEX idx_admissions_org ON admissions (org_id, created)',
        'CREATE INDEX idx_admissions_job ON admissions (job_id)',
      ],
    })
    app.save(admissions)

    // ---------- admission_checklist_items ----------
    var admissionChecks = new Collection({
      name: 'admission_checklist_items',
      type: 'base',
      listRule: READ,
      viewRule: READ,
      createRule: CREATE,
      updateRule: WRITE,
      deleteRule: WRITE,
      fields: [
        {
          name: 'org_id',
          type: 'relation',
          required: true,
          collectionId: organizationsId,
          maxSelect: 1,
        },
        {
          name: 'admission_id',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('admissions').id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'title', type: 'text', required: true, max: 300 },
        { name: 'done', type: 'bool' },
        { name: 'done_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'done_at', type: 'date' },
        { name: 'sort_order', type: 'number', onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_admchecks_admission ON admission_checklist_items (admission_id, sort_order)',
        'CREATE INDEX idx_admchecks_org ON admission_checklist_items (org_id)',
      ],
    })
    app.save(admissionChecks)

    console.log('[0057] admissions + admission_checklist_items criadas (isoladas por org)')
  },
  (app) => {
    function dropIfExists(name) {
      var col = null
      try {
        col = app.findCollectionByNameOrId(name)
      } catch (_) {
        col = null
      }
      if (col) app.delete(col)
    }
    dropIfExists('admission_checklist_items')
    dropIfExists('admissions')
  },
)
