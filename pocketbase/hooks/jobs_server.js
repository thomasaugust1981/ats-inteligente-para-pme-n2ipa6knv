//
// Hook jobs_server — FASE 3 do fluxo Organograma → Cargo → Vaga: a VAGA.
//
//   onRecordCreateRequest (jobs):
//     • vaga NASCIDA de um cargo (cargo_id preenchido) é validada server-side:
//       o cargo precisa existir, pertencer à org e estar APROVADO; a posição
//       (org_node_id) precisa pertencer à org. status 'published' direto no
//       create é derrubado para 'draft' — ninguém pula etapas.
//     • ao CRIAR a vaga a partir do cargo, grava o SNAPSHOT de auditoria
//       (cargo_snapshot + organograma_snapshot) e opened_at/opened_by —
//       dados que o cliente não pode forjar.
//     • vaga sem cargo (avulsa) passa sem alterações (admin/RH).
//
//   onRecordUpdateRequest (jobs):
//     • BLOQUEIO DE PUBLICAÇÃO: mudar status para 'published' falha com 400
//       quando (a) o cargo de origem não está APROVADO ou (b) o organograma
//       vigente referenciado pela vaga foi ARQUIVADO/Substituído depois da
//       abertura. Mensagem clara para o usuário.
//     • cargo_id/org_node_id/snapshots são IMUTÁVEIS pela API pública (só
//       superuser ou hook altera).
//
//   onRecordAfterCreateSuccess / onUpdate:
//     • grava audit_logs (action job_opened / job_published) — quem, quando,
//       de qual status para qual (padrão das outras transições).
//
// IMPORTANTE JSVM: nada de funções top-level referenciadas de dentro dos
// callbacks (cada callback roda em VM própria) e nada de col.set() —
// atribuição direta. Gravações em audit_logs em try/catch (nunca derrubam a
// operação principal).
//
onRecordCreateRequest((e) => {
  let payload = {}
  let info = null
  try {
    info = e.requestInfo()
    payload = (info && info.body) || {}
  } catch (_) {
    payload = {}
  }
  if (!payload || typeof payload !== 'object') payload = {}

  const cargoId = String(payload.cargo_id || '')
  if (!cargoId) {
    // vaga avulsa (admin/RH): segue o fluxo padrão
    e.next()
    return
  }

  const app = e.app
  const auth = (info && info.auth) || null
  const role = (auth && auth.get('role')) || ''
  const authOrg = (auth && auth.get('org_id')) || ''

  // ---- cargo de origem precisa existir e estar APROVADO ----
  let cargo = null
  try {
    cargo = app.findRecordById('cargos', cargoId)
  } catch (_) {
    cargo = null
  }
  if (!cargo) {
    e.json(400, { ok: false, error: 'Cargo de origem não encontrado.' })
    return
  }
  if (role !== 'superadmin' && authOrg && String(cargo.get('org_id') || '') !== String(authOrg)) {
    e.json(403, { ok: false, error: 'Cargo pertence a outra organização.' })
    return
  }
  if (String(cargo.get('status') || '') !== 'APROVADO') {
    e.json(400, {
      ok: false,
      error:
        'Só é possível abrir vaga a partir de um cargo APROVADO — este cargo está em "' +
        (String(cargo.get('status') || '') || 'RASCUNHO') +
        '".',
    })
    return
  }
  if (String(cargo.get('purpose') || '') !== 'PREENCHIMENTO') {
    e.json(400, {
      ok: false,
      error:
        'A finalidade do cargo precisa ser PREENCHIMENTO para abrir vaga (converta a finalidade em /cargos).',
    })
    return
  }

  // ---- faixa salarial herdada: garante no servidor mesmo sem o cliente ----
  const cMin = cargo.get('salary_min')
  const cMax = cargo.get('salary_max')
  if (cMin === undefined || cMin === null || String(cMin) === '') {
    e.json(400, {
      ok: false,
      error: 'O cargo não tem faixa salarial definida — preencha em /cargos antes de abrir a vaga.',
    })
    return
  }

  // ---- posição herdada ----
  const nodeId = String(payload.org_node_id || cargo.get('org_node_id') || '')
  let node = null
  if (nodeId) {
    try {
      node = app.findRecordById('org_nodes', nodeId)
    } catch (_) {
      node = null
    }
    if (!node) {
      e.json(400, { ok: false, error: 'Posição do organograma não encontrada.' })
      return
    }
    if (role !== 'superadmin' && authOrg && String(node.get('org_id') || '') !== String(authOrg)) {
      e.json(403, { ok: false, error: 'Posição pertence a outra organização.' })
      return
    }
  } else {
    e.json(400, {
      ok: false,
      error: 'A vaga precisa estar vinculada a uma posição do organograma (herdada do cargo).',
    })
    return
  }

  // ninguém pula etapas: vaga nasce sempre em rascunho
  if (String(payload.status || '') === 'published') {
    e.record.set('status', 'draft')
  }

  // ---- snapshot de auditoria (gravado server-side) ----
  // helper INLINE: conta itens do bloco CHA do cargo (JSVM: nada de função
  // top-level referenciada de dentro do callback)
  function chaBlockCount(crg, block) {
    let cha = null
    try {
      cha = JSON.parse(crg.get('cha') || '{}')
    } catch (_) {
      cha = null
    }
    const its = (cha && cha[block] && cha[block].items) || []
    return Array.isArray(its) ? its.length : 0
  }
  let nodeManager = String(node.get('manager') || '')
  if (!nodeManager) {
    try {
      const mgrId = String(node.get('manager_id') || '')
      if (mgrId) {
        const mgr = app.findRecordById('users', mgrId)
        nodeManager = String(mgr.get('name') || mgr.get('email') || '')
      }
    } catch (_) {
      nodeManager = ''
    }
  }
  e.record.set('org_node_id', node.id)
  e.record.set('manager_name', nodeManager)
  e.record.set('cost_center', String(node.get('cost_center') || ''))
  e.record.set(
    'cargo_snapshot',
    JSON.stringify({
      cargo_id: cargo.id,
      titulo: String(cargo.get('title') || ''),
      nivel: String(cargo.get('level') || ''),
      area: String(cargo.get('area') || ''),
      finalidade: String(cargo.get('purpose') || ''),
      status: String(cargo.get('status') || ''),
      faixa_salarial: {
        min: cargo.get('salary_min') || null,
        med: cargo.get('salary_med') || null,
        max: cargo.get('salary_max') || null,
      },
      cha_resumido: {
        conhecimentos: chaBlockCount(cargo, 'conhecimentos'),
        habilidades: chaBlockCount(cargo, 'habilidades'),
        atitudes: chaBlockCount(cargo, 'atitudes'),
      },
      aprovado_em: String(cargo.get('approved_at') || ''),
      aprovado_por: String(cargo.get('approved_by') || ''),
      snapshot_em: new Date().toISOString(),
    }),
  )
  // versão vigente no momento da abertura (inline — JSVM)
  let versaoSnap = null
  try {
    const snapCompany = String(node.get('company') || '')
    const snapFilter = snapCompany ? "status = 'APROVADA' && company = {:c}" : "status = 'APROVADA'"
    const snapParams = snapCompany ? { c: snapCompany } : {}
    const snapVers = app.findRecordsByFilter(
      'org_versions',
      snapFilter,
      '-version_number',
      1,
      0,
      snapParams,
    )
    if (snapVers.length > 0) {
      versaoSnap = {
        id: snapVers[0].id,
        numero: snapVers[0].get('version_number'),
        status: String(snapVers[0].get('status') || ''),
        label: String(snapVers[0].get('label') || ''),
      }
    }
  } catch (_) {
    versaoSnap = null
  }
  e.record.set('organograma_version_id', versaoSnap ? versaoSnap.id : '')
  e.record.set(
    'organograma_snapshot',
    JSON.stringify({
      posicao_id: node.id,
      node_key: String(node.get('node_key') || ''),
      nome: String(node.get('name') || ''),
      area: String(node.get('area') || ''),
      gestor: nodeManager,
      centro_custo: String(node.get('cost_center') || ''),
      company: String(node.get('company') || ''),
      versao: versaoSnap,
      snapshot_em: new Date().toISOString(),
    }),
  )
  e.record.set('opened_at', new Date().toISOString())
  e.record.set('opened_by', String((auth && (auth.get('name') || auth.get('email'))) || ''))
  e.record.set('opened_by_id', String((auth && auth.get('id')) || ''))

  e.next()
}, 'jobs')

