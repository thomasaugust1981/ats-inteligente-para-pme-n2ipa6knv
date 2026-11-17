//
// Ordem do menu lateral POR USUÁRIO — rota dedicada de leitura/gravação.
//
// Por que não PATCH direto em /api/collections/users/records/{id}: em produção
// esse par voltou 404 ("The requested resource wasn't found") para o próprio
// usuário autenticado — PocketBase responde 404 (não 403) quando a regra
// esconde o registro ou o token do authStore está expirado/stale, o que deixava
// o toast "Não foi possível salvar a ordem do menu". Aqui o servidor grava no
// registro do PRÓPRIO usuário autenticado, sem depender de regra de update da
// coleção nem do id vindo do cliente.
//
//   GET  /backend/v1/menu-order   → { menu_order: [...] | null }
//   POST /backend/v1/menu-order   body { menu_order: [...] | null }
//
// AUTENTICAÇÃO EM ROTA CUSTOM FORA DE /api/ (v0.0.81): em produção o middleware
// global pbLoadAuthToken não popula e.auth nestas rotas — todas as chamadas
// voltavam 401 "Autenticação necessária." com o usuário logado e o MESMO token
// funcionando nas rotas /api/collections. O handler então resolve o usuário
// manualmente a partir do header Authorization (mesmo efeito do loadAuthToken
// nativo): token puro do authStore ou "Bearer <token>", ambos aceitos.
//
// JSVM: cada callback roda em VM própria — declarações top-level NÃO são
// visíveis dentro deles. Os helpers ficam em globais ($app.*), padrão já usado
// por ai_provider.js, e cada callback tenta e.auth primeiro e depois o header.
// Ids validados server-side contra a lista canônica (DEFAULT_NAV_IDS de
// src/lib/navModel.ts).
//

// Lê o token do header Authorization do request (todas as grafias que a JSVM
// já expôs entre versões: getHeader, Header.Get, header.get) e, em último
// caso, requestInfo().headers (chaves minúsculas).
$app.readAuthTokenFromRequest = function (e) {
  let token = ''
  try {
    token = String(e.request.getHeader('Authorization') || '')
  } catch (_) {
    token = ''
  }
  if (!token) {
    try {
      token = String(e.request.Header.Get('Authorization') || '')
    } catch (_) {
      token = ''
    }
  }
  if (!token) {
    try {
      token = String(e.request.header.get('Authorization') || '')
    } catch (_) {
      token = ''
    }
  }
  if (!token) {
    let info = {}
    try {
      info = e.requestInfo() || {}
    } catch (_) {
      info = {}
    }
    const hh = (info && info.headers) || {}
    let v = hh['authorization'] || hh['Authorization'] || ''
    if (Array.isArray(v)) v = v.length > 0 ? v[0] : ''
    token = String(v || '')
  }
  token = String(token).trim()
  if (token.toLowerCase().lastIndexOf('bearer ', 0) === 0) {
    token = token.slice(7).trim()
  }
  return token
}

// Resolve o registro do usuário a partir do token (tipo 'auth' = token de
// autenticação, não de reset/verificação). Nulo/erro → null.
$app.findAuthUserByToken = function (e, token) {
  if (!token) return null
  try {
    return e.app.findAuthRecordByToken(token, 'auth')
  } catch (_) {
    try {
      return e.app.findAuthRecordByToken(token)
    } catch (__) {
      return null
    }
  }
}

// e.auth quando o runtime preenche; senão, resolvedor manual pelo header.
// Nome neutro ($app.resolveAuthUser) — REUSADO por modules_license.js e
// indicators_server.js nas demais rotas /backend/v1/* (mesmo problema de 401).
$app.resolveAuthUser = function (e) {
  if (e.auth) return e.auth
  return $app.findAuthUserByToken(e, $app.readAuthTokenFromRequest(e))
}
$app.resolveMenuOrderUser = $app.resolveAuthUser

routerAdd('GET', '/backend/v1/menu-order', (e) => {
  const auth = $app.resolveMenuOrderUser(e)
  if (!auth) return e.json(401, { error: 'Autenticação necessária — faça login novamente.' })

  const raw = auth.get('menu_order')
  let order = null
  if (Array.isArray(raw)) {
    order = []
    for (let i = 0; i < raw.length; i++) {
      if (typeof raw[i] === 'string') order.push(raw[i])
    }
  }
  return e.json(200, { menu_order: order })
})

routerAdd('POST', '/backend/v1/menu-order', (e) => {
  const auth = $app.resolveMenuOrderUser(e)
  if (!auth) return e.json(401, { error: 'Autenticação necessária — faça login novamente.' })

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
    console.error('[menu-order] falha ao gravar menu_order:', String((err && err.message) || err))
    return e.json(500, {
      error: 'Falha ao salvar a ordem do menu: ' + String((err && err.message) || err),
    })
  }
  return e.json(200, { menu_order: next })
})
