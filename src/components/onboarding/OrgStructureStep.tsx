/**
 * OrgStructureStep — passo opcional "Estrutura Organizacional" do onboarding.
 * Mantém a lógica de detecção/resumo/importação isolada para não inflar a
 * OnboardingPage (que já é grande). Reaproveita o mesmo formato de dados do
 * importador CSV do organograma standalone (public/organograma.html) e grava
 * na coleção central org_nodes pelas API rules públicas (mesmo contrato de
 * syncToCloud: POST/PATCH por node_key, nunca DELETE — o sweep só existe lá).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Network,
  Users,
  Building2,
  Briefcase,
  ExternalLink,
  Upload,
  Loader2,
  FileSpreadsheet,
  PencilRuler,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react'

/** Campos mapeáveis — mesmos do importador do organograma. */
const IMPORT_FIELDS = [
  { key: 'nome', label: 'Nome *' },
  { key: 'cargo', label: 'Cargo *' },
  { key: 'area', label: 'Área *' },
  { key: 'gestor', label: 'Gestor (nome)' },
  { key: 'email', label: 'E-mail' },
  { key: 'localidade', label: 'Localidade' },
  { key: 'tipoContrato', label: 'Tipo de contrato' },
  { key: 'dataInicio', label: 'Data de início' },
  { key: 'status', label: 'Status' },
] as const

type ImportFieldKey = (typeof IMPORT_FIELDS)[number]['key']

type MappedNode = {
  nome: string
  cargo: string
  area: string
  email: string
  localidade: string
  tipoContrato: string
  dataInicio: string
  status: string
  gestorName: string
}

export type OrgSummary = {
  total: number
  areas: number
  vagasAbertas: number
}

type Phase = 'loading' | 'empty' | 'existing' | 'importing' | 'done'

