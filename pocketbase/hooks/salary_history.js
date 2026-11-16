//
// FASE 3 do modelo CHA — histórico de alteração de faixa salarial.
//
// No UPDATE de `cargos`, compara salary_min/salary_med/salary_max com os
// valores gravados e cria um registro em `salary_history` por campo alterado
// (quem alterou, quando — autodate created —, e anterior → novo).
// O cliente NÃO grava histórico: somente este hook (usa $app, que bypassa as
// regras da coleção). Coleta org_id do próprio cargo.
//
onRecordUpdate((e) => {
  try {
    var FIELDS = ['salary_min', 'salary_med', 'salary_max']
    var changed = []
    for (var i = 0; i < FIELDS.length; i++) {
      var f = FIELDS[i]
      var before = e.record.original().get(f)
      var after = e.record.get(f)
      var bNum = before === null || before === undefined || before === '' ? null : Number(before)
      var aNum = after === null || after === undefined || after === '' ? null : Number(after)
      var same = bNum === aNum || (bNum !== null && aNum !== null && bNum === aNum)
      var bothNull = bNum === null && aNum === null
      if (!bothNull && !same) {
        changed.push({ field: f, old: bNum, new: aNum })
      }
    }
    if (changed.length === 0) {
      e.next()
      return
    }

    var user = $app.requestInfo().auth || null
    var userName = ''
    var userId = ''
    if (user && user.id) {
      userId = user.id
      userName = String(user.get('name') || user.get('email') || '')
    }

    var cargoOrg = e.record.get('org_id') || ''

    for (var j = 0; j < changed.length; j++) {
      var ch = changed[j]
      var rec = new Record($app.findCollectionByNameOrId('salary_history'))
      rec.set('cargo_id', e.record.id)
      rec.set('field', ch.field)
      rec.set('old_value', ch.old)
      rec.set('new_value', ch.new)
      if (userId) rec.set('changed_by', userId)
      rec.set('changed_by_name', userName || '—')
      if (cargoOrg) rec.set('org_id', cargoOrg)
      $app.save(rec)
    }
    console.log(
      '[salary_history] cargo ' +
        e.record.id +
        ': ' +
        changed.length +
        ' campo(s) de faixa alterado(s)',
    )
  } catch (err) {
    // Histórico é best-effort: nunca bloqueia o update do cargo.
    console.log('[salary_history] erro ao gravar histórico: ' + err)
  }
  e.next()
}, 'cargos')
