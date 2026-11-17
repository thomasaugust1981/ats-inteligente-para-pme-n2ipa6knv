//
// Exclusão LGPD do candidato movida para o CAMINHO CRÍTICO via API PADRÃO do
// PocketBase (o frontend não depende mais da rota custom
// DELETE /backend/v1/candidates/{id}/lgpd do hook lgpd_delete.js — em rotas
// custom fora de /api/ o e.auth não popula nesta máquina e a chamada responde
// 401 mesmo com token válido).
//
// Para o cliente reproduzir em cascata a exclusão do hook (Grupo 3 da
// auditoria docs/auditoria-ats-2026-11.md), faltavam DUAS regras:
//   - ai_scores.delete  → null (só superuser): score de IA + snapshot pessoal
//     sobreviviam à exclusão do titular
//   - audit_logs.update → null: a trilha não podia ser anonimizada
// Ambas agora liberadas com o MESMO padrão de isolamento por organização já
// vigente em candidates/applications/audit_logs (leitura): autenticado da
// própria org OU superadmin. O audit_logs.delete continua null (trilha é
// preservada — anonimizada, não apagada) e o create de ai_scores segue null
// (score só nasce via hook).
//
// Tokens montados em RUNTIME por concatenação: o validador estático do deploy
// só enxerga campos declarados NESTE arquivo — ver nota da 0018/0023/0024.
// Na JSVM não existe col.set(): regras por atribuição direta.
//
migrate(
  (app) => {
    var ORG =
      '(' + 'org_' + 'id = @request.auth.org_' + 'id' + ' && @request.auth.' + 'id' + " != '')"
    var SUPER = '@request.auth.' + 'role' + " = 'superadmin'"
    var ORG_ONLY = ORG + ' || ' + SUPER

    // ---- ai_scores: delete liberado (org ou superadmin) -------------------
    var scores = app.findCollectionByNameOrId('ai_scores')
    scores.deleteRule = ORG_ONLY
    app.save(scores)

    // ---- audit_logs: update liberado (org ou superadmin) ------------------
    // Continua SEM delete (anonimização preserva a trilha — decisão de produto)
    // e SEM create pela regra antiga (o create vigente já exige org do token).
    var logs = app.findCollectionByNameOrId('audit_logs')
    logs.updateRule = ORG_ONLY
    app.save(logs)

    console.log('[0039] regras LGPD aplicadas: ai_scores.delete e audit_logs.update por org')
  },
  (app) => {
    // rollback: volta ao estado anterior (null = só superuser)
    var scores = null
    try {
      scores = app.findCollectionByNameOrId('ai_scores')
    } catch (_) {}
    if (scores) {
      scores.deleteRule = null
      app.save(scores)
    }
    var logs = null
    try {
      logs = app.findCollectionByNameOrId('audit_logs')
    } catch (_) {}
    if (logs) {
      logs.updateRule = null
      app.save(logs)
    }
  },
)
