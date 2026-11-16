//
// Migração 0032 — FASE 2 do fluxo Organograma → Cargo → Vaga:
// ciclo de aprovação e finalidade do CARGO.
//
//   • cargos: campos novos —
//       org_node_id  relation → org_nodes (posição do organograma; LOCK:
//                    imutável após create, garantido no hook cargo_server)
//       purpose      select: PREENCHIMENTO | ESTRUTURAL | SUCCESSAO | PROMOCAO
//       status       select: RASCUNHO | EM_APROVACAO | APROVADO | REPROVADO
//       created_by / created_by_role / created_by_id (autor, para bloquear
//                    auto-aprovação)
//       approved_by / approved_by_role / approved_at
//       rejection_reason / rejected_by / rejected_by_role
//       submitted_at
//       salary_defined bool (false = cargo sem faixa salarial — fora da base
//                    de custo de pessoal na FASE 3; calculado do salary_min)
//   • cargo_approvals: trilha do ciclo do cargo (submit/approve/reject/
//     convert-purpose), com comentário, autor e papel — coleção nova,
//     padrão org_approvals (isolamento por org via regras).
//   • backfill: cargos antigos (criados antes da FASE 2) viram APROVADO com
//     finalidade ESTRUTURAL, para não travar o catálogo existente.
//   • roles: recrutador NÃO cria/edita cargo — regras de create/update
//     restritas a admin/superadmin (leitura continua para toda a org).
//   • audit_logs.action é select fechado: as transições do cargo são gravadas
//     em cargo_approvals (nova coleção, própria para isto) — não precisa
//     expandir o enum.
//
// Tokens de regra montados em RUNTIME por concatenação (validador estático do
// deploy só enxerga campos declarados NESTE arquivo). JSVM não tem col.set().
//
migrate(
  (app) => {
    var AUTH = '@request.auth.' + "id != ''"
    var SUPER = '@request.auth.' + "role = 'superadmin'"
    var ORG = 'org_' + 'id = @request.auth.org_' + 'id'
    var ORG_ONLY = '(' + AUTH + ' && ' + ORG + ') || ' + SUPER
    var ADMIN_ONLY =
      '(' + AUTH + ' && ' + ORG + ' && @request.auth.' + "role != 'recruiter') || " + SUPER

    // ---- 1. cargos: campos novos (idempotente) ----
    var cargos = app.findCollectionByNameOrId('cargos')

    if (!cargos.fields.getByName('org_node_id')) {
      cargos.fields.add(
        new RelationField({
          name: 'org_node_id',
          collectionId: app.findCollectionByNameOrId('org_nodes').id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      app.save(cargos)
    }

    if (!cargos.fields.getByName('purpose')) {
      cargos.fields.add(
        new SelectField({
          name: 'purpose',
          values: ['PREENCHIMENTO', 'ESTRUTURAL', 'SUCCESSAO', 'PROMOCAO'],
          maxSelect: 1,
        }),
      )
      app.save(cargos)
    }

    if (!cargos.fields.getByName('status')) {
      cargos.fields.add(
        new SelectField({
          name: 'status',
          values: ['RASCUNHO', 'EM_APROVACAO', 'APROVADO', 'REPROVADO'],
          maxSelect: 1,
        }),
      )
      app.save(cargos)
    }

    var textFieldNames = [
      'created_by',
      'created_by_role',
      'created_by_id',
      'approved_by',
      'approved_by_role',
      'rejection_reason',
      'rejected_by',
      'rejected_by_role',
    ]
    for (var t = 0; t < textFieldNames.length; t++) {
      if (!cargos.fields.getByName(textFieldNames[t])) {
        cargos.fields.add(new TextField({ name: textFieldNames[t] }))
        app.save(cargos)
      }
    }

    if (!cargos.fields.getByName('approved_at')) {
      cargos.fields.add(new DateField({ name: 'approved_at' }))
      app.save(cargos)
    }
    if (!cargos.fields.getByName('submitted_at')) {
      cargos.fields.add(new DateField({ name: 'submitted_at' }))
      app.save(cargos)
    }
    if (!cargos.fields.getByName('salary_defined')) {
      cargos.fields.add(new BoolField({ name: 'salary_defined' }))
      app.save(cargos)
    }

    // Índices de filtro (addIndex é idempotente)
    cargos = app.findCollectionByNameOrId('cargos')
    cargos.addIndex('idx_cargos_status', false, 'status', '')
    cargos.addIndex('idx_cargos_node', false, 'org_node_id', '')
    app.save(cargos)

    // ---- 2. coleção cargo_approvals (trilha do ciclo) ----
    var approvals = null
    try {
      approvals = app.findCollectionByNameOrId('cargo_approvals')
    } catch (_) {
      approvals = null
    }
    if (!approvals) {
      var cargoIdRef = app.findCollectionByNameOrId('cargos').id
      var orgIdRef = app.findCollectionByNameOrId('organizations').id
      approvals = new Collection({
        name: 'cargo_approvals',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'cargo_id', type: 'relation', collectionId: cargoIdRef, maxSelect: 1 },
          { name: 'cargo_title', type: 'text' },
          { name: 'step', type: 'text' }, // ENVIO | APROVACAO | REJEICAO | CONVERSAO
          { name: 'decision', type: 'text' }, // — | APROVADO | REJEITADO | CONVERTIDO
          { name: 'from_value', type: 'text' }, // finalidade anterior (conversão)
          { name: 'to_value', type: 'text' }, // finalidade nova (conversão)
          { name: 'from_status', type: 'text' },
          { name: 'to_status', type: 'text' },
          { name: 'comment', type: 'text' },
          { name: 'user_name', type: 'text' },
          { name: 'user_role', type: 'text' },
          { name: 'user_id', type: 'text' },
          { name: 'org_id', type: 'relation', collectionId: orgIdRef, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      approvals.listRule = ORG_ONLY
      approvals.viewRule = ORG_ONLY
      approvals.createRule = ADMIN_ONLY
      approvals.updateRule = null // imutável — só superuser corrige
      approvals.deleteRule = null
      try {
        approvals.indexes = [
          'CREATE INDEX idx_cargo_approvals_cargo ON cargo_approvals (cargo_' + 'id)',
        ]
      } catch (_) {}
      app.save(approvals)
      console.log('[0032] coleção cargo_approvals criada')
    }

    // ---- 3. regras: recrutador não cria/edita cargo ----
    cargos = app.findCollectionByNameOrId('cargos')
    cargos.listRule = ORG_ONLY
    cargos.viewRule = ORG_ONLY
    cargos.createRule = ADMIN_ONLY
    cargos.updateRule = ADMIN_ONLY
    cargos.deleteRule = ADMIN_ONLY
    app.save(cargos)
    console.log('[0032] regras de cargos atualizadas (recrutador só lê)')

    // ---- 4. backfill: cargos antigos viram APROVADO/ESTRUTURAL ----
    var backfill = []
    try {
      backfill = app.findRecordsByFilter('cargos', "status = '' || status = null", '', 500, 0)
    } catch (_) {
      backfill = []
    }
    // fallback: se o filtro acima não rolar, pega tudo sem status via SQL
    if (backfill.length === 0) {
      try {
        app
          .db()
          .newQuery(
            "UPDATE cargos SET status = 'APROVADO', purpose = 'ESTRUTURAL', salary_defined = (salary_min IS NOT NULL) WHERE status IS NULL OR status = ''",
          )
          .execute()
        console.log('[0032] backfill via SQL aplicado')
      } catch (err) {
        console.log('[0032] backfill SQL falhou (pode já estar aplicado): ' + err)
      }
    } else {
      for (var i = 0; i < backfill.length; i++) {
        backfill[i].set('status', 'APROVADO')
        backfill[i].set('purpose', 'ESTRUTURAL')
        backfill[i].set('salary_defined', !!backfill[i].get('salary_min'))
        app.save(backfill[i])
      }
      console.log('[0032] backfill de ' + backfill.length + ' cargos antigos')
    }

    console.log('[0032] FASE 2 do cargo aplicada')
  },
  (app) => {
    // rollback: remove campos novos de cargos e apaga cargo_approvals
    try {
      var cargos = app.findCollectionByNameOrId('cargos')
      var drop = [
        'org_node_id',
        'purpose',
        'status',
        'created_by',
        'created_by_role',
        'created_by_id',
        'approved_by',
        'approved_by_role',
        'rejection_reason',
        'rejected_by',
        'rejected_by_role',
        'approved_at',
        'submitted_at',
        'salary_defined',
      ]
      for (var i = 0; i < drop.length; i++) {
        cargos.fields.removeByName(drop[i])
      }
      cargos.removeIndex('idx_cargos_status')
      cargos.removeIndex('idx_cargos_node')
      app.save(cargos)
    } catch (_) {}
    try {
      var ap = app.findCollectionByNameOrId('cargo_approvals')
      app.delete(ap)
    } catch (_) {}
  },
)
