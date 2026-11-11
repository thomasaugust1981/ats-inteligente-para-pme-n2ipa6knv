import pb from '@/lib/pocketbase/client'
import type { Company, OnboardingStatus, TeamInvite, UserRole } from '@/types/ats'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  recruiter: 'Recrutador',
  manager: 'Gestor Solicitante',
}

export const DEFAULT_BRAND_COLOR = '#0284c7' // sky-600, padrão visual atual do app

export function isValidBrandColor(value: string | undefined | null): boolean {
  return !!value && /^#[0-9a-fA-F]{6}$/.test(value)
}

export const onboardingService = {
  /**
   * Carrega a empresa (a única no momento — o ATS opera por cliente).
   * Se o onboarding nunca foi iniciado, cria a empresa com status 'in_progress'
   * usando o nome que o administrador digitou no cadastro.
   */
  async getOrCreateCompany(userCompanyName?: string): Promise<Company | null> {
    try {
      const existing = await companyBase.get()
      if (existing) return existing
    } catch (_) {
      // segue para criar
    }

    try {
      const created = await pb.collection('companies').create<Company>({
        name: userCompanyName || 'Minha Empresa',
        onboarding_status: 'in_progress',
      })
      return created
    } catch (err) {
      console.error('Erro ao criar empresa no onboarding:', getErrorMessage(err))
      return null
    }
  },

  /** Atualiza dados parciais da empresa (marca, status do onboarding etc). */
  async updateCompany(
    id: string,
    data: Partial<Company> & { onboarding_status?: OnboardingStatus },
  ): Promise<Company> {
    return await pb.collection('companies').update<Company>(id, data)
  },

  /** Envia o logo via FormData (upload de arquivo). */
  async updateLogo(id: string, file: File): Promise<Company> {
    const formData = new FormData()
    formData.append('logo', file)
    return await pb.collection('companies').update<Company>(id, formData)
  },

  async getOnboardingStatus(): Promise<OnboardingStatus> {
    const company = await companyBase.get()
    return company?.onboarding_status || 'not_started'
  },

  // ----- Convites de equipe (registros pendentes, sem envio real de e-mail) -----

  async listInvites(): Promise<TeamInvite[]> {
    try {
      return await pb.collection('team_invites').getFullList<TeamInvite>({
        sort: '-created',
      })
    } catch (_) {
      return []
    }
  },

  async createInvite(email: string, role: UserRole): Promise<TeamInvite> {
    const user = pb.authStore.record
    return await pb.collection('team_invites').create<TeamInvite>({
      email: email.trim().toLowerCase(),
      role,
      status: 'pending',
      invited_by: user?.name || user?.email || 'Administrador',
    })
  },

  async cancelInvite(id: string): Promise<void> {
    await pb.collection('team_invites').update<TeamInvite>(id, { status: 'cancelled' })
  },

  async deleteInvite(id: string): Promise<void> {
    await pb.collection('team_invites').delete(id)
  },

  getLogoUrl(company: Company | null | undefined): string | null {
    if (!company?.logo) return null
    return pb.files.getURL(company, company.logo)
  },

  getBrandColor(company: Company | null | undefined): string {
    return isValidBrandColor(company?.brand_color)
      ? (company!.brand_color as string)
      : DEFAULT_BRAND_COLOR
  },
}

/** Acesso interno de leitura à empresa sem depender do companyService (evita ciclo). */
const companyBase = {
  async get(): Promise<Company | null> {
    try {
      const records = await pb.collection('companies').getList<Company>(1, 1)
      return records.items[0] || null
    } catch (err) {
      console.error('Erro ao buscar empresa:', getErrorMessage(err))
      return null
    }
  },
}
