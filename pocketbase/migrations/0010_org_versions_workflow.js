//
// Versionamento + workflow de aprovação do Organograma (ATS Inteligente).
//
// Coleção org_versions — cada alteração estrutural gera uma nova versão,
// nunca sobrescrevendo a vigente. Estados:
//   RASCUNHO → EM_APROVACAO → APROVADA (vigente) → SUBSTITUIDA (histórica) e
//   REJEITADA (devolve para RASCUNHO com o motivo).
// Regra inviolável: apenas UMA versão APROVADA por vez — ao aprovar uma nova,
// a anterior passa automaticamente a SUBSTITUIDA (o cliente garante; o índice
// idx abaixo é a defesa final).
//
// Coleção org_approvals — trilha de auditoria de cada decisão (usuário, papel,
// data/hora, decisão, comentário) e das transições (envio/retorno/publish).
//
// Compatibilidade com o ATS: org_nodes permanece intocado e continua sendo a
// cópia de trabalho espelhada na versão VIGENTE (hook org_nodes_sync cria nós
// de vaga aberta nela; o organograma publica a versão vigente para org_nodes).
//
migrate(
  (app) => {
    const versions = new Collection({
      name: 'org_versions',
      type: 'base',
      // Mesma política pública do organograma standalone (iframe sem auth).
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        // v1, v2, v3 — sequencial por empresa
        { name: 'version_number', type: 'number', required: true, onlyInt: true, min: 1 },
        { name: 'label', type: 'text', max: 120 },
        {
          name: 'status',
          type: 'select',
          values: ['RASCUNHO', 'EM_APROVACAO', 'APROVADA', 'SUBSTITUIDA', 'REJEITADA'],
          required: true,
          maxSelect: 1,
        },
        // snapshot completo dos nós: JSON [{id,parentId,nome,cargo,area,...}]
        { name: 'nodes_json', type: 'text' },
        { name: 'company', type: 'text' },
        { name: 'created_by', type: 'text' },
        { name: 'created_by_role', type: 'text' },
        // quem enviou para aprovação / quando (último ciclo)
        { name: 'submitted_by', type: 'text' },
        { name: 'submitted_at', type: 'date' },
        { name: 'published_at', type: 'date' },
        // motivo da última rejeição (exibido ao autor)
        { name: 'rejection_reason', type: 'text' },
        { name: 'rejected_by', type: 'text' },
        { name: 'rejected_by_role', type: 'text' },
        // papel do próximo aprovador esperado: 'Gerente de RH' | 'Gerente Administrativo'
        { name: 'next_approver_role', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_org_versions_company ON org_versions (company)',
        'CREATE INDEX idx_org_versions_status ON org_versions (company, status)',
      ],
    })
    app.save(versions)

    const approvals = new Collection({
      name: 'org_approvals',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'version_number', type: 'number', required: true, onlyInt: true },
        { name: 'company', type: 'text' },
        // APROVACAO_1 | APROVACAO_2 | ENVIO | PUBLICACAO | REJEICAO | RETORNO
        {
          name: 'step',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['APROVACAO_1', 'APROVACAO_2', 'ENVIO', 'PUBLICACAO', 'REJEICAO', 'RETORNO'],
        },
        // decisão: APROVADO | REJEITADO | —  (transições sem decisão usam '—')
        {
          name: 'decision',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['APROVADO', 'REJEITADO', '—'],
        },
        { name: 'user_name', type: 'text' },
        { name: 'user_role', type: 'text' },
        { name: 'comment', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_org_approvals_version ON org_approvals (company, version_number)',
      ],
    })
    app.save(approvals)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('org_approvals'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('org_versions'))
    } catch (_) {}
  },
)
