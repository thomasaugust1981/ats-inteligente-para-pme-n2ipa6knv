//
// FASE 1 do modelo CHA — validação server-side (padrão ai_agent_settings.js;
// a JSVM não tem onRecordValidate, o gatilho correto é OnRecordValidate).
//
//   • cargos: exige título + missão + os três blocos CHA, cada bloco com pelo
//     menos 1 item; item precisa de descrição, peso inteiro 1-5 e flag
//     obrigatório booleano; em ATITUDES, rejeita ADJETIVO ISOLADO — a
//     descrição deve ser um comportamento observável (ex.: em vez de
//     "proativo", "identifica e reporta desvios de processo sem supervisão").
//   • jobs: ao PUBLICAR (status → 'published') com cargo vinculado, os três
//     blocos CHA efetivos (cargo + específicos da vaga) precisam estar
//     completos — vaga sem CHA completo não publica.
//
// A detecção de adjetivo isolado é heurística (não há NLP na JSVM): considera
// comportamento observável o texto com VERBO no infinitivo/imperativo/gerúndio
// ou estrutura "identifica/alcança/entrega ...", rejeitando 1-3 palavras sem
// verbo de ação. A mesma regra roda no cliente (src/lib/cha.ts) para avisar
// antes do submit.
//

var CHA_KEYS = ['conhecimentos', 'habilidades', 'atitudes']

function chaBlockOf(cha, key) {
  if (!cha || typeof cha !== 'object') return null
  var b = cha[key]
  return b && typeof b === 'object' ? b : null
}

function parseItems(block) {
  var items = block && typeof block === 'object' ? block.items : null
  return Array.isArray(items) ? items : []
}

function isObservableBehavior(text) {
  var t = String(text || '').trim()
  if (!t) return false
  var words = t.split(/\s+/)
  // Curto demais e sem verbo de ação → adjetivo isolado ("proativo")
  if (
    words.length <= 2 &&
    !/\b(identify|alcan|entreg|execut|report|comunic|cumpr|atend|resolve|negoci|coorden|organiz|planej|demonstr|mant|contribu|colabor|acompanh|aplic|oper|control|regist|atualiz|confer|valid)\w*/i.test(
      t,
    )
  ) {
    return false
  }
  // Exige verbo de ação em qualquer posição (infinitivo -ar/-er/-ir,
  // 3ª pessoa, imperativo ou gerúndio)
  return /\b\w+(ar|er|ir|ando|endo|a|e)\b/i.test(t) && words.length >= 3
}

$app.onRecordValidate('cargos').add(function (e) {
  var rec = e.record
  if (!String(rec.get('title') || '').trim()) {
    throw new BadRequestError('Informe o título do cargo.')
  }
  if (!String(rec.get('mission') || '').trim()) {
    throw new BadRequestError('Informe a missão do cargo (1 parágrafo).')
  }
  var cha = rec.get('cha')
  if (typeof cha === 'string') {
    try {
      cha = JSON.parse(cha)
    } catch (_) {
      throw new BadRequestError('Estrutura CHA inválida.')
    }
  }
  if (!cha || typeof cha !== 'object') {
    throw new BadRequestError('Preencha os três blocos CHA do cargo.')
  }
  for (var k = 0; k < CHA_KEYS.length; k++) {
    var key = CHA_KEYS[k]
    var block = chaBlockOf(cha, key)
    if (!block) {
      throw new BadRequestError('O bloco "' + key + '" do CHA é obrigatório.')
    }
    var items = parseItems(block)
    if (items.length === 0) {
      throw new BadRequestError('O bloco "' + key + '" precisa de pelo menos 1 requisito.')
    }
    for (var i = 0; i < items.length; i++) {
      var it = items[i] || {}
      var desc = String(it.description || it.descricao || '').trim()
      if (!desc) {
        throw new BadRequestError('Cada requisito do bloco "' + key + '" precisa de descrição.')
      }
      var w = Number(it.weight)
      if (!isFinite(w) || Math.round(w) < 1 || Math.round(w) > 5) {
        throw new BadRequestError(
          'O peso de cada requisito do bloco "' + key + '" deve ser de 1 a 5.',
        )
      }
      if (key === 'atitudes' && !isObservableBehavior(desc)) {
        throw new BadRequestError(
          'Em ATITUDES, descreva um comportamento observável (ex.: em vez de "proativo", "identifica e reporta desvios de processo sem supervisão").',
        )
      }
    }
  }
  e.next()
})

// Publicação de vaga: com cargo vinculado, exige os três blocos CHA completos.
$app.onRecordValidate('jobs').add(function (e) {
  var rec = e.record
  var becomingPublished = rec.get('status') === 'published'
  if (!becomingPublished) {
    e.next()
    return
  }
  var chaReq = rec.get('cha_requirements')
  if (typeof chaReq === 'string') {
    try {
      chaReq = JSON.parse(chaReq)
    } catch (_) {
      chaReq = null
    }
  }
  var cargoId = rec.get('cargo_id')
  // Sem cargo e sem CHA efetivo: vaga legada em texto livre continua publicável
  // (compatibilidade — a conversão é assistida, não bloqueada na fase 1).
  if (!cargoId && (!chaReq || typeof chaReq !== 'object')) {
    e.next()
    return
  }
  // Com cargo (ou CHA efetivo iniciado): os três blocos precisam existir.
  for (var k = 0; k < CHA_KEYS.length; k++) {
    var key = CHA_KEYS[k]
    var ok = false
    if (chaReq && typeof chaReq === 'object') {
      var b = chaReq[key]
      var items = b && typeof b === 'object' && Array.isArray(b.items) ? b.items : []
      ok = items.length > 0
    }
    if (!ok) {
      throw new BadRequestError(
        'Não é possível publicar: o bloco CHA "' +
          key +
          '" está vazio. Preencha os requisitos do cargo ou adicione requisitos específicos da vaga.',
      )
    }
  }
  e.next()
})
