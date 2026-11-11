import pb from '@/lib/pocketbase/client'
import type { Company } from '@/types/ats'

export const companyService = {
  async getCompany(): Promise<Company | null> {
    try {
      const records = await pb.collection('companies').getList<Company>(1, 1)
      return records.items[0] || null
    } catch (err) {
      console.error('Error fetching company:', err)
      return null
    }
  },

  async updateCompany(id: string, data: Partial<Company>): Promise<Company> {
    return await pb.collection('companies').update<Company>(id, data)
  },

  getLogoUrl(company: Company): string | null {
    if (!company.logo) return null
    return pb.files.getURL(company, company.logo)
  },
}
