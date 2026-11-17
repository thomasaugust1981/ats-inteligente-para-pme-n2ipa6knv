//
// Score CHA × agente de IA — helpers globais para o snapshot do score.
// Lê a ficha CHA (coleção cha_evaluations, mig 0026) da candidatura e, quando
// ela existe E está toda avaliada, injeta os dados objetivos no snapshot do
// score: score ponderado total, % por bloco (Conhecimentos/Habilidades/
// Atitudes) e os requisitos com nota baixa (grade < 3) + evidência — a
// evidência é obrigatória nesse caso (hook cha_evaluations.js), então sempre
// vem preenchida quando existe.
//
// Usado por pocketbase/hooks/ai_score.js e ai_score_triggers.js via
// $app.applyChaToSnapshot(app, snapshot, applicationId). A dimensão técnica do
// score passa a registrar a fonte no snapshot: 'cha' (ficha CHA preenchida) ou
// 'resume' (comportamento anterior, só currículo/texto livre).
//
// A JSVM executa callbacks em pool separado: nada aqui depende de import.
//

$app.buildChaEvaluationData = function (app, applicationId) {
  let evaluation = null
  try {
    evaluation = app.findFirstRecordByFilter('cha_evaluations', 'application_id = {:a}', null, {
      a: applicationId,
    })
  } catch (_) {
    evaluation = null
  }
  if (!evaluation) return null

  // Parse tolerante do JSON "grades" (mesma forma de chaEvaluation.ts):
  // {"items":[{"key","block","description","weight","grade","evidence"}]} —
  // o campo pode chegar como objeto (json) ou string.
  let items = []
  try {
    let parsed = evaluation.get('grades')
    if (typeof parsed === 'string') parsed = JSON.parse(parsed || 'null')
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) items = parsed.items
  } catch (err) {
    console.error('[cha-score] grades da ficha ilegíveis:', err)
    return null
  }
  if (items.length === 0) return null

  const blocks = { conhecimentos: [], habilidades: [], atitudes: [] }
  let weighted = 0
  let max = 0
  const lowGrades = []
  for (const raw of items) {
    const it = raw || {}
    const grade = Math.min(5, Math.max(1, Math.round(Number(it.grade) || 1)))
    const weight = Math.min(5, Math.max(1, Math.round(Number(it.weight) || 3)))
    const block = String(it.block || 'conhecimentos')
    const entry = {
      requisito: String(it.description || it.key || ''),
      bloco: block,
      nota: grade,
      peso: weight,
      evidencia: String(it.evidence || ''),
    }
    if (blocks[block]) blocks[block].push(entry)
    weighted += grade * weight
    max += weight * 5
    if (grade < 3) {
      lowGrades.push({
        requisito: entry.requisito,
        bloco: block,
        nota: grade,
        evidencia: entry.evidencia,
      })
    }
  }
  if (max === 0) return null

  const blockPct = {}
  for (const name of Object.keys(blocks)) {
    let w = 0
    let m = 0
    for (const it of blocks[name]) {
      w += it.nota * it.peso
      m += it.peso * 5
    }
    blockPct[name] = m > 0 ? Math.round((w / m) * 1000) / 10 : 0
  }

  return {
    evaluation_id: evaluation.id,
    // Score ponderado 0-100 = soma(nota × peso) / soma(peso × 5) × 100 — a
    // MESMA fórmula recalculada server-side no hook cha_evaluations.js.
    weighted_score: evaluation.getFloat
      ? evaluation.getFloat('weighted_score')
      : Number(evaluation.get('weighted_score')) || 0,
    block_scores: blockPct,
    blocks_detail: {
      conhecimentos: blocks.conhecimentos,
      habilidades: blocks.habilidades,
      atitudes: blocks.atitudes,
    },
    low_grades: lowGrades,
  }
}

/**
 * Injeta a ficha CHA (quando preenchida) no snapshot do score e registra a
 * fonte da dimensão técnica. Retorna true quando a ficha foi aplicada.
 * Candidato SEM ficha CHA: snapshot fica exatamente como era antes.
 */
$app.applyChaToSnapshot = function (app, snapshot, applicationId) {
  const cha = $app.buildChaEvaluationData(app, applicationId)
  if (!cha || !snapshot) return false
  snapshot.cha_evaluation = cha
  snapshot.technical_source = 'cha'
  return true
}
