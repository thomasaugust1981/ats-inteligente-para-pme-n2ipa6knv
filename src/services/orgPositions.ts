import pb from '@/lib/pocketbase/client'

/**
 * Posições do organograma VIGENTE (versão APROVADA = vigente) para vincular
 * ao cargo. Usa o mesmo caminho que a página pública (organograma.html):
 *   1. org_versions com status APROVADA (a vigente; ARQUIVADA = anteriores)
 *   2. org_nodes dessa versão (ativas, com nível preenchido)
 */
export interface OrgPositionOption {
  id: string
  title: string
  level: string
  area: string
  path: string
}

export const orgPositionsService = {
  async listActive(): Promise<OrgPositionOption[]> {
    const version = await pb
      .collection('org_versions')
      .getFirstListItem<Record<string, unknown>>('status="APROVADA"', {
        sort: '-created',
      })
    const nodes = await pb.collection('org_nodes').getFullList<{
      id: string
      title: string
      level: string
      area: string
      path: string
      status: string
    }>({
      filter: `org_version_id="${version.id}" && status="ATIVA"`,
      sort: 'path',
    })
    return nodes
      .filter((n) => String(n.level || '') !== '')
      .map((n) => ({
        id: n.id,
        title: String(n.title || ''),
        level: String(n.level || ''),
        area: String(n.area || ''),
        path: String(n.path || ''),
      }))
  },
}

// OrgPositionOption já é exportado na declaração do tipo (linha 9) — re-export
// duplicado gerava TS2484.
