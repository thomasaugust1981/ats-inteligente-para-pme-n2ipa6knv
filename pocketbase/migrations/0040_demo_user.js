// 0040 — Usuário de demonstração comercial.
//
// Cria (ou atualiza, se já existir) o usuário demo@ausland.com.br na
// organização principal (5b6gmefpzpei7bh), papel 'admin', e-mail verificado.
//
// Idempotente: localiza por e-mail; se existir, apenas garante
// senha/papel/org/nome e segue. Nunca roda como superadmin (o papel é fixo
// 'admin' — quem recebe este acesso não provisiona outras organizações).
//
// A senha fica nesta migração (backend) — o frontend só recebe o E-MAIL
// demo via constante (a senha demo também via constante, pois é conta de
// demonstração sem dado real).

migrate(
  (app) => {
    const DEMO_EMAIL = 'demo@ausland.com.br'
    const DEMO_PASSWORD = 'demo1234'
    const DEMO_ORG_ID = '5b6gmefpzpei7bh'

    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    let demoUser = null
    try {
      demoUser = app.findAuthRecordByEmail('_pb_users_auth_', DEMO_EMAIL)
    } catch (_) {
      demoUser = null
    }

    if (demoUser) {
      // Já existe: garantir senha/papel/org/nome e seguir (idempotente).
      demoUser.setPassword(DEMO_PASSWORD)
      demoUser.setVerified(true)
      demoUser.set('role', 'admin')
      demoUser.set('name', 'Usuário Demonstração')
      demoUser.set('company_name', 'Vanguard Soluções PME')
      demoUser.set('org_id', DEMO_ORG_ID)
      app.save(demoUser)
      console.log('[0040] usuário demo atualizado: ' + DEMO_EMAIL)
      return
    }

    // Não existe: criar.
    demoUser = new Record(users)
    demoUser.setEmail(DEMO_EMAIL)
    demoUser.setPassword(DEMO_PASSWORD)
    demoUser.setVerified(true)
    demoUser.set('name', 'Usuário Demonstração')
    demoUser.set('role', 'admin')
    demoUser.set('company_name', 'Vanguard Soluções PME')
    demoUser.set('org_id', DEMO_ORG_ID)
    app.save(demoUser)
    console.log('[0040] usuário demo criado: ' + DEMO_EMAIL)
  },
  (app) => {
    try {
      const demoUser = app.findAuthRecordByEmail('_pb_users_auth_', 'demo@ausland.com.br')
      app.delete(demoUser)
      console.log('[0040 down] usuário demo removido')
    } catch (_) {
      // nada a fazer — nunca existiu
    }
  },
)
