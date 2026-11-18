//
// Migração 0047 — rebrand da organização demo: Vanguard → Ausland/Talent.
// Marca decidida: "Talent" (nome curto), portfólio "Goldway · Talent ·
// Discovery". Limpa nome/slug da organização, nome/website da empresa,
// e-mails @vanguard.com.br dos usuários (mantendo senha e role),
// convites de equipe e owners de etapas — apenas registros de orgs cujos
// dados (empresa/usuários) ainda trazem vestígios de vanguard.
// Idempotente: registros já com a identidade nova não são tocados.
//
migrate(
  (app) => {
    var VANGUARD_EMAIL = '@vanguard.com.br'

    // ---------- 1. Organizações ----------
    var orgs = app.findRecordsByFilter('organizations', '', '', 200, 0)
    var vanguardOrgIds = {}
    for (var i = 0; i < orgs.length; i++) {
      var org = orgs[i]
      var name = org.get('name') || ''
      var slug = org.get('slug') || ''
      var isVanguard =
        name.toLowerCase().indexOf('vanguard') !== -1 || slug.indexOf('vanguard') !== -1
      if (!isVanguard) continue
      vanguardOrgIds[org.get('id')] = true
      org.set('name', 'Ausland')
      org.set('slug', 'ausland')
      app.save(org)
      console.log('0047: organização renomeada → Ausland (' + org.get('id') + ')')
    }

    // ---------- 2. Empresas da organização (vestígios vanguard) ----------
    var companies = app.findRecordsByFilter('companies', '', '', 200, 0)
    for (var c = 0; c < companies.length; c++) {
      var company = companies[c]
      var changed = false
      var cname = company.get('name') || ''
      var trade = company.get('trade_name') || ''
      var website = company.get('website') || ''
      if (cname.toLowerCase().indexOf('vanguard') !== -1) {
        company.set('name', 'Ausland Consultoria & Informatica')
        changed = true
      }
      if (trade.toLowerCase().indexOf('vanguard') !== -1) {
        company.set('trade_name', 'Ausland')
        changed = true
      }
      if (website.indexOf('vanguardtecnologia.com.br') !== -1) {
        company.set('website', 'https://ausland.com.br')
        changed = true
      }
      if (changed) {
        app.save(company)
        console.log('0047: empresa com vestígios vanguard rebranded → Ausland')
      }
    }

    // ---------- 3. Usuários @vanguard.com.br (mantém senha e role) ----------
    var users = app.findRecordsByFilter('_pb_users_auth_', '', '', 200, 0)
    for (var u = 0; u < users.length; u++) {
      var user = users[u]
      var email = user.get('email') || ''
      if (email.toLowerCase().indexOf(VANGUARD_EMAIL) === -1) continue
      var newEmail = email.toLowerCase().replace(VANGUARD_EMAIL, '@ausland.com.br')
      var exists = false
      try {
        app.findAuthRecordByEmail('_pb_users_auth_', newEmail)
        exists = true
      } catch (_) {}
      if (exists) continue // e-mail destino já ocupado — não toca
      user.setEmail(newEmail)
      app.save(user)
      console.log('0047: usuário ' + email + ' → ' + newEmail)
    }
    // company_name de usuários ainda citando Vanguard (mas sem renomear
    // company_name do demo — o valor certo vem da empresa ativa).
    for (var u2 = 0; u2 < users.length; u2++) {
      var user2 = users[u2]
      var cn = user2.get('company_name') || ''
      if (cn.toLowerCase().indexOf('vanguard') === -1) continue
      user2.set('company_name', 'Ausland')
      app.save(user2)
      console.log('0047: company_name do usuário → Ausland (' + user2.get('email') + ')')
    }

    // ---------- 4. Convites de equipe ----------
    var invites = app.findRecordsByFilter('team_invites', '', '', 200, 0)
    for (var t = 0; t < invites.length; t++) {
      var invite = invites[t]
      var email2 = invite.get('email') || ''
      if (email2.toLowerCase().indexOf(VANGUARD_EMAIL) === -1) continue
      invite.set('email', email2.toLowerCase().replace(VANGUARD_EMAIL, '@ausland.com.br'))
      app.save(invite)
    }

    // ---------- 5. Owners de etapas (stage_settings.owner_email) ----------
    var stages = app.findRecordsByFilter('stage_settings', '', '', 500, 0)
    for (var s = 0; s < stages.length; s++) {
      var stage = stages[s]
      var owner = stage.get('owner_email') || ''
      if (owner.toLowerCase().indexOf(VANGUARD_EMAIL) === -1) continue
      stage.set('owner_email', owner.toLowerCase().replace(VANGUARD_EMAIL, '@ausland.com.br'))
      app.save(stage)
      console.log('0047: owner_email da etapa → ' + stage.get('owner_email'))
    }
  },
  (app) => {
    // down: rebrand não é revertido (identidade Ausland/Talent é permanente).
  },
)
