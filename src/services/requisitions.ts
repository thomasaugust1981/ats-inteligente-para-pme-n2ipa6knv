// Serviço de Requisições de Vaga (fluxo GESTOR → aprovador RH/admin).
// Usa a API PADRÃO do PocketBase via SDK com withFreshToken — rotas custom
// /backend/v1/* ficam FORA do caminho crítico (dão 401 em runtime).
import pb from '@/lib/pocketbase/client'
import { withFreshToken } from '@/lib/pocketbase/freshToken'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { JobRequisition, JobRequisitionStatus } from '@/types/ats'

export type NewRequisitionInput = {
  title: string
  justification: string
  budget_estimate?: number | null
  salary_min?: number | null
  salary_max?: number | null
  urgency: 'baixa' | 'media' | 'alta'
  company_id?: string | null
}

function normalize(rec: JobRequisition): JobRequisition {
  return {
    ...rec,
    status: (rec.status || 'pendente') as JobRequisitionStatus,
  }
}

export const requisitionsService = {
  /** Lista requisições da organização (regra da coleção já isola por org_id). */
  async list(filter?: string, sort = '-created'): Promise<JobRequisition[]> {
    const list = await withFreshToken(() =>
      pb.collection('job_requisitions').getFullList<JobRequisition>({
        filter,
        sort,
        expand: 'requested_by',
      }),
    )
    return list.map(normalize)
  },

  /** Requisições pendentes de decisão (fila do aprovador). */
  async listPending(): Promise<JobRequisition[]> {
    return this.list("status = 'pendente'")
  },

  async create(input: NewRequisitionInput, orgId: string): Promise<JobRequisition> {
    const created = await withFreshToken(() =>
      pb.collection('job_requisitions').create<JobRequisition>({
        title: input.title.trim(),
        justification: input.justification.trim(),
        budget_estimate: input.budget_estimate ?? null,
        salary_min: input.salary_min ?? null,
        salary_max: input.salary_max ?? null,
        urgency: input.urgency,
        company_id: input.company_id || null,
        status: 'pendente',
        org_id: orgId,
        requested_by: pb.authStore.record?.id,
      }),
    )
    return normalize(created)
  },

  /** Aprova: grava decisão e devolve a requisição atualizada. A vaga é criada pelo chamador. */
  async approve(id: string, note: string): Promise<JobRequisition> {
    const updated = await withFreshToken(() =>
      pb.collection('job_requisitions').update<JobRequisition>(id, {
        status: 'aprovada',
        decision_note: note.trim(),
        decided_by: pb.authStore.record?.name || pb.authStore.record?.email || '',
        decided_at: new Date().toISOString(),
      }),
    )
    return normalize(updated)
  },

  /** Reprova (processo cancelado) com justificativa visível ao solicitante. */
  async reject(id: string, note: string): Promise<JobRequisition> {
    if (!note.trim()) {
      throw new Error('Informe a justificativa da reprovação.')
    }
    const updated = await withFreshToken(() =>
      pb.collection('job_requisitions').update<JobRequisition>(id, {
        status: 'reprovada',
        decision_note: note.trim(),
        decided_by: pb.authStore.record?.name || pb.authStore.record?.email || '',
        decided_at: new Date().toISOString(),
      }),
    )
    return normalize(updated)
  },

  /** Grava na requisição o id da vaga criada a partir dela (rastreabilidade). */
  async linkJob(id: string, jobId: string): Promise<void> {
    await withFreshToken(() => pb.collection('job_requisitions').update(id, { job_id: jobId }))
  },

  requisitionErrorMessage(err: unknown): string {
    return getErrorMessage(err) || 'Não foi possível concluir a operação.'
  },
}
