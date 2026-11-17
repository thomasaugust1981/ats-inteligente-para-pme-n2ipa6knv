//
// Indicadores — pacote 2 de 4: rotas de cálculo atrás do guard de licença do
// módulo 'indicadores' ($paths.indicatorsLicenseActive, exposto por
// pocketbase/hooks/modules_license.js — pacote 1).
//
//   GET /backend/v1/indicators/time-to-hire       ?from=&to=&org_id=(superadmin)
//   GET /backend/v1/indicators/funnel-conversion  ?from=&to=&job_id=&org_id=(superadmin)
//   GET /backend/v1/indicators/offer-acceptance   ?from=&to=&org_id=(superadmin)
//
// Nenhum campo novo: todas as datas vêm do histórico de movimentação
// existente — abertura da vaga = jobs.opened_at (gravado server-side no
// create, com fallback para jobs.created); aceite da proposta = audit_logs
// (to_stage='hired') com fallback para applications.stage_updated_at.
//
// Etapas do funil (sequência canônica, ids de DEFAULT_STAGES em
// src/services/jobs.ts): screening (Triagem) → interview_hr (RH) →
// tech_interview (Gestor/Técnica) → proposal (Proposta) → hired (Contratado).
//
// JSVM: cada callback roda em VM própria — TODOS os helpers vivem dentro do
// callback; nada de função top-level referenciada de lá. Agregação em memória
// sobre leituras SQL diretas (app.db().newQuery — padrão já usado em
// pocketbase/hooks/superadmin.js), com LIMIT generoso como teto.
// Erros saem sempre em JSON estruturado, nunca stack bruta.
//

routerAdd(
  'GET',
  '/backend/v1/indicators/time-to-hire',
  (e) => {
    function pbDate(v) {
      if (!v) return null
      const t = new Date(String(v).replace(' ', 'T')).getTime()
      return isNaN(t) ? null : t
    }
    function qStr(q, key) {
      const v = q ? q[key] : undefined
      if (v === undefined || v === null) return ''
      if (Array.isArray(v)) return String(v.length > 0 ? v[0] : '')
      return String(v)
    }
    function licenseActive(app, orgId) {
      try {
        if ($paths && typeof $paths.indicatorsLicenseActive === 'function') {
          return !!$paths.indicatorsLicenseActive(app, orgId, 'indicadores')
        }
      } catch (_) {}
      // fallback: mesma lógica de modules_license.js (JSVM não vê top-level daqui)
      if (!orgId) return false
      let license = null
      try {
        license = app.findFirstRecordByFilter(
          'org_modules',
          'org_' + 'id = {:o} && module = {:m}',
          {
            o: orgId,
            m: 'indicadores',
          },
        )
      } catch (_) {
        license = null
      }
      if (!license || !license.getBool('licensed')) return false
      const until = license.get('licensed_until')
      if (!until) return true
      const d = pbDate(until)
      if (d === null) return true
      return d + 86399999 >= Date.now()
    }
    function seniorityLabel(raw) {
      const m = {
        junior: 'Júnior',
        pleno: 'Pleno',
        senior: 'Sênior',
        intern: 'Estágio',
        mid: 'Pleno',
        lead: 'Liderança',
        specialist: 'Especialista',
      }
      return m[String(raw || '').toLowerCase()] || 'Não informado'
    }
    function avgOf(bucket) {
      if (!bucket || bucket.count === 0) return null
      return Math.round((bucket.sum / bucket.count) * 10) / 10
    }

    try {
      const auth = e.auth
      if (!auth) return e.json(401, { error: 'Autenticação necessária.' })

      let info = {}
      try {
        info = e.requestInfo() || {}
      } catch (_) {
        info = {}
      }
      const q = info.query || {}
      const role = String(auth.get('role') || '')
      let orgId = String(auth.get('org_' + 'id') || '')
      if (role === 'superadmin' && qStr(q, 'org_id')) orgId = qStr(q, 'org_id')
      if (!orgId) return e.json(400, { error: 'Organização do usuário não identificada.' })

      if (!licenseActive(e.app, orgId)) {
        return e.json(403, { error: 'Módulo Indicadores não licenciado para esta organização.' })
      }

      // Período (padrão: últimos 90 dias) — filtra a DATA DO ACEITE.
      const now = Date.now()
      let fromTs = now - 90 * 24 * 3600 * 1000
      let toTs = now
      if (qStr(q, 'from')) {
        const t = pbDate(qStr(q, 'from'))
        if (t !== null) fromTs = t
      }
      if (qStr(q, 'to')) {
        const t = pbDate(qStr(q, 'to'))
        if (t !== null) toTs = t + 86399999
      }

      const rows = e.app
        .db()
        .newQuery(
          'SELECT a.id AS app_id, a.stage_updated_at, ' +
            'j.id AS job_id, j.opened_at, j.created AS job_created, j.cargo_id, j.department, j.seniority, ' +
            'c.area AS cargo_area, c.level AS cargo_level, ' +
            "(SELECT l.created FROM audit_logs l WHERE l.application_id = a.id AND l.to_stage = 'hired' " +
            'ORDER BY l.created DESC LIMIT 1) AS hired_at ' +
            'FROM applications a ' +
            'JOIN jobs j ON j.id = a.job_id ' +
            'LEFT JOIN cargos c ON c.id = j.cargo_id ' +
            "WHERE a.org_id = {:o} AND a.status = 'hired' " +
            'LIMIT 50000',
        )
        .bind({ o: orgId })
        .all()

      const overall = { sum: 0, count: 0 }
      const byArea = {}
      const bySeniority = {}

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const hireTs = pbDate(r.hired_at) || pbDate(r.stage_updated_at)
        if (hireTs === null) continue
        if (hireTs < fromTs || hireTs > toTs) continue

        const openedTs = pbDate(r.opened_at) || pbDate(r.job_created)
        if (openedTs === null) continue

        const days = Math.max(0, Math.round((hireTs - openedTs) / 86400000))

        const area = String(r.cargo_area || r.department || 'Sem área')
        const level = seniorityLabel(r.cargo_level || r.seniority)

        overall.sum += days
        overall.count += 1

        if (!byArea[area]) byArea[area] = { sum: 0, count: 0 }
        byArea[area].sum += days
        byArea[area].count += 1

        if (!bySeniority[level]) bySeniority[level] = { sum: 0, count: 0 }
        bySeniority[level].sum += days
        bySeniority[level].count += 1
      }

      const byAreaList = Object.keys(byArea)
        .sort()
        .map((area) => ({ area: area, avg_days: avgOf(byArea[area]), hires: byArea[area].count }))
      const bySeniorityList = Object.keys(bySeniority)
        .sort()
        .map((level) => ({
          level: level,
          avg_days: avgOf(bySeniority[level]),
          hires: bySeniority[level].count,
        }))

      return e.json(200, {
        overall_avg_days: avgOf(overall),
        by_area: byAreaList,
        by_seniority: bySeniorityList,
        hires_count: overall.count,
      })
    } catch (err) {
      console.error('[indicators/time-to-hire] erro:', String((err && err.message) || err))
      return e.json(500, { error: 'Falha ao calcular o tempo de contratação.' })
    }
  },
  /*middlewares=*/ null,
)

