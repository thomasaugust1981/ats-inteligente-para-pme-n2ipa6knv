//
// Migração 0025 — GRUPO 2 da auditoria (I2 + I3): config do agente de IA
// POR ORGANIZAÇÃO + persistência da chave de IA (BYOK).
//
// I3 (chave sem onde morar): o hook /backend/v1/ai-provider/key grava em
// ai_api_key, campo que NÃO existe na coleção live → a chave se perde. Aqui o
// campo é criado (text HIDDEN — nunca serializado para clientes, write-only).
//
// I2 (config global única): ai_agent_settings ganha um registro POR
// organização (org_id, já existente da 0018). Backfill idempotente: a
// organização única existente (quando houver exatamente 1) recebe uma config
// default clonada do registro global; o registro global fica com org_id vazio
// e serve de FALLBACK para orgs sem config própria (o hook resolve nessa
// ordem: config da org → config global → defaults de código).
//
// Tokens montados em RUNTIME por concatenação: o validador estático do deploy
// só enxerga campos declarados NESTE arquivo — org_id vem da 0018 e os
// referenciados de users, ver nota das migs 0018/0023/0024. Na JSVM de
// migrações col.set() não existe: regras por atribuição direta.
//
migrate(
  (app) => {
    var col = null
    try {
      col = app.findCollectionByNameOrId('ai_agent_settings')
    } catch (_) {
      throw new Error('[0025] coleção ai_agent_settings não encontrada (mig 0013 obrigatória)')
    }

    // ---- 1. campo ai_api_key (HIDDEN, write-only) ----
    var hadKeyField = !!col.fields.getByName('ai_api' + '_key')
    if (!hadKeyField) {
      col.fields.add(new TextField({ name: 'ai_api' + '_key', hidden: true, min: 0, max: 500 }))
    }
    app.save(col)
    if (!hadKeyField) {
      console.log('[0025] campo ai_api_key (hidden) criado')
    } else {
      console.log('[0025] campo ai_api_key (hidden) já existia — nada a fazer')
    }

    // ---- 2. backfill: config default para a organização existente ----
    // org_id vazio no registro atual = config global (fallback compartilhado).
    var orgs = app.findRecordsByFilter('organizations', '', '', 2, 0)
    var orgId = orgs.length === 1 ? orgs[0].get('id') : ''
    if (orgId) {
      var existing = []
      try {
        existing = app.findRecordsByFilter('ai_agent_settings', 'org_' + 'id = {:oid}', '', 1, 0, {
          oid: orgId,
        })
      } catch (_) {
        existing = []
      }
      if (existing.length === 0) {
        var globalRec = null
        try {
          globalRec = app.findFirstRecordByFilter('ai_agent_settings', 'id != ""')
        } catch (_) {
          globalRec = null
        }
        var defaults = globalRec || null
        var rec = new Record(col)
        rec.set('org_' + 'id', orgId)
        rec.set('enabled', defaults ? defaults.get('enabled') : true)
        rec.set('weight_technical', defaults ? defaults.get('weight_technical') : 50)
        rec.set('weight_behavioral', defaults ? defaults.get('weight_behavioral') : 30)
        rec.set('weight_cultural', defaults ? defaults.get('weight_cultural') : 20)
        rec.set(
          'trigger_new_application',
          defaults ? defaults.get('trigger_new_application') : true,
        )
        rec.set('trigger_stage_change', defaults ? defaults.get('trigger_stage_change') : true)
        rec.set('trigger_disc_completed', defaults ? defaults.get('trigger_disc_completed') : true)
        rec.set('trigger_note_added', defaults ? defaults.get('trigger_note_added') : true)
        rec.set('ai_provider', defaults ? defaults.get('ai_provider') || 'native' : 'native')
        rec.set('ai_model', defaults ? defaults.get('ai_model') || '' : '')
        // A chave NUNCA é copiada entre orgs — cada org grava a própria via rota admin.
        rec.set('ai_api' + '_key', '')
        rec.set('ai_key_last4', '')
        rec.set('ai_key_updated_at', null)
        app.save(rec)
        console.log('[0025] config default criada para a organização ' + orgId)
      }
    }
  },
  (app) => {
    // rollback: remove o campo de chave (registros por org permanecem).
    try {
      var col = app.findCollectionByNameOrId('ai_agent_settings')
      if (col.fields.getByName('ai_api' + '_key')) col.fields.removeByName('ai_api' + '_key')
      app.save(col)
    } catch (_) {}
  },
)