/** CSV: detecta delimitador e faz parse com suporte a aspas (igual ao organograma). */
export function parseCsvRows(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '')
  const nl = text.indexOf('\n')
  const firstLine = nl === -1 ? text : text.slice(0, nl)
  const counts = {
    ',': (firstLine.match(/,/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  }
  let delim = ','
  let best = 0
  for (const [d, c] of Object.entries(counts))
    if (c > best) {
      best = c
      delim = d
    }
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
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

function deaccent(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Adivinha o campo de cada coluna (mesmas heurísticas do organograma). */
function guessMapping(headers: string[]): Record<string, ImportFieldKey | ''> {
  const map: Record<string, ImportFieldKey | ''> = {}
  for (const h of headers) {
    const hn = deaccent(h || '')
    let guess: ImportFieldKey | '' = ''
    if (hn.includes('nome') || hn === 'colaborador') guess = 'nome'
    else if (hn.includes('cargo') || hn.includes('funcao') || hn.includes('titul')) guess = 'cargo'
    else if (hn.includes('area') || hn.includes('depart') || hn.includes('setor')) guess = 'area'
    else if (hn.includes('email') || hn.includes('e-mail')) guess = 'email'
    else if (
      hn.includes('local') ||
      hn.includes('cidade') ||
      hn.includes('filial') ||
      hn.includes('unidade')
    )
      guess = 'localidade'
    else if (hn.includes('contrato') || hn.includes('regime')) guess = 'tipoContrato'
    else if (hn.includes('inicio') || hn.includes('admiss') || hn.includes('data'))
      guess = 'dataInicio'
    else if (hn.includes('status') || hn.includes('situa')) guess = 'status'
    else if (
      hn.includes('gestor') ||
      hn.includes('lider') ||
      hn.includes('report') ||
      hn.includes('chefe')
    )
      guess = 'gestor'
    map[h] = guess
  }
  return map
}

function normalizeStatus(v: string): string {
  const s = deaccent(v || '').trim()
  if (!s) return 'ativo'
  if (s.includes('vaga') || s.includes('aberta') || s.includes('aberto')) return 'vaga_aberta'
  if (s.includes('tempor')) return 'temporaria'
  if (s.includes('inat') || s.includes('afast') || s.includes('licen')) return 'inativo'
  return 'ativo'
}

function parseDateBR(v: string): string {
  const s = (v || '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    let y = m[3]
    if (y.length === 2) y = '20' + y
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return ''
}

function mapContract(v: string): string {
  const t = String(v || '').toLowerCase()
  if (t.includes('estágio') || t === 'internship') return 'internship'
  if (t.includes('tempor') || t === 'temporary') return 'temporary'
  if (t === 'pj') return 'pj'
  return 'clt'
}

/** Converte as linhas mapeadas em nós (linhas sem nome/cargo/área são ignoradas). */
function buildMappedNodes(
  headers: string[],
  rows: string[][],
  map: Record<string, ImportFieldKey | ''>,
): MappedNode[] {
  const out: MappedNode[] = []
  for (const r of rows) {
    const rec: Record<string, string> = {}
    for (const h of headers) {
      const key = map[h]
      if (key && key !== 'gestor') rec[key] = String(r[headers.indexOf(h)] || '').trim()
    }
    const gestorHeader = headers.find((hh) => map[hh] === 'gestor')
    const gestorName = gestorHeader ? String(r[headers.indexOf(gestorHeader)] || '').trim() : ''
    if (!rec.nome || !rec.cargo || !rec.area) continue
    out.push({
      nome: rec.nome,
      cargo: rec.cargo,
      area: rec.area,
      email: rec.email || '',
      localidade: rec.localidade || '',
      tipoContrato: rec.tipoContrato || 'CLT',
      dataInicio: parseDateBR(rec.dataInicio),
      status: normalizeStatus(rec.status),
      gestorName,
    })
  }
  return out
}

export default function OrgStructureStep({
  companyName,
  onImported,
}: {
  companyName: string
  onImported: (summary: OrgSummary | null) => void
}) {
  const { toast } = useToast()
  const [phase, setPhase] = useState<Phase>('loading')
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [checking, setChecking] = useState(true)
  const [importing, setImporting] = useState(false)

  // Estado do importador (arquivo → mapeamento → prévia → gravação)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [map, setMap] = useState<Record<string, ImportFieldKey | ''>>({})
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const apiUrl =
    ((import.meta.env.VITE_POCKETBASE_URL || '') as string).replace(/\/+$/, '') +
    '/api/collections/org_nodes/records'

  /** Busca os nós existentes no banco central (mesma coleção do /organograma). */
  const checkExisting = useCallback(
    async (silent = false): Promise<OrgSummary | null> => {
      setChecking(true)
      try {
        const recs = await pb.collection('org_nodes').getFullList<{
          id: string
          area: string
          status: string
        }>({
          filter: `company = "${(companyName || '').replace(/"/g, '\\"')}"`,
          sort: 'created',
        })
        const s: OrgSummary = {
          total: recs.length,
          areas: new Set(recs.map((r) => (r.area || '').trim().toLowerCase()).filter(Boolean)).size,
          vagasAbertas: recs.filter((r) => r.status === 'vaga_aberta').length,
        }
        setSummary(s)
        setPhase(s.total > 0 ? 'existing' : 'empty')
        return s
      } catch (err) {
        // sem resposta do banco: trata como vazio, mas mantém o passo opcional
        if (!silent)
          toast({
            title: 'Não foi possível consultar a estrutura',
            description:
              err instanceof Error
                ? err.message
                : 'Verifique sua conexão. Você pode importar agora ou montar depois no organograma.',
            variant: 'destructive',
          })
        setSummary(null)
        setPhase('empty')
        return null
      } finally {
        setChecking(false)
      }
    },
    [companyName, toast],
  )

  useEffect(() => {
    checkExisting()
  }, [checkExisting])

  const readFile = (f: File) => {
    const name = (f.name || '').toLowerCase()
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      toast({
        title: 'Planilha Excel não suportada',
        description: 'No Excel, salve a planilha como CSV e importe o .csv.',
        variant: 'destructive',
      })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseCsvRows(String(reader.result))
      if (parsed.length < 2) {
        toast({
          title: 'Arquivo vazio',
          description:
            'Não foi possível ler linhas de dados (precisa de cabeçalho + ao menos 1 linha).',
          variant: 'destructive',
        })
        return
      }
      const hs = parsed[0].map((h) => h.trim())
      setHeaders(hs)
      setRows(parsed.slice(1))
      setMap(guessMapping(hs))
      setFileName(f.name)
      setShowPreview(false)
    }
    reader.readAsText(f, 'utf-8')
  }

  const mappedNodes = showPreview ? buildMappedNodes(headers, rows, map) : []
  const invalidRows = rows.length - mappedNodes.length

  /** Grava os nós importados no banco central, resolvendo gestores pelo nome. */
  const confirmImport = async () => {
    if (importing) return
    setImporting(true)
    try {
      // resolve gestores pelo nome exato (case-insensitive), como no organograma
      const byName = new Map<string, string>()
      for (const n of mappedNodes) byName.set((n.nome || '').trim().toLowerCase(), n.nome)
      const uniqueName = new Set<string>()
      let payload = mappedNodes.map((n) => {
        let nodeKey = `onb-${n.nome.trim().toLowerCase().replace(/\s+/g, '-')}`
        // dedup de nomes repetidos: acrescenta sufixo numérico
        if (uniqueName.has(nodeKey)) {
          let i = 2
          while (uniqueName.has(`${nodeKey}-${i}`)) i++
          nodeKey = `${nodeKey}-${i}`
        }
        uniqueName.add(nodeKey)
        const gestorName = n.gestorName
        let manager = ''
        if (gestorName) {
          const g = byName.get(gestorName.trim().toLowerCase())
          if (g && g !== n.nome) manager = g
        }
        const status = n.status || 'ativo'
        return {
          node_key: nodeKey,
          name: n.nome,
          role_title: n.cargo,
          area: n.area,
          manager: manager,
          email: n.email || '',
          location: n.localidade || '',
          contract_type: mapContract(n.tipoContrato),
          start_date: n.dataInicio || '',
          status: status,
          photo_url: '',
          company: companyName,
        }
      })
      // manager agora aponta para o node_key do gestor (resolvido na 2ª passada)
      const keyByName = new Map<string, string>()
      for (const p of payload) keyByName.set(p.name.trim().toLowerCase(), p.node_key)
      payload = payload.map((p) => ({
        ...p,
        manager: p.manager ? keyByName.get(p.manager.trim().toLowerCase()) || '' : '',
      }))

      // cria os registros (POST, mesma chamada do syncToCloud do organograma)
      for (const p of payload) {
        await pb.collection('org_nodes').create(p)
      }
      const areas = new Set(payload.map((p) => (p.area || '').trim().toLowerCase()).filter(Boolean))
        .size
      const vagas = payload.filter((p) => p.status === 'vaga_aberta').length
      const result = { total: payload.length, areas, vagasAbertas: vagas }
      toast({
        title: 'Estrutura importada!',
        description: `${payload.length} colaborador(es) gravados no organograma.`,
      })
      onImported(result)
      setSummary(result)
      setPhase('done')
    } catch (err) {
      toast({
        title: 'Erro ao importar estrutura',
        description:
          err instanceof Error
            ? err.message
            : 'Alguns nós podem não ter sido gravados. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  const resetImporter = () => {
    setHeaders([])
    setRows([])
    setMap({})
    setFileName('')
    setShowPreview(false)
  }

  if (phase === 'loading' || checking) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Verificando estrutura existente...
      </div>
    )
  }

  /* ---------------- Estrutura já existe: resumo ---------------- */
  if (phase === 'existing' || phase === 'done') {
    const s = summary || { total: 0, areas: 0, vagasAbertas: 0 }
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Network className="w-5 h-5 text-sky-600" />
            Estrutura Organizacional
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {phase === 'done'
              ? 'Estrutura importada com sucesso para o organograma.'
              : 'Sua empresa já possui uma estrutura registrada no organograma.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="border rounded-lg p-3 flex items-center gap-3">
            <Users className="w-5 h-5 text-sky-600" />
            <div>
              <p className="text-lg font-bold leading-none">{s.total}</p>
              <p className="text-[10px] text-slate-500">colaboradores</p>
            </div>
          </div>
          <div className="border rounded-lg p-3 flex items-center gap-3">
            <Building2 className="w-5 h-5 text-sky-600" />
            <div>
              <p className="text-lg font-bold leading-none">{s.areas}</p>
              <p className="text-[10px] text-slate-500">áreas</p>
            </div>
          </div>
          <div className="border rounded-lg p-3 flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-sky-600" />
            <div>
              <p className="text-lg font-bold leading-none">{s.vagasAbertas}</p>
              <p className="text-[10px] text-slate-500">vagas abertas</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => window.open('/organograma', '_blank')}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1" />
            Abrir organograma
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setPhase('empty')}>
            Importar outro CSV
          </Button>
        </div>
      </div>
    )
  }

  /* ---------------- Estrutura vazia: escolha ---------------- */
  const hasFile = headers.length > 0
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Network className="w-5 h-5 text-sky-600" />
          Estrutura Organizacional
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Opcional. Importe um CSV com os colaboradores (nome, cargo, área) ou monte a estrutura
          depois no organograma. Pular não bloqueia a conclusão.
        </p>
      </div>

      {!hasFile && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-left border rounded-xl p-4 hover:border-sky-300 hover:bg-sky-50/50 transition"
          >
            <FileSpreadsheet className="w-6 h-6 text-sky-600 mb-2" />
            <p className="text-sm font-bold">Importar CSV</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Nome, cargo, área e gestor por linha. Mapeamento de colunas com prévia antes de
              confirmar.
            </p>
          </button>
          <button
            type="button"
            onClick={() => window.open('/organograma', '_blank')}
            className="text-left border rounded-xl p-4 hover:border-sky-300 hover:bg-sky-50/50 transition"
          >
            <PencilRuler className="w-6 h-6 text-sky-600 mb-2" />
            <p className="text-sm font-bold">Montar depois no organograma</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Abre o editor visual (/organograma). Você pode arrastar, editar e importar lá depois.
            </p>
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) readFile(f)
          e.target.value = ''
        }}
      />

      {hasFile && !showPreview && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FileSpreadsheet className="w-4 h-4 text-sky-600" />
            <span className="font-medium truncate max-w-[200px]">{fileName}</span>
            <span className="text-slate-400">· {rows.length} linha(s) de dados</span>
            <button
              type="button"
              onClick={resetImporter}
              className="ml-auto text-slate-400 hover:text-rose-600"
            >
              trocar arquivo
            </button>
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">
                    Coluna do arquivo
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">
                    Campo do organograma
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {headers.map((h) => (
                  <tr key={h}>
                    <td className="px-3 py-2 truncate max-w-[160px]">{h || '(coluna vazia)'}</td>
                    <td className="px-3 py-2">
                      <Select
                        value={map[h] || 'none'}
                        onValueChange={(v) =>
                          setMap((m) => ({ ...m, [h]: v === 'none' ? '' : (v as ImportFieldKey) }))
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-full max-w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— ignorar coluna —</SelectItem>
                          {IMPORT_FIELDS.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              className="bg-sky-600 hover:bg-sky-700 text-xs"
              onClick={() => {
                if (!Object.values(map).includes('nome')) {
                  toast({
                    title: 'Mapeie a coluna Nome',
                    description: 'Pelo menos uma coluna precisa ser marcada como Nome.',
                    variant: 'destructive',
                  })
                  return
                }
                setShowPreview(true)
              }}
            >
              Pré-visualizar
            </Button>
          </div>
        </div>
      )}

      {hasFile && showPreview && (
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            <b>{mappedNodes.length}</b> linha(s) válidas para importação.
            {invalidRows > 0 && (
              <span className="text-amber-700">
                {' '}
                {invalidRows} linha(s) serão ignoradas por falta de nome, cargo ou área.
              </span>
            )}
          </p>
          <div className="border rounded-lg max-h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr className="bg-slate-50 border-b">
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Nome</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Cargo</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Área</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Gestor</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mappedNodes.slice(0, 10).map((n, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 truncate max-w-[140px]">{n.nome}</td>
                    <td className="px-3 py-1.5 truncate max-w-[140px]">{n.cargo}</td>
                    <td className="px-3 py-1.5 truncate max-w-[120px]">{n.area}</td>
                    <td className="px-3 py-1.5 truncate max-w-[120px]">{n.gestorName || '—'}</td>
                    <td className="px-3 py-1.5">{n.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mappedNodes.length > 10 && (
            <p className="text-[11px] text-slate-400">
              Mostrando as 10 primeiras de {mappedNodes.length} linhas.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setShowPreview(false)}
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Voltar
            </Button>
            <Button
              size="sm"
              className="bg-sky-600 hover:bg-sky-700 text-xs"
              disabled={importing || mappedNodes.length === 0}
              onClick={confirmImport}
            >
              {importing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Importando...
                </>
              ) : (
                'Confirmar importação'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
