//
// Configuração do agente de score de IA (coleção ai_agent_settings, migs
// 0013/0014/0025/0029). Desde a 0029 a config é POR ORGANIZAÇÃO (org_id) com
// índice único por org, fallback para o registro global (org_id vazio) e
// depois para os defaults de código — a régua de uma org nunca vaza para outra.
// 1. OnRecordValidate: os pesos das três dimensões DEVEM somar 100 — validado
//    server-side (a JSVM de migração não tem onRecordValidate).
// 2. getAgentSettings(app, orgId) fica global (a JSVM não tem module.exports):
//    ai_score.js e ai_score_triggers.js leem $app.getAgentSettings(app, orgId)
//    com o org_id DA VAGA, para decidir se calculam, com quais pesos e qual
//    provedor (defaults: habilitado, 50/30/20, gatilhos on). Sem orgId (usuário
//    de sistema, vaga sem org), cai no registro global/legado sem erro.
//    O retorno traz settings_origin: 'org' | 'global' — registrado no snapshot.
//
$app.getAgentSettings = function (app, orgId) {
  let record = null
  const wantOrg = String(orgId || '')
  if (wantOrg) {
    // 1. config da própria organização; 2. global (org_id vazio) como fallback.
    try {
      record = app.findFirstRecordByFilter('ai_agent_settings', 'org_' + 'id = {:oid}', null, {
        oid: wantOrg,
      })
    } catch (_) {
      record = null
    }
    if (!record) {
      try {
        record = app.findFirstRecordByFilter('ai_agent_settings', 'org_' + 'id = ""')
      } catch (_) {
        record = null
      }
    }
  } else {
    try {
      record = app.findFirstRecordByFilter('ai_agent_settings', 'id != ""')
    } catch (_) {
      record = null
    }
  }
  // Origem: 'org' (config da própria organização) ou 'global' (fallback ou
  // legado — registro único sem org). Vai para o snapshot (weights_source).
  const settingsOrigin =
    record && wantOrg && String(record.get('org_' + 'id') || '') === wantOrg ? 'org' : 'global'

  if (!record) {
    return {
      enabled: true,
      weight_technical: 50,
      weight_behavioral: 30,
      weight_cultural: 20,
      trigger_new_application: true,
      trigger_stage_change: true,
      trigger_disc_completed: true,
      trigger_note_added: true,
    }
  }

  const boolOr = (name, fallback) => {
    const v = record.get(name)
    return typeof v === 'boolean' ? v : fallback
  }
  const intOr = (name, fallback) => {
    const n = Number(record.get(name))
    return isFinite(n) ? Math.round(n) : fallback
  }

  let weights = {
    technical: intOr('weight_technical', 50),
    behavioral: intOr('weight_behavioral', 30),
    cultural: intOr('weight_cultural', 20),
  }
  // Fallback defensivo: soma inválida → padrão.
  if (weights.technical + weights.behavioral + weights.cultural !== 100) {
    weights = { technical: 50, behavioral: 30, cultural: 20 }
  }

  return {
    enabled: boolOr('enabled', true),
    weight_technical: weights.technical,
    weight_behavioral: weights.behavioral,
    weight_cultural: weights.cultural,
    trigger_new_application: boolOr('trigger_new_application', true),
    trigger_stage_change: boolOr('trigger_stage_change', true),
    trigger_disc_completed: boolOr('trigger_disc_completed', true),
    trigger_note_added: boolOr('trigger_note_added', true),
    settings_origin: settingsOrigin,
  }
}

// Pesos EFETIVOS do score: se a vaga da candidatura tem a régua própria
// preenchida (os três campos e soma 100), usa a da vaga; senão, a da config
// da org da vaga (settings_origin diz 'org' | 'global').
// Retorna { weights: {technical, behavioral, cultural}, source: 'job' | 'org' | 'global' }.
$app.resolveScoreWeights = function (job, agentSettings) {
  if (job) {
    const t = Number(job.get('weight_technical'))
    const b = Number(job.get('weight_behavioral'))
    const c = Number(job.get('weight_cultural'))
    if (
      job.get('weight_technical') !== '' &&
      job.get('weight_technical') != null &&
      job.get('weight_behavioral') !== '' &&
      job.get('weight_behavioral') != null &&
      job.get('weight_cultural') !== '' &&
      job.get('weight_cultural') != null &&
      isFinite(t) &&
      isFinite(b) &&
      isFinite(c) &&
      Math.round(t) + Math.round(b) + Math.round(c) === 100
    ) {
      return {
        weights: { technical: Math.round(t), behavioral: Math.round(b), cultural: Math.round(c) },
        source: 'job',
      }
    }
  }
  return {
    weights: {
      technical: agentSettings.weight_technical,
      behavioral: agentSettings.weight_behavioral,
      cultural: agentSettings.weight_cultural,
    },
    source: agentSettings.settings_origin === 'org' ? 'org' : 'global',
  }
}

$app.onRecordValidate('ai_agent_settings').add((e) => {
  const w1 = Number(e.record.get('weight_technical') || 0)
  const w2 = Number(e.record.get('weight_behavioral') || 0)
  const w3 = Number(e.record.get('weight_cultural') || 0)
  if (w1 + w2 + w3 !== 100) {
    throw new BadRequestError(
      'Os pesos das três dimensões devem somar exatamente 100 (atual: ' + (w1 + w2 + w3) + ').',
    )
  }
  e.next()
})
