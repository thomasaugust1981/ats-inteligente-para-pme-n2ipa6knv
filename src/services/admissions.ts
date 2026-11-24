import pb from '@/lib/pocketbase/client'
import { withFreshToken } from '@/lib/pocketbase/freshToken'

/**
 * Processo de admissão (handoff admissional — coleções "admissions" e
 * "admission_checklist_items", migração 0057). Criado automaticamente quando
 * uma candidatura é movida para "hired" no pipeline (hook admissions_server.js).
 *
 * 100% API padrão do PocketBase SDK com withFreshToken — rotas /backend/v1/*
 * NÃO são usadas no caminho crítico (dão 401 em runtime). Isolamento por org é
 * garantido pelas regras da coleção.
 */

export type AdmissionStatus = 'pendente' | 'em_andamento' | 'concluido'

export const ADMISSION_STATUS_LABELS: Record<AdmissionStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
}

export interface Admission {
  id: string
  org_id?: string
  application_id: string
  job_id?: string
  manager_id?: string
  candidate_name: string
  candidate_contact?: string
  candidate_cpf?: string
  job_title?: string
  cargo_title?: string
  org_name?: string
  manager_name?: string
  status: AdmissionStatus
  hire_date?: string
  notes?: string
  created: string
  updated: string
  expand?: {
    application_id?: {
      id: string
      candidate_id?: { id: string; name: string; email?: string; phone?: string }
    }
  }
}

export interface AdmissionChecklistItem {
  id: string
  org_id?: string
  admission_id: string
  title: string
  done: boolean
  done_by?: string
  done_at?: string
  sort_order?: number
  created: string
  updated: string
  expand?: {
    done_by?: { id: string; name: string; email: string }
  }
}

/** Checklist padrão criado junto com o processo (nome do item de ERP é fixo). */
export const DEFAULT_CHECKLIST_TITLES = [
  'Exame médico admissional',
  'Documentação (RG, CPF, CTPS, título de eleitor, comprovante de residência, foto 3x4)',
  'Assinatura da proposta/contrato',
  'Cadastro no Goldway ERP',
  'Onboarding — primeira semana agendada',
]

/** Status derivado do checklist: nenhum item → pendente; todos → concluído. */
export function derivedStatus(items: Pick<AdmissionChecklistItem, 'done'>[]): AdmissionStatus {
  if (items.length === 0) return 'pendente'
  const doneCount = items.filter((i) => i.done).length
  if (doneCount === 0) return 'pendente'
  if (doneCount === items.length) return 'concluido'
  return 'em_andamento'
}

export const admissionsService = {
  /** Processo admissional de uma candidatura (ou null). */
  async findForApplication(applicationId: string): Promise<Admission | null> {
    const rows = await withFreshToken(() =>
      pb.collection('admissions').getList<Admission>(1, 1, {
        filter: `application_id = "${applicationId}"`,
        sort: '-created',
      }),
    )
    return rows.items[0] || null
  },

  /**
   * Índice leve application_id → admission_id, para o Pipeline saber quais
   * candidaturas contratadas já têm processo admissional.
   */
  async listApplicationIds(): Promise<Map<string, string>> {
    const rows = await withFreshToken(() =>
      pb.collection('admissions').getFullList<Admission>({
        sort: '-created',
        fields: 'id,application_id',
      }),
    )
    const map = new Map<string, string>()
    for (const row of rows) {
      if (row.application_id) map.set(row.application_id, row.id)
    }
    return map
  },

  /** Lista os processos da organização (mais recentes primeiro). */
  async list(): Promise<Admission[]> {
    return await withFreshToken(() =>
      pb.collection('admissions').getFullList<Admission>({
        sort: '-created',
        expand: 'application_id.candidate_id',
      }),
    )
  },

  /** Itens do checklist de um processo (ordem fixa do checklist). */
  async listItems(admissionId: string): Promise<AdmissionChecklistItem[]> {
    return await withFreshToken(() =>
      pb.collection('admission_checklist_items').getFullList<AdmissionChecklistItem>({
        filter: `admission_id = "${admissionId}"`,
        sort: 'sort_order,created',
        expand: 'done_by',
      }),
    )
  },

  /** Marca/desmarca um item do checklist (grava quem concluiu e quando). */
  async setItemDone(
    itemId: string,
    done: boolean,
    doneBy?: string,
  ): Promise<AdmissionChecklistItem> {
    const payload: Record<string, unknown> = { done }
    if (done) {
      payload.done_by = doneBy || pb.authStore.record?.id
      payload.done_at = new Date().toISOString()
    } else {
      payload.done_by = null
      payload.done_at = null
    }
    return await withFreshToken(() =>
      pb.collection('admission_checklist_items').update<AdmissionChecklistItem>(itemId, payload),
    )
  },

  /** Adiciona um item extra ao checklist (no fim da lista). */
  async addItem(
    admissionId: string,
    title: string,
    sortOrder: number,
  ): Promise<AdmissionChecklistItem> {
    const user = pb.authStore.record as (Record<string, unknown> & { org_id?: string }) | null
    if (!pb.authStore.isValid || !user?.org_id) {
      throw new Error('Autenticação necessária.')
    }
    return await withFreshToken(() =>
      pb.collection('admission_checklist_items').create<AdmissionChecklistItem>({
        org_id: user.org_id,
        admission_id: admissionId,
        title: title.trim(),
        done: false,
        sort_order: sortOrder,
      }),
    )
  },

  /** Remove um item extra do checklist. */
  async removeItem(itemId: string): Promise<void> {
    await withFreshToken(() => pb.collection('admission_checklist_items').delete(itemId))
  },

  /** Atualiza status/observações do processo. */
  async update(
    admissionId: string,
    data: Partial<Pick<Admission, 'status' | 'notes' | 'hire_date'>>,
  ): Promise<Admission> {
    return await withFreshToken(() =>
      pb.collection('admissions').update<Admission>(admissionId, data),
    )
  },

  /** Renomeia um item do checklist. */
  async updateItem(itemId: string, title: string): Promise<AdmissionChecklistItem> {
    return await withFreshToken(() =>
      pb.collection('admission_checklist_items').update<AdmissionChecklistItem>(itemId, {
        title: title.trim(),
      }),
    )
  },

  /**
   * Cria o processo admissional pelo frontend — fallback para candidaturas
   * contratadas ANTES da migração 0057 (o hook não rodou para elas). Monta o
   * mesmo snapshot + checklist padrão do hook admissions_server.js.
   */
  async createForApplication(applicationId: string): Promise<Admission> {
    const user = pb.authStore.record as (Record<string, unknown> & { org_id?: string }) | null
    if (!pb.authStore.isValid || !user?.org_id) {
      throw new Error('Autenticação necessária.')
    }

    const application = await withFreshToken(() =>
      pb
        .collection('applications')
        .getOne<
          Admission['expand'] & {
            id: string
            org_id?: string
            job_id: string
            candidate_id: string
          }
        >(applicationId, { expand: 'candidate_id,job_id,job_id.manager_id' }),
    )

    const candidate = application.expand?.candidate_id
    const job = application.expand?.job_id
    const manager = job?.expand?.manager_id

    const admission = await withFreshToken(() =>
      pb.collection('admissions').create<Admission>({
        org_id: user.org_id,
        application_id: applicationId,
        job_id: application.job_id || null,
        manager_id: manager?.id || null,
        candidate_name: candidate?.name || 'Candidato',
        candidate_contact: [candidate?.email || '', candidate?.phone || '']
          .filter(Boolean)
          .join(' · '),
        candidate_cpf: candidate?.cpf || '',
        job_title: job?.title || '',
        cargo_title: job?.title || '',
        org_name: activeOrgName(user),
        manager_name: manager?.name || '',
        status: 'pendente' as AdmissionStatus,
        hire_date: new Date().toISOString(),
        notes: '',
      }),
    )

    const items = await withFreshToken(() =>
      pb.collection('admission_checklist_items').getFullList<AdmissionChecklistItem>({
        filter: `admission_id = "${admission.id}"`,
      }),
    )
    if (items.length === 0) {
      await createDefaultItems(admission.id, user.org_id)
    }
    return admission
  },
}

