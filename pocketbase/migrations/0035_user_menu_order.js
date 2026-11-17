// Migração 0035 — preferência de ordem do menu lateral POR USUÁRIO.
//
// Cada usuário arrasta os itens do menu (src/components/SidebarNav.tsx) para
// uma ordem própria. A ordem é gravada como lista de ids de rota em um campo
// JSON do próprio usuário (users.menu_order) — o mecanismo mais simples e
// idempotente: sem coleção nova, sem join, isolado por id do usuário.
//
// Ids válidos hoje (DEFAULT_NAV_IDS em src/lib/navModel.ts):
//   dashboard, vagas, pipeline, candidatos, cargos, estrutura, indicadores,
//   organograma, integracoes, agente-score, superadmin, onboarding.
// A preferência pode conter só uma parte (ex.: migrado de versão anterior);
// o frontend completa os itens que faltam na ordem padrão e ignora ids que o
// usuário não pode mais ver (item sumiu / sem permissão / licença inativa).
//
// NOTA (validador estático): este arquivo não referencia regras — só adiciona
// um campo JSON opcional ao usuário autenticado, então não há token de regra
// para montar em runtime.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (users.fields.getByName('menu_order')) return
    const field = new JSONField({
      name: 'menu_order',
      maxSize: 8192,
    })
    users.fields.add(field)
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('menu_order')) return
    const field = users.fields.getByName('menu_order')
    users.fields.remove(field)
    app.save(users)
  },
)
