//
// Hook org_tree_validate — validação server-side OBRIGATÓRIA da árvore do
// organograma (FASE 1 / ETAPA 1). Roda em OnRecordCreateRequest e
// OnRecordUpdateRequest de org_versions (o snapshot nodes_json é a fonte da
// verdade — o cliente só salva rascunhos nela):
//
//   1. nenhuma posição sem superior (exceto exatamente UMA raiz)
//   2. nenhum ciclo na árvore (parentId precisa resolver na própria árvore)
//   3. nenhuma posição duplicada na mesma unidade (mesmo título na mesma área)
//
// Falha = erro 400 com mensagem; nada é gravado.
//
// IMPORTANTE JSVM: callbacks rodam em pool separado — NÃO existe função
// top-level chamada de dentro do callback (a validação estática do deploy
// rejeita: "top-level declaration used inside callback"). A função validateTree
// é DUPLICADA dentro de cada callback, mesmo padrão dos demais hooks
// (org_versions_server.js, org_nodes_sync.js, lgpd_delete.js).
//
onRecordCreateRequest((e) => {
  const info = e.requestInfo()
  const body = (info && info.body) || {}
  // Fluxo de transição do workflow (action=submit/approve/...): validado no
  // org_versions_server — aqui só valida o snapshot puro.
  if (body.action) {
    e.next()
    return
  }

  function validateTree(nodesJson) {
    let nodes = []
    try {
      nodes = JSON.parse(nodesJson || '[]')
    } catch (_) {
      nodes = []
    }
    if (!Array.isArray(nodes) || nodes.length === 0) return // árvore vazia = rascunho novo

    const seen = {}
    const titles = {}
    for (const n of nodes) {
      const id = String((n && (n.id || n.node_key)) || '')
      if (!id) throw new Error('Posição sem identificador na estrutura')
      if (seen[id]) throw new Error('Posição duplicada na estrutura: ' + id)
      seen[id] = true

      const unit = String((n && (n.area || n.unidade)) || '').trim()
      const title = String((n && (n.cargo || n.nome || n.role_title)) || '').trim()
      // 3. posição duplicada na mesma unidade (mesma área)
      if (unit && title) {
        const key = unit.toLowerCase() + '||' + title.toLowerCase()
        if (titles[key]) {
          throw new Error(
            'Posição duplicada na unidade "' + unit + '": "' + title + '" já existe nesta unidade',
          )
        }
        titles[key] = true
      }
    }

    // 1. raiz única / todo mundo com superior
    let roots = 0
    for (const n of nodes) {
      const p = n.parentId == null ? '' : String(n.parentId).trim()
      if (!p) {
        roots++
        continue
      }
      if (!seen[p]) {
        throw new Error(
          'Posição "' +
            (n.cargo || n.nome || n.id) +
            '" aponta para um superior inexistente (' +
            p +
            ')',
        )
      }
    }
    if (roots === 0)
      throw new Error('A árvore precisa de exatamente uma posição raiz (sem superior)')
    if (roots > 1) {
      throw new Error(
        'A árvore só pode ter UMA posição raiz — encontradas ' + roots + ' sem superior',
      )
    }

    // 2. ciclo: caminhada a partir de cada nó até a raiz (ou detecção de loop)
    for (const n of nodes) {
      const seenOnPath = {}
      let cur = n
      let guard = 0
      while (cur) {
        const id = String(cur.id || cur.node_key || '')
        if (seenOnPath[id]) {
          throw new Error(
            'Ciclo detectado na árvore envolvendo "' + (cur.cargo || cur.nome || id) + '"',
          )
        }
        seenOnPath[id] = true
        guard++
        if (guard > nodes.length + 2) {
          throw new Error('Ciclo detectado na árvore (estrutura não converge para a raiz)')
        }
        const p = cur.parentId == null ? '' : String(cur.parentId).trim()
        cur = p ? (seen[p] === true ? nodes.find((x) => String(x.id) === p) : null) : null
      }
    }
  }

  try {
    validateTree(String(body.nodes_json || '[]'))
  } catch (err) {
    e.json(400, { ok: false, error: String(err && err.message ? err.message : err) })
    return
  }
  e.next()
}, 'org_versions')

onRecordUpdateRequest((e) => {
  const info = e.requestInfo()
  const body = (info && info.body) || {}
  if (!('nodes_json' in body) || body.action) {
    e.next()
    return
  }

  function validateTree(nodesJson) {
    let nodes = []
    try {
      nodes = JSON.parse(nodesJson || '[]')
    } catch (_) {
      nodes = []
    }
    if (!Array.isArray(nodes) || nodes.length === 0) return // árvore vazia = rascunho novo

    const seen = {}
    const titles = {}
    for (const n of nodes) {
      const id = String((n && (n.id || n.node_key)) || '')
      if (!id) throw new Error('Posição sem identificador na estrutura')
      if (seen[id]) throw new Error('Posição duplicada na estrutura: ' + id)
      seen[id] = true

      const unit = String((n && (n.area || n.unidade)) || '').trim()
      const title = String((n && (n.cargo || n.nome || n.role_title)) || '').trim()
      // 3. posição duplicada na mesma unidade (mesma área)
      if (unit && title) {
        const key = unit.toLowerCase() + '||' + title.toLowerCase()
        if (titles[key]) {
          throw new Error(
            'Posição duplicada na unidade "' + unit + '": "' + title + '" já existe nesta unidade',
          )
        }
        titles[key] = true
      }
    }

    // 1. raiz única / todo mundo com superior
    let roots = 0
    for (const n of nodes) {
      const p = n.parentId == null ? '' : String(n.parentId).trim()
      if (!p) {
        roots++
        continue
      }
      if (!seen[p]) {
        throw new Error(
          'Posição "' +
            (n.cargo || n.nome || n.id) +
            '" aponta para um superior inexistente (' +
            p +
            ')',
        )
      }
    }
    if (roots === 0)
      throw new Error('A árvore precisa de exatamente uma posição raiz (sem superior)')
    if (roots > 1) {
      throw new Error(
        'A árvore só pode ter UMA posição raiz — encontradas ' + roots + ' sem superior',
      )
    }

    // 2. ciclo: caminhada a partir de cada nó até a raiz (ou detecção de loop)
    for (const n of nodes) {
      const seenOnPath = {}
      let cur = n
      let guard = 0
      while (cur) {
        const id = String(cur.id || cur.node_key || '')
        if (seenOnPath[id]) {
          throw new Error(
            'Ciclo detectado na árvore envolvendo "' + (cur.cargo || cur.nome || id) + '"',
          )
        }
        seenOnPath[id] = true
        guard++
        if (guard > nodes.length + 2) {
          throw new Error('Ciclo detectado na árvore (estrutura não converge para a raiz)')
        }
        const p = cur.parentId == null ? '' : String(cur.parentId).trim()
        cur = p ? (seen[p] === true ? nodes.find((x) => String(x.id) === p) : null) : null
      }
    }
  }

  try {
    validateTree(String(body.nodes_json || '[]'))
  } catch (err) {
    e.json(400, { ok: false, error: String(err && err.message ? err.message : err) })
    return
  }
  e.next()
}, 'org_versions')
