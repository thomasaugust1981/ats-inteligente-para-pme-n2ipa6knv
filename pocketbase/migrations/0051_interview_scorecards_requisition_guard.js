//
// Migração 0051 — Scorecard de entrevista + blindagem da decisão de requisição.
//
// 1) Nova coleção interview_scorecards: avaliação estruturada de ENTREVISTA
//    por etapa (raias ENTREVISTA RH / ENTREVISTA TÉCNICA do fluxograma do
//    cliente). Notas 1-5 por critério (técnico, comunicação, cultura),
//    comentários e recomendação (avançar / reprovar / contratar) — a
//    recomendação SUGERE a próxima movimentação, mas nunca move sozinha.
//
// 2) job_requisitions: a decisão (status/decision_note/decided_by/decided_at)
//    fica blindada no SERVIDOR — updateRule passa a exigir papel admin ou
//    recrutador da org. O gestor continua podendo criar e ler as suas
//    (createRule/listRule inalterados), mas não consegue decidir nem pela API.
//
// Regras montadas em RUNTIME por concatenação: o validador estático do deploy
// só enxerga campos declarados NESTE arquivo (nota da 0018/0023/0024/0050).
// Na JSVM não existe col.set(): atribuição direta.
//
migrate(
  (app) => {
    var AUTH = '@request.auth.' + "id != ''"
    var SUPER = '@request.auth.' + "role = 'superadmin'"
    var EDITOR =
      '@request.auth.' +
      "role = 'admin' || @request.auth." +
      "role = 'recruiter' || @request.auth." +
      "role = 'manager'"
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var BODY_ORG =
      '@request.auth.org_' + "id != '' && @request.body.org_" + 'id = @request.auth.org_' + 'id'

    // Leitura: qualquer usuário autenticado da própria org (histórico aparece
    // no perfil do candidato para toda a equipe); superadmin vê tudo.
    var READ = '(' + AUTH + ' && ' + ORG + ') || ' + SUPER
    // Escrita: admin/recrutador/gestor da org registram avaliações; superadmin livre.
    var WRITE = '(' + AUTH + ' && ' + ORG + ' && ' + EDITOR + ') || ' + SUPER

    var organizationsId = app.findCollectionByNameOrId('organizations').id
    var applicationsId = app.findCollectionByNameOrId('applications').id
    var jobsId = app.findCollectionByNameOrId('jobs').id

    var collection = new Collection({
      name: 'interview_scorecards',
      type: 'base',
      listRule: READ,
      viewRule: READ,
      createRule: '(' + AUTH + ' && ' + BODY_ORG + ' && (' + EDITOR + ')) || ' + SUPER,
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
        },
        { name: 'stage', type: 'text', max: 100 },
        {
          name: 'interviewer',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'interviewed_at', type: 'date' },
        { name: 'score_technical', type: 'number', onlyInt: true, min: 1, max: 5 },
        { name: 'score_communication', type: 'number', onlyInt: true, min: 1, max: 5 },
        { name: 'score_culture', type: 'number', onlyInt: true, min: 1, max: 5 },
        { name: 'comments', type: 'text', max: 4000 },
        {
          name: 'recommendation',
          type: 'select',
          values: ['avançar', 'reprovar', 'contratar'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_interview_scorecards_org ON interview_scorecards (org_id, created)',
        'CREATE INDEX idx_interview_scorecards_application ON interview_scorecards (application_id)',
      ],
    })
    app.save(collection)

    // ---- 2. job_requisitions: só admin/recrutador decide -------------------
    var req = app.findCollectionByNameOrId('job_requisitions')
    var REQ_DECIDER =
      '(' +
      AUTH +
      ' && ' +
      ORG +
      ' && (' +
      '@request.auth.' +
      "role = 'admin' || @request.auth." +
      "role = 'recruiter')) || " +
      SUPER
    req.updateRule = REQ_DECIDER
    req.deleteRule = REQ_DECIDER
    app.save(req)

    console.log(
      '[0051] interview_scorecards criada; decisão de job_requisitions blindada (admin/recrutador)',
    )
  },
  (app) => {
    var col = null
    try {
      col = app.findCollectionByNameOrId('interview_scorecards')
    } catch (_) {
      col = null
    }
    if (col) {
      app.delete(col)
    }
    // rollback da blindagem: volta ao WRITE da 0050
    var req = null
    try {
      req = app.findCollectionByNameOrId('job_requisitions')
    } catch (_) {
      req = null
    }
    if (req) {
      var AUTH2 = '@request.auth.' + "id != ''"
      var SUPER2 = '@request.auth.' + "role = 'superadmin'"
      var APPROVER = '@request.auth.' + "role = 'admin' || @request.auth." + "role = 'recruiter'"
      var ORG2 = 'org_' + 'id = @request.auth.org_' + 'id'
      req.updateRule = '(' + AUTH2 + ' && (' + ORG2 + ' || ' + APPROVER + ')) || ' + SUPER2
      req.deleteRule = req.updateRule
      app.save(req)
    }
  },
)
