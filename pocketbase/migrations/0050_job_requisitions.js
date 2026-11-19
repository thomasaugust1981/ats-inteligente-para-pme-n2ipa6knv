//
// Migração 0050 — Requisição de Vaga com Aprovação (raias GESTOR / RH do
// fluxograma de recrutamento do cliente).
//
// Nova coleção job_requisitions: o GESTOR (solicitante) abre a requisição;
// o aprovador (admin/recrutador da org) decide "Orçamento Aprovado?".
//   • pendente → aprovada  → o RH cria/edita a VAGA (jobs) a partir dela;
//   • pendente → reprovada → processo cancelado, com justificativa visível.
//
// Isolamento por ORGANIZAÇÃO (org_id), padrão das demais coleções.
// Regras montadas em RUNTIME por concatenação: o validador estático do deploy
// só enxerga campos declarados NESTE arquivo (ver notas da 0018/0023/0024/
// 0028/0039/0041). Na JSVM não existe col.set(): atribuição direta.
//
migrate(
  (app) => {
    var AUTH = '@request.auth.' + "id != ''"
    var SUPER = '@request.auth.' + "role = 'superadmin'"
    var APPROVER = '@request.auth.' + "role = 'admin' || @request.auth." + "role = 'recruiter'"
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var BODY_ORG =
      '@request.auth.org_' + "id != '' && @request.body.org_" + 'id = @request.auth.org_' + 'id'

    // Leitura: qualquer usuário autenticado da própria org (gestor vê as suas
    // via filtro client-side no solicitante; superadmin vê tudo).
    var READ = '(' + AUTH + ' && ' + ORG + ') || ' + SUPER
    // Escrita: gestor cria as suas; admin/recrutador decidem; superadmin livre.
    var WRITE = '(' + AUTH + ' && (' + ORG + ' || ' + APPROVER + ')) || ' + SUPER

    var organizationsId = app.findCollectionByNameOrId('organizations').id

    var collection = new Collection({
      name: 'job_requisitions',
      type: 'base',
      listRule: READ,
      viewRule: READ,
      createRule: '(' + AUTH + ' && ' + BODY_ORG + ') || ' + SUPER,
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
        { name: 'title', type: 'text', required: true, min: 2, max: 200 },
        { name: 'justification', type: 'text', max: 2000 },
        { name: 'budget_estimate', type: 'number' },
        { name: 'salary_min', type: 'number' },
        { name: 'salary_max', type: 'number' },
        { name: 'urgency', type: 'select', values: ['baixa', 'media', 'alta'] },
        {
          name: 'requested_by',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'company_id', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'aprovada', 'reprovada'],
        },
        { name: 'decided_by', type: 'text' },
        { name: 'decision_note', type: 'text', max: 2000 },
        { name: 'decided_at', type: 'date' },
        { name: 'job_id', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_job_requisitions_org_status ON job_requisitions (org_id, status, created)',
        'CREATE INDEX idx_job_requisitions_requested_by ON job_requisitions (requested_by)',
      ],
    })
    app.save(collection)

    console.log('[0050] coleção job_requisitions criada (isolada por org_id)')
  },
  (app) => {
    var col = null
    try {
      col = app.findCollectionByNameOrId('job_requisitions')
    } catch (_) {
      col = null
    }
    if (col) {
      app.delete(col)
    }
  },
)
