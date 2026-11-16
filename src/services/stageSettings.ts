import pb from '@/lib/pocketbase/client'
import type { StageSetting, JobStage } from '@/types/ats'
import { getErrorMessage } from '@/lib/pocketbase/errors'

/** Etapas que não recebem responsável (decisões finais do processo). */
export const FINAL_STAGE_IDS = ['hired', 'rejected']

/**
 * job_id sentinela que guarda a configuração PADRÃO definida no onboarding.
 * Vale para todas as vagas que não têm configuração específica de etapa.
 */
export const DEFAULT_STAGE_SETTINGS_JOB_ID = '__default__'

export const DEFAULT_REMINDER_DAYS = 2

export type StageConfigDraft = {
  stage_id: string
  stage_label: string
  owner_user_id: string // '' = sem responsável da equipe
  owner_email: string // '' = sem e-mail adicional
  reminder_enabled: boolean
  reminder_days: number
}

export const stageSettingsService = {
  /**
   * Configurações efetivas de uma vaga: as específicas da vaga prevalecem
   * sobre o padrão definido no onboarding (job_id sentinela '__default__').
   */
  async listEffectiveByJob(jobId: string): Promise<StageSetting[]> {
    const [specific, defaults] = await Promise.all([
      this.listByJob(jobId),
      this.listByJob(DEFAULT_STAGE_SETTINGS_JOB_ID),
    ])
    const merged = new Map<string, StageSetting>(defaults.map((d) => [d.stage_id, d] as const))
    for (const s of specific) merged.set(s.stage_id, s)
    return [...merged.values()]
  },

  /** Lista todas as configurações de uma vaga. */
  async listByJob(jobId: string): Promise<StageSetting[]> {
    try {
      return await pb.collection('stage_settings').getFullList<StageSetting>({
        filter: `job_id = "${jobId}"`,
      })
    } catch (_) {
      return []
    }
  },

  /** Busca a configuração de uma etapa específica (ou null). */
  async getByJobAndStage(jobId: string, stageId: string): Promise<StageSetting | null> {
    try {
      return await pb
        .collection('stage_settings')
        .getFirstListItem<StageSetting>(`job_id = "${jobId}" && stage_id = "${stageId}"`)
    } catch (_) {
      return null
    }
  },

  /** Cria ou atualiza (idempotente) a configuração de uma etapa da vaga. */
  async upsert(jobId: string, draft: StageConfigDraft): Promise<StageSetting> {
    const user = pb.authStore.record as (Record<string, unknown> & { org_id?: string }) | null
    const payload = {
      job_id: jobId,
      stage_id: draft.stage_id,
      owner_user_id: draft.owner_user_id || '',
      owner_email: draft.owner_email.trim().toLowerCase(),
      reminder_enabled: draft.reminder_enabled,
      reminder_days: draft.reminder_days || DEFAULT_REMINDER_DAYS,
      org_id: user?.org_id || '',
    }
    const existing = await this.getByJobAndStage(jobId, draft.stage_id)
    if (existing) {
      return await pb.collection('stage_settings').update<StageSetting>(existing.id, payload)
    }
    return await pb.collection('stage_settings').create<StageSetting>(payload)
  },

  /** Salva todos os drafts de uma vaga, reportando erros por etapa. */
  async saveAll(jobId: string, drafts: StageConfigDraft[]): Promise<string | null> {
    for (const draft of drafts) {
      try {
        await this.upsert(jobId, draft)
      } catch (err) {
        return `Etapa "${draft.stage_label}": ${getErrorMessage(err)}`
      }
    }
    return null
  },
}

/** Monta os drafts a partir das etapas da vaga + configurações existentes. */
export function buildStageDrafts(
  stages: JobStage[],
  existing: StageSetting[],
  defaultUserId = '',
): StageConfigDraft[] {
  return stages
    .filter((s) => !FINAL_STAGE_IDS.includes(s.id))
    .map((stage) => {
      const found = existing.find((e) => e.stage_id === stage.id)
      return {
        stage_id: stage.id,
        stage_label: stage.label,
        owner_user_id: found?.owner_user_id || defaultUserId,
        owner_email: found?.owner_email || '',
        reminder_enabled: found?.reminder_enabled ?? true,
        reminder_days: found?.reminder_days || DEFAULT_REMINDER_DAYS,
      }
    })
}
