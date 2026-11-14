//
// Provedor de IA do cliente (BYOK) — $app.computeScore + rotas de chave/teste.
// O cliente pode usar a PRÓPRIA chave da OpenAI/Gemini em vez do agente nativo:
//   • POST /backend/v1/ai-provider/key  { provider, api_key, model }
//       admin grava a chave (o corpo NUNCA volta em nenhuma resposta);
//   • POST /backend/v1/ai-provider/test { provider, api_key, model }
//       admin testa a conexão ANTES de salvar — chamada mínima ao provedor.
// $app.computeScore(app, snapshot, weights) → { score, score_technical,
//   score_behavioral, score_cultural, justification, provider_used } — é usado
// por ai_score.js e ai_score_triggers.js. Com provedor próprio configurado, a
// chamada REST vai direto ao provedor com a chave do cliente; se falhar, cai
// para o agente nativo (provider_used = 'native_fallback_from_<provider>').
// A chave NUNCA aparece em logs, erros ou respostas.
//
// A JSVM executa callbacks em pool separado: helpers ficam globais em $app e
// TODOS os caminhos de saída chamam e.next().
//

$app.getAiProvider = function (app) {
  let record = null
  try {
    record = app.findFirstRecordByFilter('ai_agent_settings', 'id != ""')
  } catch (_) {
    record = null
  }
  const provider = record ? String(record.get('ai_provider') || 'native') : 'native'
  const apiKey = record ? String(record.get('ai_api_key') || '').trim() : ''
  const model = record ? String(record.get('ai_model') || '').trim() : ''
  if (provider !== 'native' && !apiKey) return { provider: 'native', apiKey: '', model: '' }
  return { provider: provider, apiKey: apiKey, model: model }
}

$app.providerModelFor = function (provider, customModel) {
  if (customModel) return customModel
  if (provider === 'openai') return 'gpt-4o-mini'
  if (provider === 'gemini') return 'gemini-2.0-flash'
  return ''
}

// Uma chamada REST ao provedor do cliente. Retorna o texto bruto da resposta.
// Erro (rede, HTTP != 2xx, chave inválida, cota) vira exceção — chamador decide
// o fallback; a mensagem de erro NUNCA inclui a chave.
$app.callOwnProvider = function (provider, apiKey, model, prompt) {
  let url = ''
  let body = null
  let headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey }

  if (provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions'
    body = {
      model: model,
      messages: [
        {
          role: 'system',
          content:
            'Você é um avaliador de candidaturas. Responda APENAS com um JSON válido, sem texto extra.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }
  } else if (provider === 'gemini') {
    url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) +
      ':generateContent?key=' +
      encodeURIComponent(apiKey)
    headers = { 'Content-Type': 'application/json' }
    body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }
  } else {
    throw new Error('unsupported_provider')
  }

  const res = $http.send({
    url: url,
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
    timeout: 60,
  })

  if (res.statusCode < 200 || res.statusCode >= 300) {
    // Só o status do provedor — nunca o corpo (pode ecoar a chave em alguns erros).
    throw new Error('provider_http_' + res.statusCode)
  }
  const raw = typeof res.json === 'string' ? res.json : JSON.stringify(res.json)
  let content = ''
  if (provider === 'openai') {
    const choice = res.json && res.json.choices && res.json.choices[0]
    content = (choice && choice.message && choice.message.content) || ''
  } else {
    const cand = res.json && res.json.candidates && res.json.candidates[0]
    content =
      (cand &&
        cand.content &&
        cand.content.parts &&
        cand.content.parts[0] &&
        cand.content.parts[0].text) ||
      ''
  }
  if (!String(content).trim()) {
    throw new Error('empty_provider_response')
  }
  return String(content)
}

// Extrai o JSON do texto do modelo (o mesmo parse dos dois fluxos existentes).
$app.parseScoreJson = function (rawText) {
  const raw = String(rawText || '').trim()
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('bad_model_output')
  }
  let parsed
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1))
  } catch (_) {
    throw new Error('bad_model_output')
  }
  return parsed
}

