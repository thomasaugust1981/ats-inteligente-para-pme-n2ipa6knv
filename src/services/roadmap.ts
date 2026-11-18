import pb from '@/lib/pocketbase/client'
import { withFreshToken } from '@/lib/pocketbase/freshToken'

export interface RoadmapItem {
  id: string
  org_id: string
  title: string
  description?: string
  done: boolean
  created_by?: string
  created: string
  updated: string
}

const SORT = '-created'

function sortRoadmapItems(items: RoadmapItem[]): RoadmapItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return a.created < b.created ? 1 : a.created > b.created ? -1 : 0
  })
}

export const roadmapService = {
  sort: sortRoadmapItems,

  async list(orgId: string): Promise<RoadmapItem[]> {
    return withFreshToken(async () => {
      const records = await pb.collection('roadmap_items').getFullList({
        filter: `org_id = "${orgId}"`,
        sort: SORT,
      })
      return records as unknown as RoadmapItem[]
    })
  },

  async create(payload: {
    org_id: string
    title: string
    description?: string
    created_by?: string
  }): Promise<RoadmapItem> {
    return withFreshToken(async () => {
      const record = await pb.collection('roadmap_items').create(payload)
      return record as unknown as RoadmapItem
    })
  },

  async update(id: string, data: { done?: boolean }): Promise<RoadmapItem> {
    return withFreshToken(async () => {
      const record = await pb.collection('roadmap_items').update(id, data)
      return record as unknown as RoadmapItem
    })
  },

  async remove(id: string): Promise<void> {
    await withFreshToken(async () => {
      await pb.collection('roadmap_items').delete(id)
    })
  },
}
