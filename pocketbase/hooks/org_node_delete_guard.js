//
// Hook org_node_delete_guard — FASE 1: bloqueia a EXCLUSÃO de uma posição
// (org_nodes) que tenha vaga vinculada (job_id), direta ou com cargo ligado
// à vaga (job_id → jobs.cargo_id — org_nodes não tem cargo_id próprio).
//
//   - Posição com vaga/cargo → DELETE rejeitado (400) com archiveOffered:
//     o cliente oferece arquivar em vez de excluir.
//   - Posição sem vínculo → exclusão segue normal.
//
// O cliente nunca tem poder de contornar: a checagem é server-side, no
// OnRecordDeleteRequest. "Arquivar" é um PATCH (status=inativo +
// is_new_position=false), que continua permitido.
//
// IMPORTANTE JSVM: callbacks rodam em pool separado — toda a lógica fica
// DENTRO do callback (nenhuma função top-level referenciada de dentro dele;
// a validação estática do deploy rejeita esse padrão).
//
onRecordDeleteRequest((e) => {
  const rec = e.record
  const jobId = String(rec.get('job_id') || '')
  if (!jobId) {
    e.next()
    return
  }

  let hasCargo = false
  try {
    const job = e.app.findRecordById('jobs', jobId)
    hasCargo = !!String(job.get('cargo_id') || '')
  } catch (_) {}

  const vinculos = []
  if (jobId) vinculos.push('vaga vinculada no ATS')
  if (hasCargo) vinculos.push('cargo vinculado à vaga')

  e.json(400, {
    ok: false,
    error:
      'Posição "' +
      String(rec.get('name') || '') +
      '" não pode ser excluída: existe ' +
      vinculos.join(' e ') +
      '. Arquive a posição em vez de excluir.',
    archiveOffered: true,
  })
}, 'org_nodes')