//
// UPDATE — bloqueio de publicação + imutabilidade do vínculo
//
onRecordUpdateRequest((e) => {
  let payload = {}
  let info = null
  try {
    info = e.requestInfo()
    payload = (info && info.body) || {}
  } catch (_) {
    payload = {}
  }
  if (!payload || typeof payload !== 'object') {
    e.next()
    return
  }

  const app = e.app
  const rec = e.record

  // vínculo/snapshot imutáveis pela API pública
  const LOCKED = ['cargo_id', 'org_node_id', 'cargo_snapshot', 'organograma_snapshot']
  for (const k of LOCKED) {
    if (payload[k] !== undefined && payload[k] !== null) {
      const current =
        k === 'cargo_id' || k === 'org_node_id'
          ? String(rec.get(k) || '')
          : JSON.stringify(rec.get(k) || null)
      const incoming =
        k === 'cargo_id' || k === 'org_node_id' ? String(payload[k]) : String(payload[k])
      if (k === 'cargo_id' || k === 'org_node_id') {
        if (incoming && incoming !== current) {
          e.json(400, {
            ok: false,
            error:
              'O vínculo com o cargo/organograma é imutável — abra uma nova vaga a partir do cargo.',
          })
          return
        }
      } else if (String(payload[k]) !== current && String(payload[k]) !== '') {
        e.json(400, {
          ok: false,
          error: 'O snapshot de auditoria da abertura não pode ser alterado.',
        })
        return
      }
    }
  }

  // ---- BLOQUEIO DE PUBLICAÇÃO ----
  if (
    String(payload.status || '') === 'published' &&
    String(rec.get('status') || '') !== 'published'
  ) {
    const cargoId = String(rec.get('cargo_id') || '')
    if (cargoId) {
      let cargo = null
      try {
        cargo = app.findRecordById('cargos', cargoId)
      } catch (_) {
        cargo = null
      }
      if (!cargo || String(cargo.get('status') || '') !== 'APROVADO') {
        e.json(400, {
          ok: false,
          error:
            'Publicação bloqueada: o cargo de origem desta vaga não está APROVADO. Resolva a aprovação do cargo em /cargos antes de publicar.',
        })
        return
      }
    }

    // organograma referenciado precisa continuar vigente (não ARQUIVADO/
    // SUBSTITUÍDO após a abertura)
    const nodeId = String(rec.get('org_node_id') || '')
    if (nodeId) {
      let node = null
      try {
        node = app.findRecordById('org_nodes', nodeId)
      } catch (_) {
        node = null
      }
      if (!node) {
        e.json(400, {
          ok: false,
          error:
            'Publicação bloqueada: a posição do organograma desta vaga não existe mais no organograma vigente.',
        })
        return
      }
      const company = String(node.get('company') || '')
      let vers = []
      try {
        const versFilter = company ? "status = 'APROVADA' && company = {:c}" : "status = 'APROVADA'"
        const versParams = company ? { c: company } : {}
        vers = app.findRecordsByFilter(
          'org_versions',
          versFilter,
          '-version_number',
          1,
          0,
          versParams,
        )
      } catch (_) {
        vers = []
      }
      const nodeKey = String(node.get('node_key') || '')
      let inVigente = vers.length === 0 // organograma legado sem ciclo: publica
      for (const v of vers) {
        if (inVigente) break
        let nodes = []
        try {
          nodes = JSON.parse(v.get('nodes_json') || '[]')
        } catch (_) {
          nodes = []
        }
        if (!Array.isArray(nodes)) nodes = []
        for (const n of nodes) {
          const k = n.id || n.node_key || ''
          if (k === nodeKey) {
            inVigente = true
            break
          }
        }
      }
      if (!inVigente || String(node.get('status') || '') === 'inativo') {
        e.json(400, {
          ok: false,
          error:
            'Publicação bloqueada: o organograma vigente que originou esta vaga foi ARQUIVADO/revisto — atualize o organograma e reabra a vaga a partir do cargo.',
        })
        return
      }
    }
  }

  e.next()
}, 'jobs')

