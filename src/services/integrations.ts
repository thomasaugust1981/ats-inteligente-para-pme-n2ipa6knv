// Serviço do painel de integrações: estado por empresa (coleção
// integration_settings, migração 0021), exportação Goldway e ações de
// WhatsApp/Google Calendar via os conectores da própria conta do usuário.
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { listConnectors, execute, type ConnectorState } from '@/lib/skipConnectors'
import type { Candidate } from '@/types/ats'

export type IntegrationKey = 'goldway' | 'whatsapp' | 'ponto' | 'calendar'

export interface IntegrationSetting {
  id: string
  integration: IntegrationKey | string
  org_id?: string
  company_id?: string
  enabled?: boolean
  config?: Record<string, unknown> | null
  last_sync_at?: string
  last_sync_summary?: string
  created?: string
  updated?: string
  expand?: { company_id?: { name?: string } }
}

export const integrationsService = {
  /** Registros de integração da organização (qualquer empresa). */
  async list(): Promise<IntegrationSetting[]> {
    try {
      return await pb.collection('integration_settings').getFullList<IntegrationSetting>({
        sort: '-created',
      })
    } catch (err) {
      console.error('Erro ao listar integrações:', getErrorMessage(err))
      return []
    }
  },

  async get(integration: IntegrationKey, companyId: string): Promise<IntegrationSetting | null> {
    try {
      return await pb
        .collection('integration_settings')
        .getFirstListItem<IntegrationSetting>(
          `integration = "${integration}" && company_id = "${companyId}"`,
        )
    } catch (_) {
      return null
    }
  },

  /** Cria ou atualiza o registro da integração para a empresa ativa. */
  async save(
    integration: IntegrationKey,
    companyId: string,
    data: {
      enabled: boolean
      config?: Record<string, unknown>
      last_sync_at?: string
      last_sync_summary?: string
    },
  ): Promise<IntegrationSetting> {
    const user = pb.authStore.record as (Record<string, unknown> & { org_id?: string }) | undefined
    const existing = await integrationsService.get(integration, companyId)
    const payload: Record<string, unknown> = {
      integration,
      company_id: companyId,
      org_id: user?.org_id || '',
      enabled: data.enabled,
      config: data.config ?? {},
    }
    if (data.last_sync_at) payload.last_sync_at = data.last_sync_at
    if (data.last_sync_summary !== undefined) payload.last_sync_summary = data.last_sync_summary
    if (existing) {
      return await pb
        .collection('integration_settings')
        .update<IntegrationSetting>(existing.id, payload)
    }
    return await pb.collection('integration_settings').create<IntegrationSetting>(payload)
  },

  /** Status dos conectores da conta deste usuário (whatsapp, googlecalendar…). */
  async connectorStates(): Promise<ConnectorState[]> {
    try {
      return await listConnectors()
    } catch (_) {
      return []
    }
  },
}

// ---------------------------------------------------------------------------
// GOLDWAY — exportação no layout "Cadastro Profissional".
// Somente os NOMES DAS COLUNAS do layout do ERP são usados abaixo; nenhum
// valor/linha de planilha entra no código. A fonte dos dados é o banco
// (candidatos contratados da empresa ativa).
// ---------------------------------------------------------------------------

/** Linha do bloco "Cadastro" do layout Goldway (nomes das colunas do ERP). */
export interface GoldwayCadastroRow {
  'CADASTRO DE FUNCIONÁRIOS': string
  'Número Profissional': string
  'NOME COMPLETO': string
  'CEP:': string
  'ENDEREÇO COMPLETO:': string
  BAIRRO: string
  CIDADE: string
  ESTADO: string
  TELEFONES: string
  'E-MAIL': string
  SEXO: string
  'ESTADO CIVIL': string
  'DATA NASCIMENTO': string
  CPF: string
  'NR CONTRATO': string
  'DATA ADMISSÃO': string
  VINCULO: string
  BANCO: string
  AGENCIA: string
  'TIPO CONTA': string
  'conta / digito': string
  CARGO: string
  'VALOR SALÁRIO': string
  'DESCRIÇÃO DA LOTAÇÃO': string
}

