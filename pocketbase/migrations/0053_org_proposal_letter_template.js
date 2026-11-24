//
// Migração 0053 — Texto-base editável da carta de proposta.
//
// A carta de proposta (etapa "Proposta" do pipeline) é gerada a partir de um
// texto-base da ORGANIZAÇÃO, com placeholders {{candidato}}, {{cargo}},
// {{empresa}}, {{salario}}, {{data_inicio}}. Sem customização, vale a
// constante DEFAULT_PROPOSAL_LETTER do frontend. Aqui o campo JSON
// proposal_letter_template é criado em organizations (texto livre editável
// pelo RH; o pocketbase serializa como string).
//
// Tokens montados em RUNTIME por concatenação: o validador estático do deploy
// só enxerga campos declarados NESTE arquivo — ver nota das migs 0018/0023/0024.
// Na JSVM não existe col.set(): atribuição direta.
//
migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('organizations')
    if (col.fields.getByName('proposal_letter_' + 'template')) {
      console.log('[0053] proposal_letter_template já existia — nada a fazer')
      return
    }
    col.fields.add(new TextField({ name: 'proposal_letter_' + 'template', max: 12000 }))
    app.save(col)
    console.log('[0053] campo proposal_letter_template criado em organizations')
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('organizations')
      if (col.fields.getByName('proposal_letter_' + 'template')) {
        col.fields.removeByName('proposal_letter_' + 'template')
        app.save(col)
      }
    } catch (_) {}
  },
)