/** Nome da organização a partir do contexto ativo (melhor esforço). */
function activeOrgName(user: Record<string, unknown> & { org_id?: string }): string {
  const company = (user as { company_name?: string }).company_name
  return company || ''
}

/** Cria o checklist padrão de um processo admissional recém-criado. */
async function createDefaultItems(admissionId: string, orgId: string): Promise<void> {
  for (let i = 0; i < DEFAULT_CHECKLIST_TITLES.length; i++) {
    await withFreshToken(() =>
      pb.collection('admission_checklist_items').create<AdmissionChecklistItem>({
        org_id: orgId,
        admission_id: admissionId,
        title: DEFAULT_CHECKLIST_TITLES[i],
        done: false,
        sort_order: i + 1,
      }),
    )
  }
}

/**
 * Pacote de admissão: resumo consolidado (dados do admitido + estado do
 * checklist) para o DP levar ao Goldway. Mesmo padrão da carta proposta —
 * texto copiável.
 */
export function buildAdmissionPackage(
  admission: Admission,
  items: AdmissionChecklistItem[],
): string {
  const fmtDate = (iso?: string) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString('pt-BR')
    } catch (_) {
      return iso
    }
  }

  const lines: string[] = []
  lines.push(`PACOTE DE ADMISSÃO — ${admission.org_name || 'Talent'}`)
  lines.push('')
  lines.push('DADOS DO ADMITIDO')
  lines.push(`• Candidato: ${admission.candidate_name}`)
  lines.push(`• Contato: ${admission.candidate_contact || '—'}`)
  lines.push(`• CPF: ${admission.candidate_cpf || '—'}`)
  lines.push(`• Vaga: ${admission.job_title || '—'}`)
  lines.push(`• Cargo: ${admission.cargo_title || '—'}`)
  lines.push(`• Gestor da vaga: ${admission.manager_name || '—'}`)
  lines.push(`• Data da contratação: ${fmtDate(admission.hire_date)}`)
  lines.push(
    `• Status do processo: ${ADMISSION_STATUS_LABELS[admission.status] || admission.status}`,
  )
  if (admission.notes) {
    lines.push(`• Observações: ${admission.notes}`)
  }
  lines.push('')
  lines.push(
    `CHECKLIST ADMISSIONAL (${items.filter((i) => i.done).length}/${items.length} concluídos)`,
  )
  for (const item of items) {
    const mark = item.done ? '[x]' : '[ ]'
    const who = item.done && item.expand?.done_by?.name ? ` — por ${item.expand.done_by.name}` : ''
    const when = item.done_at ? ` em ${fmtDate(item.done_at)}` : ''
    lines.push(`${mark} ${item.title}${who}${when}`)
  }
  lines.push('')
  lines.push('Próxima etapa: cadastro no Goldway ERP pelo Departamento Pessoal.')
  lines.push('Gerado por Talent · Ausland.')
  return lines.join('\n')
}
