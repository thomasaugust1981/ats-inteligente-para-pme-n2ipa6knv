//
// Ordem do menu lateral POR USUÁRIO — rota dedicada de leitura/gravação.
//
// Por que não PATCH direto em /api/collections/users/records/{id}: em produção
// esse par voltou 404 ("The requested resource wasn't found") para o próprio
// usuário autenticado — PocketBase responde 404 (não 403) quando a regra
// esconde o registro ou o token do authStore está expirado/stale, o que deixava
// o toast "Não foi possível salvar a ordem do menu". Aqui o servidor grava no
// registro do PRÓPRIO usuário autenticado (e.auth.id), sem depender de regra
// de update da coleção nem do id vindo do cliente.
//
//   GET  /backend/v1/menu-order   → { menu_order: [...] | null }
//   POST /backend/v1/menu-order   body { menu_order: [...] | null }
//
// JSVM: cada callback roda em VM própria — nada de top-level referenciado de
// dentro do callback. Ids validados server-side contra a lista canônica
// (DEFAULT_NAV_IDS de src/lib/navModel.ts).
//
routerAdd(
  'GET',
  '/backend/v1/menu-order',
  (e) => {
    const auth = e.auth
    if (!auth) return e.json(401, { error: 'Autenticação necessária.' })
    const raw = auth.get('menu_order')
    let order = null
    if (Array.isArray(raw)) {
      order = []
      for (let i = 0; i < raw.length; i++) {
        if (typeof raw[i] === 'string') order.push(raw[i])
      }
    }
    return e.json(200, { menu_order: order })
  },
  /*middlewares=*/ null,
)

routerAdd(
  'POST',
  '/backend/v1/menu-order',
  (e) => {
    const auth = e.auth
    if (!auth) return e.json(401, { error: 'Autenticação necessária.' })

    let info = {}
    try {
      info = e.requestInfo() || {}
    } catch (_) {
      info = {}
    }
    const body = (info && info.body) || {}

    // null/undefined = restaura o padrão; array = lista de ids de rota.
    let next = null
    if (Array.isArray(body.menu_order)) {
      // Ids válidos hoje (DEFAULT_NAV_IDS em src/lib/navModel.ts). Ids
      // desconhecidos são descartados; a ordem final fica a cargo do frontend,
      // que completa itens ausentes na ordem padrão (applySavedOrder).
      const VALID = [
        'dashboard',
        'vagas',
        'pipeline',
        'candidatos',
        'cargos',
        'estrutura',
        'indicadores',
        'organograma',
        'integracoes',
        'agente-score',
        'superadmin',
        'onboarding',
      ]
      const seen = {}
      next = []
      for (let i = 0; i < body.menu_order.length; i++) {
        const v = body.menu_order[i]
        if (typeof v !== 'string') continue
        if (!VALID.includes(v) || seen[v]) continue
        seen[v] = true
        next.push(v)
      }
      if (next.length === 0) next = null
    } else if (body.menu_order !== undefined && body.menu_order !== null) {
      return e.json(400, { error: 'menu_order deve ser uma lista de ids ou null.' })
    }

    try {
      const rec = e.app.findRecordById('users', auth.id)
      rec.set('menu_order', next)
      e.app.save(rec)
    } catch (err) {
      return e.json(500, { error: 'Falha ao salvar a ordem do menu: ' + err })
    }
    return e.json(200, { menu_order: next })
  },
  /*middlewares=*/ null,
)