//
// AFTER CREATE — trilha de auditoria: abertura da vaga
//
onRecordAfterCreateSuccess((e) => {
  try {
    const rec = e.record
    const info = $app.requestInfo()
    const auth = (info && info.auth) || null
    const role = String((auth && auth.get('role')) || '')
    const cargoId = String(rec.get('cargo_id') || '')
    if (!cargoId) {
      e.next()
      return
    }
    const trailRec = new Record($app.findCollectionByNameOrId('audit_logs'))
    trailRec.set('action', 'job_opened')
    trailRec.set('to_stage', String(rec.get('status') || 'draft'))
    trailRec.set(
      'details',
      'Vaga "' +
        String(rec.get('title') || '') +
        '" aberta a partir do cargo ' +
        cargoId +
        ' (headcount: ' +
        String(rec.get('headcount') || 1) +
        ')',
    )
    trailRec.set('user_name', String((auth && (auth.get('name') || auth.get('email'))) || '—'))
    trailRec.set('user_role', role)
    trailRec.set('org_id', String((auth && auth.get('org_id')) || rec.get('org_id') || ''))
    $app.save(trailRec)
  } catch (err) {
    console.log('jobs_server: falha ao gravar audit_logs (abertura): ' + err)
  }
  e.next()
}, 'jobs')

//
// AFTER UPDATE — trilha de auditoria: mudança de status (publicação etc.)
//
onRecordAfterUpdateSuccess((e) => {
  try {
    const rec = e.record
    const info = $app.requestInfo()
    const auth = (info && info.auth) || null
    const role = String((auth && auth.get('role')) || '')
    const prevStatus = rec.original().get('status')
    const newStatus = rec.get('status')
    if (String(prevStatus) === String(newStatus)) {
      e.next()
      return
    }
    const trailRec = new Record($app.findCollectionByNameOrId('audit_logs'))
    trailRec.set('action', 'job_published')
    trailRec.set('from_stage', String(prevStatus || ''))
    trailRec.set('to_stage', String(newStatus || ''))
    trailRec.set(
      'details',
      'Vaga "' +
        String(rec.get('title') || '') +
        '": status ' +
        String(prevStatus || '—') +
        ' → ' +
        String(newStatus || '—'),
    )
    trailRec.set('user_name', String((auth && (auth.get('name') || auth.get('email'))) || '—'))
    trailRec.set('user_role', role)
    trailRec.set('org_id', String((auth && auth.get('org_id')) || rec.get('org_id') || ''))
    $app.save(trailRec)
  } catch (err) {
    console.log('jobs_server: falha ao gravar audit_logs (status): ' + err)
  }
  e.next()
}, 'jobs')