routerAdd(
  'GET',
  '/backend/v1/indicators/funnel-conversion',
  (e) => {
    function pbDate(v) {
      if (!v) return null
      const t = new Date(String(v).replace(' ', 'T')).getTime()
      return isNaN(t) ? null : t
    }
    function qStr(q, key) {
      const v = q ? q[key] : undefined
      if (v === undefined || v === null) return ''
      if (Array.isArray(v)) return String(v.length > 0 ? v[0] : '')
      return String(v)
    }
    function licenseActive(app, orgId) {
      try {
        if ($paths && typeof $paths.indicatorsLicenseActive === 'function') {
          return !!$paths.indicatorsLicenseActive(app, orgId, 'indicadores')
        }
      } catch (_) {}
      if (!orgId) return false
      let license = null
      try {
        license = app.findFirstRecordByFilter(
          'org_modules',
          'org_' + 'id = {:o} && module = {:m}',
          {
            o: orgId,
            m: 'indicadores',
          },
        )
      } catch (_) {
        license = null
      }
      if (!license || !license.getBool('licensed')) return false
      const until = license.get('licensed_until')
      if (!until) return true
      const d = pbDate(until)
      if (d === null) return true
      return d + 86399999 >= Date.now()
    }

    try {
      const auth = e.auth
      if (!auth) return e.json(401, { error: 'Autenticação necessária.' })

      let info = {}
      try {
        info = e.requestInfo() || {}
      } catch (_) {
        info = {}
      }
      const q = info.query || {}
      const role = String(auth.get('role') || '')
      let orgId = String(auth.get('org_' + 'id') || '')
      if (role === 'superadmin' && qStr(q, 'org_id')) orgId = qStr(q, 'org_id')
      if (!orgId) return e.json(400, { error: 'Organização do usuário não identificada.' })

      if (!licenseActive(e.app, orgId)) {
        return e.json(403, { error: 'Módulo Indicadores não licenciado para esta organização.' })
      }

      const jobId = qStr(q, 'job_id')

      // Período (padrão: últimos 90 dias) — filtra a data do EVENTO de movimentação.
      const now = Date.now()
      let fromTs = now - 90 * 24 * 3600 * 1000
      let toTs = now
      if (qStr(q, 'from')) {
        const t = pbDate(qStr(q, 'from'))
        if (t !== null) fromTs = t
      }
      if (qStr(q, 'to')) {
        const t = pbDate(qStr(q, 'to'))
        if (t !== null) toTs = t + 86399999
      }

      const rows = e.app
        .db()
        .newQuery(
          'SELECT l.application_id, l.from_stage, l.to_stage, l.created, a.job_id ' +
            'FROM audit_logs l ' +
            'LEFT JOIN applications a ON a.id = l.application_id ' +
            "WHERE l.org_id = {:o} AND (l.from_stage != '' OR l.to_stage != '') " +
            'LIMIT 50000',
        )
        .bind({ o: orgId })
        .all()

      // Sequência canônica do funil (ids de DEFAULT_STAGES em src/services/jobs.ts).
      const SEQ = ['screening', 'interview_hr', 'tech_interview', 'proposal', 'hired']
      const entered = {}
      const advanced = {}
      for (let s = 0; s < SEQ.length; s++) {
        entered[SEQ[s]] = {}
        advanced[SEQ[s]] = {}
      }

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const appId = String(r.application_id || '')
        const appJobId = String(r.job_id || '')
        if (!appId || !appJobId) continue
        if (jobId && appJobId !== jobId) continue

        const eventTs = pbDate(r.created)
        if (eventTs === null || eventTs < fromTs || eventTs > toTs) continue

        const fromStage = String(r.from_stage || '')
        const toStage = String(r.to_stage || '')

        if (toStage && entered[toStage]) entered[toStage][appId] = true

        const fromIdx = SEQ.indexOf(fromStage)
        const toIdx = SEQ.indexOf(toStage)
        if (fromIdx >= 0 && toIdx > fromIdx) advanced[fromStage][appId] = true
      }

      const stages = []
      for (let s = 0; s < SEQ.length; s++) {
        const stage = SEQ[s]
        const enteredN = Object.keys(entered[stage]).length
        const advancedN = Object.keys(advanced[stage]).length
        const pct = enteredN > 0 ? Math.round((advancedN / enteredN) * 1000) / 10 : 0
        stages.push({ stage: stage, entered: enteredN, advanced: advancedN, conversion_pct: pct })
      }

      // overall = média das conversões das 4 transições (exclui 'hired', que é o fim).
      let sum = 0
      let n = 0
      for (let s = 0; s < stages.length - 1; s++) {
        sum += stages[s].conversion_pct
        n++
      }
      const overall = n > 0 ? Math.round((sum / n) * 10) / 10 : 0

      return e.json(200, { stages: stages, overall: overall })
    } catch (err) {
      console.error('[indicators/funnel-conversion] erro:', String((err && err.message) || err))
      return e.json(500, { error: 'Falha ao calcular a conversão do funil.' })
    }
  },
  /*middlewares=*/ null,
)

