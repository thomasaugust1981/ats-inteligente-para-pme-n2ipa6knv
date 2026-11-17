//
// Diagnóstico do 404 persistente em PATCH /api/collections/companies/records/{id}
// (onboarding "Erro ao salvar: The requested resource wasn't found").
//
// A regra de update da coleção é (org_id = @request.auth.org_id && id != '') ||
// superadmin — correta, e os dados conferem no banco (usuário e empresa com
// org_id = 5b6gmefpzpei7bh). O 404 do PocketBase significa "a REGRA escondeu o
// registro", o que só acontece quando o auth NÃO resolve na hora da avaliação.
// Este hook prova em qual dos casos a requisição cai, logando no stream
// "hooks" do backend:
//   [companies-auth] POPULADO  → auth resolveu, usuário/org — problema não é token
//   [companies-auth] VAZIO     → chegou SEM auth (sem header ou token morto) —
//                                a regra esconde o registro → 404 igual ao visto
//
// Não altera a resposta: sempre e.next(), inclusive para superuser (admin
// do painel), onde req.auth é null por design.
//
routerAdd('GET', '/backend/v1/debug/companies-auth', (e) => {
  const info = e.requestInfo()
  const hasHeader = !!(info && info.headers && info.headers.authorization)
  console.log(
    '[companies-auth] rota de diagnóstico chamada — auth header presente:',
    hasHeader,
    '| auth populado:',
    !!e.auth,
  )
  return e.json(200, { authPopulated: !!e.auth })
})

onRecordUpdateRequest((e) => {
  let auth = null
  try {
    auth = e.auth
  } catch (_) {
    auth = null
  }
  let org = ''
  let role = ''
  let id = ''
  if (auth) {
    try {
      id = String(auth.get('id') || '')
      org = String(auth.get('org_id') || '')
      role = String(auth.get('role') || '')
    } catch (_) {}
  }
  let bodyKeys = ''
  try {
    const body = (e.requestInfo() && e.requestInfo().body) || {}
    bodyKeys = Object.keys(body).join(',')
  } catch (_) {}
  console.log(
    '[companies-auth] PATCH companies/' +
      e.record.id +
      ' | authPopulado=' +
      !!auth +
      ' | user=' +
      (id || '—') +
      ' | org=' +
      (org || '—') +
      ' | role=' +
      (role || '—') +
      ' | campos=' +
      (bodyKeys || '—'),
  )
  e.next()
}, 'companies')

onRecordCreateRequest((e) => {
  console.log(
    '[companies-auth] POST companies | authPopulado=' +
      !!e.auth +
      ' | user=' +
      (e.auth ? String(e.auth.get('id') || '—') : '—'),
  )
  e.next()
}, 'companies')
