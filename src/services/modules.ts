// Licenciamento de módulos à parte (coleção org_modules — migração 0034).
// O superadmin licencia módulos por organização; o restante do app consulta o
// status via rota do hook GET /backend/v1/indicators/status (ou lê a coleção
// diretamente, regra: leitura da própria org, escrita exclusiva de superadmin).
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'

/** Registro de licença de um módulo para uma organização. */
export interface OrgModuleRecord {
  id: string
  org_id: string
  module: string
  licensed: boolean
  licensed_until?: string | null
  notes?: string | null
  created?: string
  updated?: string
  expand?: { org_id?: { id: string; name: string; slug: string } }
}

/** Resposta da rota GET /backend/v1/indicators/status. */
export interface IndicatorsStatus {
  licensed: boolean
  module: string
  org: { id: string; name: string } | null
  licensed_until?: string
}

/** Lista as licenças de módulos da organização (uso do painel superadmin). */
export async function listOrgModules(): Promise<OrgModuleRecord[]> {
  try {
    return await pb.collection('org_modules').getFullList<OrgModuleRecord>({
      sort: '-created',
      expand: 'org_id',
    })
  } catch (err) {
    console.error('Erro ao carregar licenças de módulos:', getErrorMessage(err))
    return []
  }
}

/** Cria (ou liga) a licença de um módulo para a organização. */
export async function setModuleLicensed(
  orgId: string,
  moduleName: string,
  licensed: boolean,
  licensedUntil?: string | null,
): Promise<void> {
  const existing = await pb
    .collection('org_modules')
    .getFullList<OrgModuleRecord>({ filter: `org_id = "${orgId}" && module = "${moduleName}"` })

  if (existing.length > 0) {
    await pb.collection('org_modules').update(existing[0].id, {
      licensed,
      licensed_until: licensedUntil || '',
    })
    return
  }

  await pb.collection('org_modules').create({
    org_id: orgId,
    module: moduleName,
    licensed,
    licensed_until: licensedUntil || '',
  })
}

/** Consulta o status do módulo Indicadores para a org do usuário logado. */
export async function getIndicatorsStatus(): Promise<IndicatorsStatus> {
  const res = await fetch(`${pb.buildUrl('')}/backend/v1/indicators/status`, {
    headers: { Authorization: pb.authStore.token },
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || 'Falha ao consultar o status do módulo Indicadores.')
  }
  return (await res.json()) as IndicatorsStatus
}