const GOLDWAY_HEADERS: GoldwayCadastroRow = {
  'CADASTRO DE FUNCIONÁRIOS': 'CADASTRO DE FUNCIONÁRIOS',
  'Número Profissional': 'Número Profissional',
  'NOME COMPLETO': 'NOME COMPLETO',
  'CEP:': 'CEP:',
  'ENDEREÇO COMPLETO:': 'ENDEREÇO COMPLETO:',
  BAIRRO: 'BAIRRO',
  CIDADE: 'CIDADE',
  ESTADO: 'ESTADO',
  TELEFONES: 'TELEFONES',
  'E-MAIL': 'E-MAIL',
  SEXO: 'SEXO',
  'ESTADO CIVIL': 'ESTADO CIVIL',
  'DATA NASCIMENTO': 'DATA NASCIMENTO',
  CPF: 'CPF',
  'NR CONTRATO': 'NR CONTRATO',
  'DATA ADMISSÃO': 'DATA ADMISSÃO',
  VINCULO: 'VINCULO',
  BANCO: 'BANCO',
  AGENCIA: 'AGENCIA',
  'TIPO CONTA': 'TIPO CONTA',
  'conta / digito': 'conta / digito',
  CARGO: 'CARGO',
  'VALOR SALÁRIO': 'VALOR SALÁRIO',
  'DESCRIÇÃO DA LOTAÇÃO': 'DESCRIÇÃO DA LOTAÇÃO',
}

const GOLDWAY_COLUMNS = Object.keys(GOLDWAY_HEADERS) as (keyof GoldwayCadastroRow)[]

const onlyDigits = (value: unknown): string => String(value || '').replace(/\D+/g, '')

const formatDateBR = (iso?: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR')
}

/** Aplicação contratada com candidato e vaga expandidos. */
export interface HiredApplication {
  id: string
  candidate_id?: Candidate | { [key: string]: unknown }
  job_id?: { [key: string]: unknown }
  stage_id?: string
  created?: string
  expand?: {
    candidate_id?: Candidate & Record<string, unknown>
    job_id?: Record<string, unknown>
  }
}

/** Busca os contratados da empresa ativa (status hired). */
export async function fetchHiredApplications(companyId: string): Promise<HiredApplication[]> {
  return await pb.collection('applications').getFullList<HiredApplication>({
    filter: `status = "hired" && job_id.company_id = "${companyId}"`,
    sort: '-created',
    expand: 'candidate_id,job_id',
  })
}

/** Monta a linha Cadastro do Goldway a partir de um contratado real do banco. */
export function buildGoldwayRow(app: HiredApplication): GoldwayCadastroRow {
  const cand = (app.expand?.candidate_id || (app.candidate_id as Candidate)) ?? {}
  const job = app.expand?.job_id || {}
  const c = cand as Candidate & Record<string, unknown>
  const location = String(c.location || '')
  const parts = location.split(',').map((p) => p.trim())
  const row: GoldwayCadastroRow = {
    'CADASTRO DE FUNCIONÁRIOS': 'Cadastro',
    'Número Profissional': app.id || '',
    'NOME COMPLETO': String(c.name || ''),
    'CEP:': '',
    'ENDEREÇO COMPLETO:': location,
    BAIRRO: '',
    CIDADE: parts.length > 1 ? parts[parts.length - 2] : '',
    ESTADO: parts.length > 1 ? parts[parts.length - 1].match(/[A-Z]{2}/)?.[0] || '' : '',
    TELEFONES: String(c.phone || ''),
    'E-MAIL': String(c.email || ''),
    SEXO: '',
    'ESTADO CIVIL': '',
    'DATA NASCIMENTO': '',
    CPF: onlyDigits(c.cpf),
    'NR CONTRATO': '',
    'DATA ADMISSÃO': formatDateBR(app.stage_updated_at || app.created),
    VINCULO: String(job.employment_type || '') === 'clt' ? 'Prazo Indeterminado' : '',
    BANCO: '',
    AGENCIA: '',
    'TIPO CONTA': '',
    'conta / digito': '',
    CARGO: String(job.title || ''),
    'VALOR SALÁRIO': job.salary_disclosed && job.salary_max ? String(job.salary_max) : '',
    'DESCRIÇÃO DA LOTAÇÃO': String(job.department || ''),
  }
  return row
}

