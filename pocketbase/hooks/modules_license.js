//
// Fundação do módulo "Indicadores" (licenciado à parte) — pacote 1 de 4.
//
// Rota do módulo: GET /backend/v1/indicators/status → { licensed, module, org }
//
// IMPORTANTE (JSVM do PocketBase): callbacks rodam em um pool de VMs separado
// — declarações de nível superior NÃO são visíveis dentro deles. Por isso
// toda a lógica do guard vive inline no callback, e o guard reutilizável
// para as rotas dos pacotes 2–4 é exposto em $paths.indicatorsLicense
// (const global persistida): copie o bloco "GUARD (copiar nas rotas futuras)"
// ou chame $paths.indicatorsLicense(app, orgId).
//
// Mensagem padrão de bloqueio:
//   "Módulo Indicadores não licenciado para esta organização"
//

/**
 * Licença ativa para a org/módulo? (helper global — usável fora de callbacks,
 * e reexposto em $paths para uso DENTRO de callbacks nos pacotes 2–4)
 */
function indicatorsLicenseActive(app, orgId, moduleName) {
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

// Guard reutilizável dentro de callbacks (JSVM: top-level não é visível lá).
$paths.indicatorsLicenseActive = indicatorsLicenseActive

routerAdd('GET', '/backend/v1/indicators/status', (e) => {
  // Fora de /api/ o runtime não popula e.auth — resolve pelo header
  // ($app.resolveAuthUser, definido em menu_order_server.js).
  const auth = $app.resolveAuthUser(e)
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

  // Mesma lógica de indicatorsLicenseActive, inline (JSVM não vê top-level
  // dentro do callback): licença existente + licensed=true + validade OK.
  let licensed = false
  let licensedUntil = ''
  try {
    const license = e.app.findFirstRecordByFilter(
      'org_modules',
      'org_' + 'id = {:o} && module = {:m}',
      { o: orgId, m: 'indicadores' },
    )
    if (license && license.getBool('licensed')) {
      licensed = true
      licensedUntil = String(license.get('licensed_until') || '')
      if (licensedUntil) {
        const d = new Date(licensedUntil)
        if (!isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999)
          if (d.getTime() < Date.now()) licensed = false
        }
      }
    }
  } catch (_) {
    licensed = false
  }

  return e.json(200, {
    licensed: licensed,
    module: 'indicadores',
    org: { id: orgId, name: orgName },
    licensed_until: licensedUntil,
  })
})
