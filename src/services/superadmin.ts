import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { Company, User } from '@/types/ats'

/** org_id chega como string (id) em registros de usuários/empresas. */
type WithOrgId = { org_id?: string }

export const SUPERADMIN_SEED_EMAIL = 'superadmin@ats.local'
export const SUPERADMIN_DEFAULT_PASSWORD = 'Mudar@123'

export interface Organization {
  id: string
  name: string
  slug: string
  is_active?: boolean
  notes?: string
  created: string
  updated: string
}

/** Mapa org_id → contagem, devolvido pela rota do hook superadmin. */
interface OrgCountsResponse {
  counts?: {
    users?: Record<string, number>
    companies?: Record<string, number>
  }
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
  /**
   * Lista todas as organizações (só superadmin tem acesso pela regra da coleção)
   * com contagens REAIS de usuários e empresas por org_id — via rota do hook
   * (uma chamada, SQL GROUP BY) com fallback para filtros por collection.
   */
  async listOrganizations(): Promise<OrganizationWithCounts[]> {
    const records = await pb.collection('organizations').getFullList<Organization>({
      sort: '-created',
    })

    let userCounts: Record<string, number> = {}
    let companyCounts: Record<string, number> = {}
    try {
      const res = await fetch(`${pb.buildUrl('')}/backend/v1/superadmin/organizations/counts`, {
        headers: { Authorization: pb.authStore.token },
      })
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as OrgCountsResponse | null
        userCounts = data?.counts?.users || {}
        companyCounts = data?.counts?.companies || {}
      }
    } catch (_) {
      // segue para o fallback abaixo
    }

    if (Object.keys(userCounts).length === 0 && Object.keys(companyCounts).length === 0) {
      // Fallback: contagens por filtro org_id (duas consultas por coleção).
      try {
        const [users, companies] = await Promise.all([
          pb.collection('users').getFullList<User & WithOrgId>({ filter: "org_id != ''" }),
          pb.collection('companies').getFullList<Company & WithOrgId>({ filter: "org_id != ''" }),
        ])
        for (const u of users) {
          const orgId = String(u.org_id || '')
          if (orgId) userCounts[orgId] = (userCounts[orgId] || 0) + 1
        }
        for (const c of companies) {
          const orgId = String(c.org_id || '')
          if (orgId) companyCounts[orgId] = (companyCounts[orgId] || 0) + 1
        }
      } catch (_) {
        // sem contagens — exibe 0
      }
    }

    return records.map((r) => ({
      ...r,
      users_count: userCounts[r.id] || 0,
      companies_count: companyCounts[r.id] || 0,
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