const csvCell = (value: unknown): string => {
  const s = String(value ?? '')
  return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/**
 * Gera o CSV (separador ";" — padrão de importação de ERPs brasileiros) no
 * layout do Cadastro Profissional. Baixar é responsabilidade da página.
 */
export function buildGoldwayCsv(
  applications: HiredApplication[],
  labelOf: (column: string) => string = (c) => c,
): string {
  const lines: string[] = []
  lines.push(GOLDWAY_COLUMNS.map(labelOf).join(';'))
  for (const app of applications) {
    const row = buildGoldwayRow(app)
    lines.push(GOLDWAY_COLUMNS.map((col) => csvCell(row[col])).join(';'))
  }
  return '\uFEFF' + lines.join('\r\n')
}

// ---------------------------------------------------------------------------
// WHATSAPP / GOOGLE CALENDAR — conectores da conta do próprio usuário
// ---------------------------------------------------------------------------

export const WHATSAPP_TOOLKIT = 'whatsapp'
export const CALENDAR_TOOLKIT = 'googlecalendar'

export async function getToolkitStatus(toolkit: string): Promise<ConnectorState['status']> {
  const states = await integrationsService.connectorStates()
  return states.find((s) => s.toolkit === toolkit)?.status || 'not_connected'
}

/**
 * Envia mensagem de WhatsApp via o conector da conta do usuário. Quando o
 * conector não cobre envio direto, devolve `unsupported` para a página cair
 * no fallback wa.me (conversa aberta com o texto pré-montado).
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string,
): Promise<{ sent: boolean; fallbackWaMe: boolean }> {
  const digits = onlyDigits(phone)
  if (!digits) return { sent: false, fallbackWaMe: true }
  try {
    const result = await execute('WHATSAPP_SEND_MESSAGE', {
      phone_number: '+' + digits,
      message,
    })
    if (result.successful) return { sent: true, fallbackWaMe: false }
    console.warn('WhatsApp via conector não confirmado:', result.error)
    return { sent: false, fallbackWaMe: true }
  } catch (err) {
    console.warn('Envio WhatsApp falhou, usando fallback wa.me:', getErrorMessage(err))
    return { sent: false, fallbackWaMe: true }
  }
}

/** Monta a URL de fallback (conversa aberta com mensagem pronta). */
export function waMeUrl(phone: string, message: string): string {
  return `https://wa.me/${onlyDigits(phone)}?text=${encodeURIComponent(message)}`
}

// ---------------------------------------------------------------------------
// GOLDWAY — IMPORTAÇÃO (arquivo → ATS), com mapeamento ajustável de colunas.
// ---------------------------------------------------------------------------

/** Campos do ATS que a importação do Cadastro Profissional pode preencher. */
export type GoldwayImportFieldKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'cpf'
  | 'location'
  | 'cargo'
  | 'department'
  | 'salary'
  | 'admission_date'

export const GOLDWAY_IMPORT_FIELDS: { key: GoldwayImportFieldKey; label: string }[] = [
  { key: 'name', label: 'Nome completo' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone' },
  { key: 'cpf', label: 'CPF' },
  { key: 'location', label: 'Endereço / Cidade' },
  { key: 'cargo', label: 'Cargo' },
  { key: 'department', label: 'Lotação / Departamento' },
  { key: 'salary', label: 'Salário' },
  { key: 'admission_date', label: 'Data de admissão' },
]

const deaccent = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/** Adivinha o campo de cada coluna a partir do cabeçalho (padrão do organograma). */
export function guessGoldwayMapping(headers: string[]): Record<string, GoldwayImportFieldKey | ''> {
  const map: Record<string, GoldwayImportFieldKey | ''> = {}
  for (const h of headers) {
    const hn = deaccent(h || '')
    let guess: GoldwayImportFieldKey | '' = ''
    if (hn.includes('nome completo') || hn === 'nome') guess = 'name'
    else if (hn.includes('e-mail') || hn.includes('email')) guess = 'email'
    else if (hn.includes('telefone')) guess = 'phone'
    else if (hn === 'cpf' || hn.includes('cpf')) guess = 'cpf'
    else if (hn.includes('endereco') || hn.includes('cep')) guess = 'location'
    else if (hn.includes('cargo')) guess = 'cargo'
    else if (hn.includes('lotac')) guess = 'department'
    else if (hn.includes('salario')) guess = 'salary'
    else if (hn.includes('admiss')) guess = 'admission_date'
    map[h] = guess
  }
  return map
}

/** Linha crua do arquivo (headers → valores), para pré-visualização e importação. */
export interface GoldwayImportRow {
  values: Record<string, string>
  mapped: Partial<Record<GoldwayImportFieldKey, string>>
}

/** Parseia o arquivo (CSV com detecção de delimitador ou planilha colada em TSV). */
export function parseGoldwayFile(
  text: string,
): { headers: string[]; rows: Record<string, string>[] } | null {
  const nl = text.indexOf('\n')
  const firstLine = nl === -1 ? text : text.slice(0, nl)
  const counts: Record<string, number> = {
    ';': (firstLine.match(/;/g) || []).length,
    ',': (firstLine.match(/,/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  }
  let delim = ';'
  let best = 0
  for (const [d, c] of Object.entries(counts))
    if (c > best) {
      best = c
      delim = d
    }
  if (best === 0) return null

  // Parser com suporte a aspas (mesma lógica do importador do organograma).
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === delim) {
      row.push(cur)
      cur = ''
    } else if (ch === '\n') {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else if (ch === '\r') {
      /* ignora */
    } else cur += ch
  }
  if (cur !== '' || row.length) {
    row.push(cur)
    rows.push(row)
  }

  const nonEmpty = rows.filter((r) => r.some((c) => String(c).trim() !== ''))
  if (nonEmpty.length < 2) return null
  const headers = nonEmpty[0].map((h) => (h || '').trim())
  const dataRows = nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = String(r[idx] ?? '').trim()
    })
    return obj
  })
  return { headers, rows: dataRows }
}

