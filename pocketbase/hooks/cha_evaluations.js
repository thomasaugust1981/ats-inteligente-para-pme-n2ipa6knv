//
// FASE 2 do modelo CHA — hook da coleção cha_evaluations (padrão cha_validate.js;
// a JSVM usa OnRecordValidate, não onRecordValidate).
//
//   • job_id e application_id obrigatórios.
//   • grades deve ser a LISTA completa de requisitos efetivos da vaga
//     (jobs.cha_requirements — herdados do cargo + específicos), casando por
//     item: mesmo id/descrição, mesmo bloco, mesmo peso. Estrutura que não casa
//     com a vaga é rejeitada (evita avaliar requisito que a vaga não pede).
//   • grade: inteiro 1-5. Nota < 3 EXIGE evidência (texto) no próprio item —
//     nota baixa sem justificativa não salva.
//   • weighted_score e block_scores são SEMPRE recalculados no servidor:
//     score = soma(nota × peso) / soma(peso × 5) × 100, arredondado a 1 casa.
//     O valor enviado pelo cliente é ignorado.
//   • org_id e evaluator são preenchidos no servidor (da auth e da vaga).
//

function chaKeyOf(jobsCol, name) {
  try {
    var f = jobsCol.fields.getByName(name)
    return f && f.collectionId ? String(f.collectionId) : ''
  } catch (_) {
    return ''
  }
}

function parseJson(raw) {
  if (raw && typeof raw === 'object') return raw
  if (typeof raw !== 'string' || !raw) return null
  try {
    return JSON.parse(raw)
  } catch (_) {
    return null
  }
}

$app.onRecordValidate('cha_evaluations').add(function (e) {
  var rec = e.record

  var jobId = String(rec.get('job_id') || '')
  var appId = String(rec.get('application_id') || '')
  if (!jobId) throw new BadRequestError('A avaliação precisa estar vinculada a uma vaga.')
  if (!appId) throw new BadRequestError('A avaliação precisa estar vinculada a uma candidatura.')

  var job = null
  try {
    job = $app.findRecordById('jobs', jobId)
  } catch (_) {
    throw new BadRequestError('Vaga não encontrada para esta avaliação.')
  }
  try {
    $app.findRecordById('applications', appId)
  } catch (_) {
    throw new BadRequestError('Candidatura não encontrada para esta avaliação.')
  }

  var grades = parseJson(rec.get('grades'))
  if (!grades || !grades.items || !Array.isArray(grades.items) || grades.items.length === 0) {
    throw new BadRequestError('A ficha de avaliação está vazia — nenhum requisito para avaliar.')
  }

  // Requisitos efetivos da vaga (cha_requirements JSON): { cargo: {...}, specific: {...} }
  var chaReq = parseJson(job.get('cha_requirements'))
  var expected = []
  if (chaReq && typeof chaReq === 'object') {
    var blocks = ['cargo', 'specific']
    for (var b = 0; b < blocks.length; b++) {
      var part = chaReq[blocks[b]]
      if (!part || typeof part !== 'object') continue
      var keys = ['conhecimentos', 'habilidades', 'atitudes']
      for (var k = 0; k < keys.length; k++) {
        var block = part[keys[k]]
        var items =
          block && typeof block === 'object' && Array.isArray(block.items) ? block.items : []
        for (var i = 0; i < items.length; i++) {
          var it = items[i] || {}
          expected.push({
            key: String(it.id || ''),
            block: keys[k],
            description: String(it.description || it.descricao || '').trim(),
            weight: Number(it.weight) || 3,
          })
        }
      }
    }
  }
  if (expected.length === 0) {
    throw new BadRequestError(
      'Esta vaga não tem requisitos CHA definidos — avaliação indisponível.',
    )
  }
  if (grades.items.length !== expected.length) {
    throw new BadRequestError(
      'A ficha deve conter exatamente ' + expected.length + ' requisito(s) da vaga.',
    )
  }

  // casa cada requisito esperado com a nota enviada (mesma ordem de montagem)
  var totalWeighted = 0
  var totalMax = 0
  var blockWeighted = {}
  var blockMax = {}
  for (var g = 0; g < expected.length; g++) {
    var exp = expected[g]
    var sent = grades.items[g] || {}
    if (String(sent.key || '') !== exp.key || String(sent.block || '') !== exp.block) {
      throw new BadRequestError(
        'A ficha não corresponde aos requisitos CHA da vaga (requisito ' +
          (g + 1) +
          ' divergente).',
      )
    }
    if (String(sent.description || '').trim() !== exp.description) {
      throw new BadRequestError(
        'A descrição do requisito "' +
          (exp.description || exp.key) +
          '" diverge da vaga — reabra a ficha para atualizar.',
      )
    }
    var grade = Math.round(Number(sent.grade))
    if (!isFinite(grade) || grade < 1 || grade > 5) {
      throw new BadRequestError(
        'A nota do requisito "' + (exp.description || exp.key) + '" deve ser de 1 a 5.',
      )
    }
    var evidence = String(sent.evidence || sent.evidencia || '').trim()
    if (grade < 3 && !evidence) {
      throw new BadRequestError(
        'Nota ' +
          grade +
          ' em "' +
          (exp.description || exp.key) +
          '" exige evidência/observação justificando.',
      )
    }
    if (Number(sent.weight) !== exp.weight) {
      throw new BadRequestError(
        'O peso do requisito "' + (exp.description || exp.key) + '" diverge da vaga.',
      )
    }
    // normaliza a evidência (trim) antes de gravar
    grades.items[g].grade = grade
    grades.items[g].evidence = evidence
    totalWeighted += grade * exp.weight
    totalMax += exp.weight * 5
    blockWeighted[exp.block] = (blockWeighted[exp.block] || 0) + grade * exp.weight
    blockMax[exp.block] = (blockMax[exp.block] || 0) + exp.weight * 5
  }
  rec.set('grades', grades)

  // score ponderado 0-100 — SEMPRE recalculado no servidor
  var score = totalMax > 0 ? (totalWeighted / totalMax) * 100 : 0
  rec.set('weighted_score', Math.round(score * 10) / 10)

  var blockScores = {}
  for (var bk in blockWeighted) {
    if (blockMax[bk] > 0) {
      blockScores[bk] = Math.round((blockWeighted[bk] / blockMax[bk]) * 1000) / 10
    }
  }
  rec.set('block_scores', blockScores)

  // org_id/evaluator: preenchidos no servidor a partir da vaga e da sessão
  rec.set('org_' + 'id', job.get('org_' + 'id') || '')
  rec.set('evaluator', $request.auth ? String($request.auth.id || '') : '')

  e.next()
})
