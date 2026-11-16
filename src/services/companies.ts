// Serviço de empresas da organização (multi-empresa: matriz e filiais).
// A coleção companies já tem org_id, company_type ('matriz'|'filial') e
// parent_id (aplicados nas migrações 0018/0020) — aqui é só acesso de dados.
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { Company } from '@/types/ats'

/** Empresa com os campos de hierarquia multi-empresa. */
export type CompanyNode = Company & {
  org_id?: string
  company_type?: 'matriz' | 'filial' | ''
  parent_id?: string
  is_active?: boolean
  expand?: { parent_id?: CompanyNode | null }
}

export interface CompanyFormPayload {
  name: string
  trade_name?: string
  company_type: 'matriz' | 'filial'
  parent_id?: string | null
  city?: string
  state?: string
  website?: string
  logo?: File | null
  is_active?: boolean
}

export interface CompanyUsage {
  jobs: number
  applications: number
}

export const companiesService = {
  /** Empresas da organização do usuário logado (org_id do token). */
  async listMyCompanies(): Promise<CompanyNode[]> {
    try {
      return await pb.collection('companies').getFullList<CompanyNode>({
        filter: "org_id != ''",
        sort: 'name',
        expand: 'parent_id',
      })
    } catch (err) {
      console.error('Erro ao listar empresas da organização:', getErrorMessage(err))
      return []
    }
  },

  async getById(id: string): Promise<CompanyNode | null> {
    try {
      return await pb.collection('companies').getOne<CompanyNode>(id, { expand: 'parent_id' })
    } catch (_) {
      return null
    }
  },

  async create(payload: CompanyFormPayload): Promise<CompanyNode> {
    const user = pb.authStore.record
    const { logo, ...fields } = payload
    if (logo) {
      const fd = new FormData()
      fd.append('name', fields.name)
      fd.append('company_type', fields.company_type)
      fd.append('org_id', String(user?.org_id || ''))
      if (fields.trade_name) fd.append('trade_name', fields.trade_name)
      if (fields.parent_id) fd.append('parent_id', fields.parent_id)
      if (fields.city) fd.append('city', fields.city)
      if (fields.state) fd.append('state', fields.state)
      if (fields.website) fd.append('website', fields.website)
      if (typeof fields.is_active === 'boolean') fd.append('is_active', String(fields.is_active))
      fd.append('logo', logo)
      return await pb.collection('companies').create<CompanyNode>(fd)
    }
    return await pb.collection('companies').create<CompanyNode>({
      ...fields,
      org_id: String(user?.org_id || ''),
      onboarding_status: 'not_started',
    })
  },

  async update(id: string, payload: Partial<CompanyFormPayload>): Promise<CompanyNode> {
    const { logo, ...fields } = payload
    if (logo) {
      const fd = new FormData()
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null) fd.append(key, String(value))
      }
      fd.append('logo', logo)
      return await pb.collection('companies').update<CompanyNode>(id, fd)
    }
    const clean: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) clean[key] = value
    }
    return await pb.collection('companies').update<CompanyNode>(id, clean)
  },

  /** Uso da empresa: quantas vagas e candidaturas estão vinculadas (aviso de exclusão). */
  async getUsage(id: string): Promise<CompanyUsage> {
    try {
      const jobs = await pb.collection('jobs').getList(1, 1, { filter: `company_id = "${id}"` })
      const apps = await pb.collection('applications').getList(1, 1, {
        filter: `job_id.company_id = "${id}"`,
      })
      return { jobs: jobs.totalItems, applications: apps.totalItems }
    } catch (_) {
      // Fallback sem filtro de relação (PocketBase antigo): conta só as vagas
      try {
        const jobs = await pb.collection('jobs').getList(1, 1, { filter: `company_id = "${id}"` })
        return { jobs: jobs.totalItems, applications: 0 }
      } catch (err) {
        console.error('Erro ao calcular uso da empresa:', getErrorMessage(err))
        return { jobs: 0, applications: 0 }
      }
    }
  },

  async delete(id: string): Promise<void> {
    await pb.collection('companies').delete(id)
  },
}
