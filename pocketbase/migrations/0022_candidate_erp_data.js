//
// Dados admissionais coletados pelo RH na etapa "Integração ERP" do funil.
// Um único campo JSON em candidates — `erp_data` — guarda os dados do layout
// Goldway "Cadastro Profissional" que o ATS não coleta (PIS, CTPS, banco,
// agência, tipo de conta, conta/dígito, salário contratado, CBO, data de
// admissão, tipo de vínculo etc.). Idempotente: só adiciona se não existir.
//

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('candidates')
    if (!col.fields.getByName('erp_data')) {
      col.fields.add(new JSONField({ name: 'erp_data', maxSize: 2000000 }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('candidates')
    try {
      if (col.fields.getByName('erp_data')) {
        col.fields.remove('erp_data')
      }
    } catch (_) {}
    app.save(col)
  },
)
