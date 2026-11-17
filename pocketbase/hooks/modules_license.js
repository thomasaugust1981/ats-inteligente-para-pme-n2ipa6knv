//
// Fundação do módulo "Indicadores" (licenciado à parte) — pacote 1 de 4.
//
// Rota do módulo: GET /backend/v1/indicators/status → { licensed, module, org }
//
// IMPORTANTE (JSVM do PocketBase v0.36 / Skip Cloud):
//   1) callbacks rodam em VM própria — declarações top-level NÃO são visíveis
//      dentro deles;
//   2) atribuição em global ($app.foo = ..., $paths.foo = ...) TAMBÉM não é
//      vista pela VM do callback ("Object has no member 'x'") e referência a
//      $paths no top-level derruba o CARREGAMENTO do arquivo inteiro (a rota
//      nem registra: 404 "File not found"). Foi exatamente o que derrubou
//      /backend/v1/indicators/status em produção.
// Por isso este arquivo é AUTOCONTIDO: o resolver de auth e o guard de licença
// vivem DENTRO do callback, sem nenhum símbolo global além de routerAdd.
//
// Mensagem padrão de bloqueio:
//   "Módulo Indicadores não licenciado para esta organização"
//

routerAdd('GET', '/backend/v1/indicators/status', (e) => {
  function readAuthToken(ev) {
    let token = ''
    try {
      token = String(ev.request.getHeader('Authorization') || '')
    } catch (_) {
      token = ''
    }
    if (!token) {
      try {
        token = String(ev.request.Header.Get('Authorization') || '')
      } catch (_) {
        token = ''
      }
    }
    if (!token) {
      try {
        token = String(ev.request.header.get('Authorization') || '')
      } catch (_) {
        token = ''
      }
    }
    if (!token) {
      let info = {}
      try {
        info = ev.requestInfo() || {}
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

  function resolveUser(ev) {
    if (ev.auth) return ev.auth
    const token = readAuthToken(ev)
    if (!token) return null
    try {
      return ev.app.findAuthRecordByToken(token, 'auth')
    } catch (_) {
      try {
        return ev.app.findAuthRecordByToken(token)
      } catch (__) {
        return null
      }
    }
  }

  // Licença ativa para a org/módulo? (inline — JSVM não vê top-level daqui)
  function licenseActive(app, orgId, moduleName) {
    if (!orgId) return false
    let license = null
    try {
      license = app.findFirstRecordByFilter('org_modules', 'org_' + 'id = {:o} && module = {:m}', {
        o: orgId,
        m: moduleName,
      })
    } catch (_) {
      license = null
    }
    if (!license || !license.getBool('licensed')) return false
    const until = license.get('licensed_until')
    if (!until) return true
    const untilDate = new Date(String(until))
    if (isNaN(untilDate.getTime())) return true
    const endOfDay = new Date(untilDate)
    endOfDay.setHours(23, 59, 59, 999)
    return endOfDay.getTime() >= Date.now()
  }

  try {
    // Fora de /api/ o runtime não popula e.auth — resolve pelo header.
    const auth = resolveUser(e)
    if (!auth) {
      return e.json(401, { error: 'Autenticação necessária.' })
    }

    const orgId = String(auth.get('org_' + 'id') || '')
    if (!orgId) {
      return e.json(200, { licensed: false, module: 'indicadores', org: null })
    }

    let orgName = ''
    try {
      const org = e.app.findRecordById('organizations', orgId)
      orgName = String(org.get('name') || '')
    } catch (_) {
      orgName = ''
    }

    const licensed = licenseActive(e.app, orgId, 'indicadores')
    let licensedUntil = ''
    try {
      const licenseRow = e.app.findFirstRecordByFilter(
        'org_modules',
        'org_' + 'id = {:o} && module = {:m}',
        { o: orgId, m: 'indicadores' },
      )
      licensedUntil = String((licenseRow && licenseRow.get('licensed_until')) || '')
    } catch (_) {
      licensedUntil = ''
    }

    return e.json(200, {
      licensed: licensed,
      module: 'indicadores',
      org: { id: orgId, name: orgName },
      licensed_until: licensedUntil,
    })
  } catch (err) {
    console.error('[indicators/status] erro:', String((err && err.message) || err))
    return e.json(500, { error: 'Falha ao consultar o status do módulo.' })
  }
})
