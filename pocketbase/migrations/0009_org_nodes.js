migrate(
  (app) => {
    const jobsColId = app.findCollectionByNameOrId('jobs').id

    const orgNodes = new Collection({
      name: 'org_nodes',
      type: 'base',
      // O organograma standalone (iframe em /organograma) não autentica:
      // regras públicas como as coleções de leitura da página de carreiras.
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        // id lógico único do nó, usado pelo organograma para manter referências
        { name: 'node_key', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'role_title', type: 'text' },
        { name: 'area', type: 'text' },
        // id lógico do nó pai (node_key do manager), como no organograma
        { name: 'manager', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'location', type: 'text' },
        {
          name: 'contract_type',
          type: 'select',
          values: ['clt', 'pj', 'internship', 'temporary'],
          maxSelect: 1,
        },
        { name: 'start_date', type: 'date' },
        {
          name: 'status',
          type: 'select',
          values: ['ativo', 'inativo', 'vaga_aberta', 'temporaria'],
          maxSelect: 1,
        },
        { name: 'photo_url', type: 'text' },
        {
          name: 'job_id',
          type: 'relation',
          collectionId: jobsColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        // empresa dona, como nas demais coleções do ATS
        { name: 'company', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_org_nodes_key ON org_nodes (node_key)',
        'CREATE INDEX idx_org_nodes_status ON org_nodes (status)',
        'CREATE INDEX idx_org_nodes_job ON org_nodes (job_id)',
      ],
    })
    app.save(orgNodes)
  },
  (app) => {
    try {
      const orgNodes = app.findCollectionByNameOrId('org_nodes')
      app.delete(orgNodes)
    } catch (_) {}
  },
)