// Calcula o score: provedor próprio do cliente (se configurado e funcional),
// com fallback OBRIGATÓRIO ao agente nativo em caso de falha.
$app.computeScore = function (app, snapshot, agentSettings) {
  const weights = agentSettings || {}
  const providerCfg = $app.getAiProvider(app)
  const prompt =
    'Calcule o score de aderência deste candidato para a vaga, usando os dados JSON abaixo. ' +
    'Responda APENAS com JSON no formato: {"score_technical":0-100 ou null,"score_behavioral":0-100 ou null,' +
    '"score_cultural":0-100 ou null,"score":0-100,"justification":"...","insufficient_data":false}. ' +
    'Regras: o score geral É UMA MÉDIA PONDERADA das dimensões disponíveis, usando EXATAMENTE os ' +
    'pesos em snapshot.weights_used (técnica=' +
    (weights.weight_technical !== undefined ? weights.weight_technical : 50) +
    '%, comportamental=' +
    (weights.weight_behavioral !== undefined ? weights.weight_behavioral : 30) +
    '%, cultural=' +
    (weights.weight_cultural !== undefined ? weights.weight_cultural : 20) +
    '%; a soma é 100; ' +
    'redistribua proporcionalmente entre as dimensões disponíveis quando alguma for null). ' +
    'Justificativa OBRIGATÓRIA em português, citando evidências de cada dimensão avaliada. ' +
    'Sem dados de uma dimensão, use null nela. ' +
    'Se faltar quase tudo (nem currículo/skills, nem requisitos da vaga), devolva insufficient_data=true. ' +
    'Score é consultivo — NUNCA aprova ou reprova ninguém, apenas orienta a equipe de recrutamento.' +
    '\n\nDADOS: ' +
    JSON.stringify(snapshot).slice(0, 24000)

  // 1. Provedor próprio do cliente, se configurado.
  if (providerCfg.provider !== 'native' && providerCfg.apiKey) {
    try {
      const model = $app.providerModelFor(providerCfg.provider, providerCfg.model)
      const raw = $app.callOwnProvider(providerCfg.provider, providerCfg.apiKey, model, prompt)
      const parsed = $app.parseScoreJson(raw)
      if (!isFinite(Number(parsed.score)) || !String(parsed.justification || '').trim()) {
        throw new Error('bad_model_output')
      }
      return {
        score: parsed.score,
        score_technical: parsed.score_technical,
        score_behavioral: parsed.score_behavioral,
        score_cultural: parsed.score_cultural,
        justification: parsed.justification,
        provider_used: providerCfg.provider,
      }
    } catch (err) {
      // FALLBACK OBRIGATÓRIO: cai para o agente nativo, marcando no snapshot.
      console.error(
        '[ai-provider] falha no provedor próprio (' +
          providerCfg.provider +
          '), caindo para o agente nativo:',
        err,
      )
      const fallbackProvider = 'native_fallback_from_' + providerCfg.provider
      const parsed = $app.callNativeAgent(prompt)
      return {
        score: parsed.score,
        score_technical: parsed.score_technical,
        score_behavioral: parsed.score_behavioral,
        score_cultural: parsed.score_cultural,
        justification: parsed.justification,
        provider_used: fallbackProvider,
      }
    }
  }

  // 2. Agente nativo (padrão).
  const parsed = $app.callNativeAgent(prompt)
  return {
    score: parsed.score,
    score_technical: parsed.score_technical,
    score_behavioral: parsed.score_behavioral,
    score_cultural: parsed.score_cultural,
    justification: parsed.justification,
    provider_used: 'native',
  }
}

$app.callNativeAgent = function (prompt) {
  const serviceUser = $app.findAuthRecordByEmail('users', 'ai-service@ats.internal')
  const aiResult = $ai.agent('candidate-scorer').chat({
    user_id: serviceUser.id,
    message: prompt,
  })
  const parsed = $app.parseScoreJson((aiResult && aiResult.content) || '')
  if (!isFinite(Number(parsed.score)) || !String(parsed.justification || '').trim()) {
    throw new Error('bad_model_output')
  }
  return parsed
}

// -------- Rotas administrativas (chave write-only + teste de conexão) --------
// A JSVM executa callbacks em pool separado: helpers ficam DENTRO do callback.

