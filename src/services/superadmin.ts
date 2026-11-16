import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export const SUPERADMIN_SEED_EMAIL = 'superadmin@ats.local'
export const SUPERADMIN_DEFAULT_PASSWORD = 'Mudar@123'

export interface Organization {
  id: string
  name: string
  slug: string
  is_active?: boolean
  notes?: string
  orgs_users_count?: number
  orgs_companies_count?: number
  created: string
  updated: string
}

export interface OrganizationWithCounts extends Organization {
  users_count: number
  companies_count: number
}

export interface CreateOrganizationPayload {
  name: string
  slug: string
  admin_name: string
  admin_email: string
  admin_password: string
  notes?: string
}

export interface CreateOrganizationResult {
  organization: Organization
  admin: { id: string; email: string; name: string }
}

export function slugify(text: string): string {
  const slug = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'organizacao'
}

export const superadminService = {
  /** Lista todas as organizações (só superadmin tem acesso pela regra da coleção). */
  async listOrganizations(): Promise<OrganizationWithCounts[]> {
    const records = await pb.collection('organizations').getFullList<Organization>({
      sort: '-created',
      expand: 'orgs_users_count,orgs_companies_count',
    })
    return records.map((r) => ({
      ...r,
      users_count: r.orgs_users_count || 0,
      companies_count: r.orgs_companies_count || 0,
    }))
  },

  /**
   * Cria a organização e o primeiro usuário administrador do cliente, de uma vez.
   * O hook server-side /backend/v1/superadmin/organizations (pb_hooks/superadmin.js)
   * grava os dois registros numa transação e devolve 409 amigável em slug duplicado
   * ou e-mail já cadastrado.
   */
  async createOrganizationWithAdmin(
    payload: CreateOrganizationPayload,
  ): Promise<CreateOrganizationResult> {
    const res = await fetch(`${pb.buildUrl('')}/backend/v1/superadmin/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const err = new Error(
        (data && (data.error || data.message)) || 'Falha ao criar a organização.',
      ) as Error & { field?: string; status?: number }
      err.field = data && data.field
      err.status = res.status
      throw err
    }
    return data as CreateOrganizationResult
  },

  async setOrganizationActive(id: string, isActive: boolean): Promise<Organization> {
    return await pb.collection('organizations').update<Organization>(id, { is_active: isActive })
  },

  /** Altera a própria senha (usuário logado) via API padrão de auth do PocketBase. */
  async changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = pb.authStore.record
    if (!user || !pb.authStore.token) {
      throw new Error('Sessão expirada — faça login novamente.')
    }
    await pb.collection('users').update(user.id, {
      password: newPassword,
      passwordConfirm: newPassword,
      oldPassword: currentPassword,
    })
  },

  isSuperadminSeed(user: { email?: string } | null | undefined): boolean {
    return (
      !!user &&
      String(user.email || '')
        .trim()
        .toLowerCase() === SUPERADMIN_SEED_EMAIL
    )
  },

  /** Verifica se a senha atual do usuário logado ainda é a senha padrão do seed. */
  async isUsingDefaultPassword(): Promise<boolean> {
    const user = pb.authStore.record
    if (!this.isSuperadminSeed(user) || !user?.email) return false
    try {
      await pb.collection('users').authWithPassword(user.email, SUPERADMIN_DEFAULT_PASSWORD)
      return true
    } catch (_) {
      return false
    }
  },
}
