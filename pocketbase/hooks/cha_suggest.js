//
// Sugestão de CHA por IA — POST /backend/v1/cha/suggest
// Recebe { title, area, level, mission } e devolve uma SUGESTÃO editável de
// Conhecimentos/Habilidades/Atitudes (itens com description + weight 1-5 + required).
// Usa a MESMA infra do score: provedor próprio da org (ai_agent_settings, via
// $app.getAiProvider) e fallback ao agente nativo 'candidate-scorer'.
// A sugestão NUNCA grava em cargos/jobs — só volta na resposta; o usuário revisa
// e aplica no formulário (CargoFormDialog / JobFormPage).
//
// Padrões do projeto respeitados:
//  - helpers DENTRO do callback (JSVM não compartilha globais entre callbacks);
//  - auth com resolver próprio ($app.resolveAuthUser);
//  - e.next() em TODOS os caminhos de saída;
//  - a chave do provedor jamais aparece em logs/respostas.
//

routerAdd('POST', '/backend/v1/cha/suggest', (e) => {
  function resolveUser() {
    try {
      return $app.resolveAuthUser(e) || e.auth || null
    } catch (_) {
      return e.auth || null
    }
  }

  try {
    const user = resolveUser()
    if (!user) {
      e.json(401, { error: 'Autenticação necessária.' })
      e.next()
      return
    }
    if (!['admin', 'recruiter', 'manager'].includes(String(user.get('role') || ''))) {
      e.json(403, { error: 'Sem permissão para usar o agente de IA.' })
      e.next()
      return
    }

    const body = e.requestInfo().body || {}
    const title = String(body.title || '').trim()
    const area = String(body.area || '').trim()
    const level = String(body.level || '').trim()
    const mission = String(body.mission || '').trim()
    if (!title) {
      e.json(400, { error: 'Informe o título do cargo para a IA sugerir o CHA.' })
      e.next()
      return
    }

    const orgId = String(user.get('org_' + 'id') || '')
    const providerCfg = $app.getAiProvider(e.app, orgId)

    const prompt =
      'Você é um especialista em Recrutamento e Seleção no Brasil, com foco em PME. ' +
      'Monte a ficha CHA do cargo abaixo. CHA = Conhecimentos (saber), Habilidades (saber fazer) e Atitudes (saber ser). ' +
      'Responda APENAS com um JSON válido, sem texto extra, no formato: ' +
      '{"conhecimentos":[{"description":"...","weight":1-5,"required":true|false}],' +
      '"habilidades":[...],"atitudes":[...]} — com 3 a 5 itens por bloco. ' +
      'Itens curtos e objetivos (até 90 caracteres), realistas para uma PME brasileira. ' +
      'weight é a importância do item dentro do bloco, de 1 (menor) a 5 (maior); ' +
      'required=true para os essenciais à função.\n\n' +
      'Cargo: ' +
      title +
      '\n' +
      (area ? 'Área: ' + area + '\n' : '') +
      (level ? 'Nível hierárquico: ' + level + '\n' : '') +
      (mission ? 'Missão do cargo: ' + mission + '\n' : '')

    let result = null
    let providerUsed = 'native'

    if (providerCfg.provider !== 'native' && providerCfg.apiKey) {
      try {
        const model = $app.providerModelFor(providerCfg.provider, providerCfg.model)
        const raw = $app.callOwnProvider(providerCfg.provider, providerCfg.apiKey, model, prompt)
        result = $app.parseScoreJson(raw)
        providerUsed = providerCfg.provider
      } catch (err) {
        // Fallback obrigatório ao agente nativo (mesma regra do score).
        console.error(
          '[cha-suggest] falha no provedor próprio (' + providerCfg.provider + '):',
          err,
        )
        result = null
      }
    }

    if (!result) {
      try {
        const serviceUser = $app.findAuthRecordByEmail('users', 'ai-service@ats.internal')
        const aiResult = $ai.agent('candidate-scorer').chat({
          user_id: serviceUser.id,
          message: prompt,
        })
        result = $app.parseScoreJson((aiResult && aiResult.content) || '')
      } catch (err) {
        console.error('[cha-suggest] agente nativo falhou:', err)
        e.json(502, {
          error:
            'A IA não respondeu agora. Tente novamente — ou preencha o CHA manualmente (você também pode revisar a configuração em Configuração de IA).',
        })
        e.next()
        return
      }
    }

    // Normaliza para o formato do formulário (3 blocos, itens com description/required/weight).
    function normalizeBlock(list) {
      const out = []
      if (!Array.isArray(list)) return out
      for (const it of list) {
        if (!it || typeof it !== 'object') continue
        const desc = String(it.description || '').trim()
        if (!desc) continue
        let w = Number(it.weight)
        if (!isFinite(w)) w = 3
        w = Math.min(5, Math.max(1, Math.round(w)))
        out.push({ description: desc.slice(0, 120), required: it.required === true, weight: w })
        if (out.length >= 6) break
      }
      return out
    }

    const conhecimentos = normalizeBlock(result.conhecimentos)
    const habilidades = normalizeBlock(result.habilidades)
    const atitudes = normalizeBlock(result.atitudes)
    if (!conhecimentos.length && !habilidades.length && !atitudes.length) {
      e.json(502, { error: 'A IA respondeu em formato inesperado. Tente novamente.' })
      e.next()
      return
    }

    e.json(200, {
      ok: true,
      provider_used: providerUsed,
      suggestion: { conhecimentos, habilidades, atitudes },
    })
    e.next()
  } catch (err) {
    console.error('[cha-suggest] erro geral:', err)
    e.json(500, { error: 'Falha ao gerar a sugestão de CHA. Tente novamente.' })
    e.next()
  }
})