routerAdd('POST', '/backend/v1/ai-provider/key', (e) => {
  function requireAdmin() {
    const auth = e.auth
    if (!auth) {
      e.json(401, { error: 'Autenticação necessária.' })
      return false
    }
    if (String(auth.get('role') || '') !== 'admin') {
      e.json(403, { error: 'Apenas administradores podem gerenciar o provedor de IA.' })
      return false
    }
    return true
  }
  try {
    if (!requireAdmin()) {
      e.next()
      return
    }
    const body = e.requestInfo().body
    const provider = String(body.provider || '').trim()
    const apiKey = String(body.api_key || '').trim()
    const model = String(body.model || '').trim()

    if (provider !== 'native' && provider !== 'openai' && provider !== 'gemini') {
      e.json(400, { error: 'Provedor inválido — use native, openai ou gemini.' })
      e.next()
      return
    }

    let record = null
    try {
      record = e.app.findFirstRecordByFilter('ai_agent_settings', 'id != ""')
    } catch (_) {
      record = null
    }
    if (!record) {
      e.json(404, { error: 'Configuração do agente não encontrada.' })
      e.next()
      return
    }

    record.set('ai_provider', provider)
    if (provider === 'native') {
      // Nativo não usa chave — limpa qualquer chave gravada.
      record.set('ai_api_key', '')
      record.set('ai_key_last4', '')
      record.set('ai_key_updated_at', null)
      record.set('ai_model', '')
    } else {
      if (apiKey) {
        record.set('ai_api_key', apiKey)
        record.set('ai_key_last4', apiKey.slice(-4))
        record.set('ai_key_updated_at', new Date().toISOString())
      } else if (!record.get('ai_api_key')) {
        e.json(400, { error: 'Informe a chave de API do provedor escolhido.' })
        e.next()
        return
      }
      record.set('ai_model', model)
    }
    e.app.save(record)

    e.json(200, {
      ok: true,
      provider: provider,
      ai_key_last4: record.get('ai_key_last4') || '',
      ai_key_updated_at: record.get('ai_key_updated_at') || '',
      ai_model: record.get('ai_model') || '',
    })
    e.next()
  } catch (err) {
    console.error('[ai-provider] erro ao gravar chave:', err)
    e.json(500, { error: 'Falha ao gravar a configuração do provedor.' })
    e.next()
  }
})

routerAdd('POST', '/backend/v1/ai-provider/test', (e) => {
  function requireAdmin() {
    const auth = e.auth
    if (!auth) {
      e.json(401, { error: 'Autenticação necessária.' })
      return false
    }
    if (String(auth.get('role') || '') !== 'admin') {
      e.json(403, { error: 'Apenas administradores podem gerenciar o provedor de IA.' })
      return false
    }
    return true
  }
  try {
    if (!requireAdmin()) {
      e.next()
      return
    }
    const body = e.requestInfo().body
    const provider = String(body.provider || '').trim()
    let apiKey = String(body.api_key || '').trim()
    const model = String(body.model || '').trim()

    if (provider !== 'openai' && provider !== 'gemini') {
      e.json(400, {
        error: 'Escolha OpenAI ou Gemini para testar a conexão (o Nativo não usa chave própria).',
      })
      e.next()
      return
    }

    // Sem chave no payload → usa a já gravada (troca de modelo sem redigitar).
    if (!apiKey) {
      try {
        const cfg = $app.getAiProvider(e.app)
        if (cfg.provider === provider && cfg.apiKey) {
          apiKey = cfg.apiKey
        }
      } catch (_) {}
    }
    if (!apiKey) {
      e.json(400, { error: 'Informe a chave de API para testar a conexão.' })
      e.next()
      return
    }

    const modelResolved = $app.providerModelFor(provider, model)
    const res = $http.send({
      url:
        provider === 'openai'
          ? 'https://api.openai.com/v1/chat/completions'
          : 'https://generativelanguage.googleapis.com/v1beta/models/' +
            encodeURIComponent(modelResolved) +
            ':generateContent?key=' +
            encodeURIComponent(apiKey),
      method: 'POST',
      headers:
        provider === 'openai'
          ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey }
          : { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        provider === 'openai'
          ? {
              model: modelResolved,
              messages: [{ role: 'user', content: 'Responda apenas: ok' }],
              max_tokens: 5,
            }
          : {
              contents: [{ parts: [{ text: 'Responda apenas: ok' }] }],
              generationConfig: { maxOutputTokens: 5 },
            },
      ),
      timeout: 30,
    })

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const friendly =
        res.statusCode === 401 || res.statusCode === 403
          ? 'Chave inválida ou sem permissão para o modelo escolhido.'
          : res.statusCode === 429
            ? 'Cota excedida na conta do provedor — verifique o plano/faturamento.'
            : 'O provedor respondeu com erro (HTTP ' + res.statusCode + ').'
      e.json(200, { ok: false, error: friendly, status: res.statusCode })
      e.next()
      return
    }

    e.json(200, {
      ok: true,
      provider: provider,
      model: modelResolved,
      message: 'Conexão OK — o provedor respondeu ao modelo ' + modelResolved + '.',
    })
    e.next()
  } catch (err) {
    console.error('[ai-provider] erro no teste de conexão:', err)
    e.json(200, {
      ok: false,
      error: 'Não foi possível conectar ao provedor (rede ou chave inválida).',
    })
    e.next()
  }
})