routerAdd(
  'GET',
  '/backend/v1/indicators/offer-acceptance',
  (e) => {
    function pbDate(v) {
      if (!v) return null
      const t = new Date(String(v).replace(' ', 'T')).getTime()
      return isNaN(t) ? null : t
    }
    function qStr(q, key) {
      const v = q ? q[key] : undefined
      if (v === undefined || v === null) return ''
      if (Array.isArray(v)) return String(v.length > 0 ? v[0] : '')
      return String(v)
    }
    function licenseActive(app, orgId) {
      try {
        if ($paths && typeof $paths.indicatorsLicenseActive === 'function') {
          return !!$paths.indicatorsLicenseActive(app, orgId, 'indicadores')
        }
      } catch (_) {}
      if (!orgId) return false
      let license = null
      try {
        license = app.findFirstRecordByFilter(
          'org_modules',
          'org_' + 'id = {:o} && module = {:m}',
          {
            o: orgId,
            m: 'indicadores',
          },
        )
      } catch (_) {
        license = null
      }
      if (!license || !license.getBool('licensed')) return false
      const until = license.get('licensed_until')
      if (!until) return true
      const d = pbDate(until)
      if (d === null) return true
      return d + 86399999 >= Date.now()
    }

    try {
      const auth = e.auth
      if (!auth) return e.json(401, { error: 'Autenticação necessária.' })

      let info = {}
      try {
        info = e.requestInfo() || {}
      } catch (_) {
        info = {}
      }
      const q = info.query || {}
      const role = String(auth.get('role') || '')
      let orgId = String(auth.get('org_' + 'id') || '')
      if (role === 'superadmin' && qStr(q, 'org_id')) orgId = qStr(q, 'org_id')
      if (!orgId) return e.json(400, { error: 'Organização do usuário não identificada.' })

      if (!licenseActive(e.app, orgId)) {
        return e.json(403, { error: 'Módulo Indicadores não licenciado para esta organização.' })
      }

      // Período (padrão: últimos 90 dias) — filtra a data do EVENTO.
      const now = Date.now()
      let fromTs = now - 90 * 24 * 3600 * 1000
      let toTs = now
      if (qStr(q, 'from')) {
        const t = pbDate(qStr(q, 'from'))
        if (t !== null) fromTs = t
      }
      if (qStr(q, 'to')) {
        const t = pbDate(qStr(q, 'to'))
        if (t !== null) toTs = t + 86399999
      }

      const rows = e.app
        .db()
        .newQuery(
          'SELECT l.application_id, l.from_stage, l.to_stage, l.created, a.job_id, ' +
            'j.cargo_id, j.department, c.area AS cargo_area ' +
            'FROM audit_logs l ' +
            'LEFT JOIN applications a ON a.id = l.application_id ' +
            'LEFT JOIN jobs j ON j.id = a.job_id ' +
            'LEFT JOIN cargos c ON c.id = j.cargo_id ' +
            "WHERE l.org_id = {:o} AND (l.to_stage = 'proposal' OR l.from_stage = 'proposal') " +
            'LIMIT 50000',
        )
        .bind({ o: orgId })
        .all()

      const madeByApp = {} // appId → true (entrou em 'proposal' no período)
      const acceptedByApp = {} // appId → true (proposal → hired no período)
      const areaByApp = {} // appId → área da vaga

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const appId = String(r.application_id || '')
        if (!appId || !String(r.job_id || '')) continue

        const eventTs = pbDate(r.created)
        if (eventTs === null || eventTs < fromTs || eventTs > toTs) continue

        const fromStage = String(r.from_stage || '')
        const toStage = String(r.to_stage || '')

        if (toStage === 'proposal') madeByApp[appId] = true
        if (fromStage === 'proposal' && toStage === 'hired') acceptedByApp[appId] = true

        if (areaByApp[appId] === undefined) {
          areaByApp[appId] = String(r.cargo_area || r.department || 'Sem área')
        }
      }

      const byArea = {}
      const madeKeys = Object.keys(madeByApp)
      const acceptedKeys = Object.keys(acceptedByApp)
      for (let i = 0; i < madeKeys.length; i++) {
        const area = areaByApp[madeKeys[i]] || 'Sem área'
        if (!byArea[area]) byArea[area] = { made: 0, accepted: 0 }
        byArea[area].made += 1
      }
      for (let i = 0; i < acceptedKeys.length; i++) {
        const area = areaByApp[acceptedKeys[i]] || 'Sem área'
        if (!byArea[area]) byArea[area] = { made: 0, accepted: 0 }
        byArea[area].accepted += 1
      }

      const byAreaList = Object.keys(byArea)
        .sort()
        .map((area) => {
          const b = byArea[area]
          return {
            area: area,
            made: b.made,
            accepted: b.accepted,
            rate_pct: b.made > 0 ? Math.round((b.accepted / b.made) * 1000) / 10 : 0,
          }
        })

      const madeN = madeKeys.length
      const acceptedN = acceptedKeys.length
      return e.json(200, {
        offers_made: madeN,
        offers_accepted: acceptedN,
        acceptance_rate_pct: madeN > 0 ? Math.round((acceptedN / madeN) * 1000) / 10 : 0,
        by_area: byAreaList,
      })
    } catch (err) {
      console.error('[indicators/offer-acceptance] erro:', String((err && err.message) || err))
      return e.json(500, { error: 'Falha ao calcular a aceitação de propostas.' })
    }
  },
  /*middlewares=*/ null,
)