/** Aplica o mapeamento (coluna → campo) às linhas cruas. */
export function applyGoldwayMapping(
  rows: Record<string, string>[],
  mapping: Record<string, GoldwayImportFieldKey | ''>,
): GoldwayImportRow[] {
  return rows.map((values) => {
    const mapped: Partial<Record<GoldwayImportFieldKey, string>> = {}
    for (const [col, field] of Object.entries(mapping)) {
      if (field && values[col]) mapped[field] = values[col]
    }
    return { values, mapped }
  })
}

export interface GoldwayImportResult {
  imported: number
  skipped: number
  skipped_reasons: string[]
}

/**
 * Confirma a importação: cria/atualiza candidatos na empresa ativa
 * (dedup por e-mail) e registra a sincronização em integration_settings.
 */
export async function confirmGoldwayImport(
  companyId: string,
  rows: GoldwayImportRow[],
): Promise<GoldwayImportResult> {
  const user = pb.authStore.record as (Record<string, unknown> & { org_id?: string }) | undefined
  const orgId = user?.org_id || ''
  const reasons: string[] = []
  let imported = 0
  let skipped = 0

  for (const r of rows) {
    const name = (r.mapped.name || '').trim()
    const email = (r.mapped.email || '').trim().toLowerCase()
    const cpf = onlyDigits(r.mapped.cpf)
    if (!name || (!email && !cpf)) {
      skipped++
      reasons.push(
        `Linha sem nome ${email || cpf ? '' : 'ou identificador (e-mail/CPF)'}: ${name || '(sem nome)'}`,
      )
      continue
    }
    try {
      let existing: { id: string } | null = null
      if (email) {
        try {
          existing = await pb.collection('candidates').getFirstListItem(`email = "${email}"`, {
            filter: `company_id = "${companyId}"`,
          })
        } catch (_) {
          existing = null
        }
      }
      const payload: Record<string, unknown> = {
        name,
        email: email || `${cpf || `sem-cpf-${Date.now()}`}@sem-email.goldway.local`,
        phone: r.mapped.phone || '',
        cpf: cpf || '',
        location: r.mapped.location || '',
        lgpd_consent: true,
        lgpd_consent_date: new Date().toISOString(),
        lgpd_consent_version: 'goldway-import',
        org_id: orgId,
        company_id: companyId,
      }
      if (existing) {
        await pb.collection('candidates').update(existing.id, payload)
      } else {
        await pb.collection('candidates').create(payload)
      }
      imported++
    } catch (err) {
      skipped++
      reasons.push(`Erro em "${name}": ${getErrorMessage(err)}`)
    }
  }

  const summary = `Importação Goldway: ${imported} importado(s), ${skipped} ignorado(s).`
  await integrationsService
    .save(GOLDWAY_KEY, companyId, { enabled: true, config: {}, last_sync_summary: summary })
    .catch(() => undefined)

  return { imported, skipped, skipped_reasons: reasons.slice(0, 10) }
}

const GOLDWAY_KEY: IntegrationKey = 'goldway'

/** Cria o evento de entrevista no Google Calendar da conta do usuário. */
export async function createCalendarEvent(input: {
  title: string
  startISO: string
  endISO: string
  description?: string
  attendees?: string[]
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await execute('GOOGLECALENDAR_CREATE_EVENT', {
      summary: input.title,
      start: { dateTime: input.startISO },
      end: { dateTime: input.endISO },
      description: input.description || '',
      attendees: (input.attendees || []).map((email) => ({ email })),
    })
    if (result.successful) return { ok: true }
    return { ok: false, error: result.error || 'O Calendar não confirmou a criação do evento.' }
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) }
  }
}
