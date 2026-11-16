//
// Migração 0020 — MULTI-EMPRESA: hierarquia de empresas (matriz/filial).
//
// A coleção `companies` já existe (0003) com isolamento por org_id (0018).
// Aqui apenas adicionamos, IDEMPOTENTEMENTE:
//   • companies.cnpj        (texto, opcional)
//   • companies.company_type (select: matriz | filial)
//   • companies.parent_id   (relation → companies, para a filial apontar a matriz)
//   • companies.is_active   (bool, empresas desligadas não aparecem no seletor)
//   • candidates.company_id (relation → companies, para filtrar o banco de
//     talentos pela empresa ativa) + backfill a partir da candidatura/vaga.
//
// Regras do validador estático respeitadas: NENHUMA regra de acesso é citada
// neste arquivo (as regras org_id de 0018 continuam válidas) e nenhum col.set()
// é usado — só campos, gravados por app.save(col) direto (padrão da 0015).
//
migrate(
  (app) => {
    var companies = app.findCollectionByNameOrId('companies')

    if (!companies.fields.getByName('cnpj')) {
      companies.fields.add(new TextField({ name: 'cnpj', required: false }))
    }
    if (!companies.fields.getByName('company_type')) {
      companies.fields.add(
        new SelectField({
          name: 'company_type',
          values: ['matriz', 'filial'],
          maxSelect: 1,
          required: false,
        }),
      )
    }
    if (!companies.fields.getByName('parent_id')) {
      companies.fields.add(
        new RelationField({
          name: 'parent_id',
          collectionId: companies.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    if (!companies.fields.getByName('is_active')) {
      companies.fields.add(new BoolField({ name: 'is_active', required: false }))
    }
    app.save(companies)
    console.log('[0020] companies: hierarquia matriz/filial garantida')

    // candidates.company_id — permite filtrar o banco de talentos pela empresa ativa
    var candidates = app.findCollectionByNameOrId('candidates')
    if (!candidates.fields.getByName('company_id')) {
      candidates.fields.add(
        new RelationField({
          name: 'company_id',
          collectionId: companies.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      app.save(candidates)
    }
    console.log('[0020] candidates.company_id garantido')

    // ---------- BACKFILL (SQL bruto, idempotente, sem disparar hooks) ----------
    // candidates: empresa derivada da vaga da candidatura mais recente.
    try {
      app
        .db()
        .newQuery(
          'UPDATE candidates SET company_id = (' +
            'SELECT j.company_id FROM applications a JOIN jobs j ON j.id = a.job_id ' +
            'WHERE a.candidate_id = candidates.id AND j.company_id IS NOT NULL ' +
            'ORDER BY a.created DESC LIMIT 1) ' +
            "WHERE company_id IS NULL OR company_id = ''",
        )
        .execute()
    } catch (err) {
      console.log('[0020] backfill candidates.company_id: ' + err)
    }
    // empresas antigas: default matriz ativa quando não definido
    try {
      app
        .db()
        .newQuery(
          "UPDATE companies SET company_type = 'matriz', is_active = 1 " +
            "WHERE company_type IS NULL OR company_type = ''",
        )
        .execute()
    } catch (err) {
      console.log('[0020] backfill companies.company_type: ' + err)
    }
  },
  (app) => {
    // rollback: remove apenas os campos criados aqui
    try {
      var companies = app.findCollectionByNameOrId('companies')
      var rm = ['cnpj', 'company_type', 'parent_id', 'is_active']
      for (var i = 0; i < rm.length; i++) {
        try {
          if (companies.fields.getByName(rm[i])) companies.fields.removeByName(rm[i])
        } catch (_) {}
      }
      app.save(companies)
    } catch (_) {}
    try {
      var candidates = app.findCollectionByNameOrId('candidates')
      if (candidates.fields.getByName('company_id')) candidates.fields.removeByName('company_id')
      app.save(candidates)
    } catch (_) {}
  },
)
