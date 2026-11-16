// Diálogos do cartão Goldway: exportação (com mapeamento de colunas visível)
// e importação (arquivo → pré-visualização → confirmação), no padrão do
// importador CSV do organograma (parse com detecção de delimitador + mapping).
import { useMemo, useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  GOLDWAY_IMPORT_FIELDS,
  applyGoldwayMapping,
  buildGoldwayCsv,
  confirmGoldwayImport,
  guessGoldwayMapping,
  parseGoldwayFile,
  type GoldwayImportFieldKey,
  type GoldwayImportRow,
  type HiredApplication,
} from '@/services/integrations'

// ---------------------------------------------------------------------------
// EXPORTAÇÃO — mostra o mapeamento de colunas (layout Cadastro Profissional)
// e permite renomear cada coluna antes de gerar o arquivo.
// ---------------------------------------------------------------------------

export const GOLDWAY_EXPORT_COLUMNS: { key: string; label: string; source: string }[] = [
  { key: 'Número Profissional', label: 'Número Profissional', source: 'ID da candidatura' },
  { key: 'NOME COMPLETO', label: 'NOME COMPLETO', source: 'Nome do candidato' },
  { key: 'ENDEREÇO COMPLETO:', label: 'ENDEREÇO COMPLETO:', source: 'Localidade do candidato' },
  { key: 'CIDADE', label: 'CIDADE', source: 'Cidade (da localidade)' },
  { key: 'ESTADO', label: 'ESTADO', source: 'UF (da localidade)' },
  { key: 'TELEFONES', label: 'TELEFONES', source: 'Telefone do candidato' },
  { key: 'E-MAIL', label: 'E-MAIL', source: 'E-mail do candidato' },
  { key: 'DATA NASCIMENTO', label: 'DATA NASCIMENTO', source: '— (não coletado)' },
  { key: 'CPF', label: 'CPF', source: 'CPF do candidato' },
  { key: 'DATA ADMISSÃO', label: 'DATA ADMISSÃO', source: 'Data de contratação' },
  { key: 'VINCULO', label: 'VINCULO', source: 'Tipo de emprego da vaga' },
  { key: 'CARGO', label: 'CARGO', source: 'Título da vaga' },
  { key: 'VALOR SALÁRIO', label: 'VALOR SALÁRIO', source: 'Salário máximo da vaga' },
  { key: 'DESCRIÇÃO DA LOTAÇÃO', label: 'DESCRIÇÃO DA LOTAÇÃO', source: 'Departamento da vaga' },
]

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hired: HiredApplication[]
  companyName: string
  onExported: (count: number) => void
}

export function GoldwayExportDialog({
  open,
  onOpenChange,
  hired,
  companyName,
  onExported,
}: ExportDialogProps) {
  const { toast } = useToast()
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(GOLDWAY_EXPORT_COLUMNS.map((c) => [c.key, c.label])),
  )

  const generate = () => {
    if (hired.length === 0) return
    const csv = buildGoldwayCsv(hired, (col) => labels[col] || col)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const slug = companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    a.href = url
    a.download = `goldway-cadastro-profissional-${slug}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    onExported(hired.length)
    onOpenChange(false)
    toast({
      title: 'Planilha gerada',
      description: `${hired.length} contratado(s) exportado(s) no layout do Cadastro Profissional.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar contratados — layout Goldway</DialogTitle>
          <DialogDescription>
            {hired.length} contratado(s) da empresa ativa serão exportados. Ajuste o nome de cada
            coluna abaixo para casar com o layout real do seu ERP, se necessário.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh] pr-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 font-medium">Coluna no arquivo</th>
                <th className="py-2 font-medium">Origem no ATS</th>
              </tr>
            </thead>
            <tbody>
              {GOLDWAY_EXPORT_COLUMNS.map((col) => (
                <tr key={col.key} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <input
                      value={labels[col.key]}
                      onChange={(e) => setLabels((p) => ({ ...p, [col.key]: e.target.value }))}
                      className="w-full rounded-md border px-2 py-1 text-sm bg-background"
                      aria-label={`Coluna ${col.label}`}
                    />
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">{col.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={generate} disabled={hired.length === 0}>
            Gerar arquivo CSV ({hired.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// IMPORTAÇÃO — arquivo → mapeamento → pré-visualização → confirmação.
// ---------------------------------------------------------------------------

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  onImported: () => void
}

export function GoldwayImportDialog({
  open,
  onOpenChange,
  companyId,
  onImported,
}: ImportDialogProps) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, GoldwayImportFieldKey | ''>>({})
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)

  const mappedRows: GoldwayImportRow[] = useMemo(
    () => (rawRows.length ? applyGoldwayMapping(rawRows, mapping) : []),
    [rawRows, mapping],
  )

  const reset = () => {
    setHeaders([])
    setRawRows([])
    setMapping({})
    setResult(null)
  }

  const readFile = async (file: File) => {
    setReading(true)
    setResult(null)
    try {
      const text = await file.text()
      const parsed = parseGoldwayFile(text)
      if (!parsed) {
        toast({
          title: 'Arquivo não reconhecido',
          description: 'Use um CSV (";" ou ",") ou uma planilha copiada e colada (tabulado).',
          variant: 'destructive',
        })
        return
      }
      setHeaders(parsed.headers)
      setRawRows(parsed.rows)
      setMapping(guessGoldwayMapping(parsed.headers))
    } finally {
      setReading(false)
    }
  }

  const fieldLabel = (key: GoldwayImportFieldKey | '') =>
    key ? GOLDWAY_IMPORT_FIELDS.find((f) => f.key === key)?.label || key : '(ignorar)'

  const confirm = async () => {
    setConfirming(true)
    try {
      const res = await confirmGoldwayImport(companyId, mappedRows)
      setResult({ imported: res.imported, skipped: res.skipped })
      onImported()
      toast({
        title: 'Importação concluída',
        description: `${res.imported} importado(s), ${res.skipped} ignorado(s).`,
      })
    } catch (err) {
      toast({
        title: 'Falha na importação',
        description: err instanceof Error ? err.message : 'Erro inesperado.',
        variant: 'destructive',
      })
    } finally {
      setConfirming(false)
    }
  }

  const closable = !confirming
  const validCount = mappedRows.filter((r) => (r.mapped.name || '').trim()).length

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && closable) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar cadastro do Goldway</DialogTitle>
          <DialogDescription>
            Selecione a planilha exportada do ERP (layout Cadastro Profissional). Você confere uma
            pré-visualização antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {headers.length === 0 ? (
          <div
            className={cn(
              'border-2 border-dashed rounded-lg py-10 text-center cursor-pointer hover:bg-muted/40 transition',
              reading && 'opacity-60 pointer-events-none',
            )}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          >
            {reading ? (
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
            )}
            <p className="mt-2 text-sm font-medium">Selecionar arquivo CSV</p>
            <p className="text-xs text-muted-foreground">
              Delimitador ";" ou "," detectado automaticamente
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mapeamento de colunas */}
            <div>
              <p className="text-sm font-medium mb-2">Mapeamento de colunas</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground truncate flex-1" title={h}>
                      {h}
                    </span>
                    <Select
                      value={mapping[h] || ''}
                      onValueChange={(v) =>
                        setMapping((p) => ({ ...p, [h]: (v || '') as GoldwayImportFieldKey | '' }))
                      }
                    >
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue placeholder="(ignorar)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">(ignorar)</SelectItem>
                        {GOLDWAY_IMPORT_FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Pré-visualização */}
            <div>
              <p className="text-sm font-medium mb-2">
                Pré-visualização{' '}
                <Badge variant="secondary" className="ml-1">
                  {rawRows.length} linha(s)
                </Badge>
              </p>
              <ScrollArea className="max-h-64 rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {GOLDWAY_IMPORT_FIELDS.map((f) => (
                        <th key={f.key} className="px-2 py-1.5 text-left font-medium">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t">
                        {GOLDWAY_IMPORT_FIELDS.map((f) => (
                          <td
                            key={f.key}
                            className={cn(
                              'px-2 py-1 max-w-32 truncate',
                              !r.mapped[f.key] && 'text-muted-foreground/50',
                            )}
                            title={r.mapped[f.key] || ''}
                          >
                            {r.mapped[f.key] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
              <p className="mt-1 text-xs text-muted-foreground">
                {validCount} linha(s) com nome preenchido · {rawRows.length - validCount} serão
                ignoradas
              </p>
            </div>

            {result && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                Importação anterior: <span className="font-medium">{result.imported}</span>{' '}
                importado(s), <span className="font-medium">{result.skipped}</span> ignorado(s).
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {headers.length > 0 && (
            <Button variant="ghost" onClick={reset} disabled={confirming}>
              Trocar arquivo
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            Fechar
          </Button>
          <Button
            onClick={confirm}
            disabled={confirming || headers.length === 0 || validCount === 0}
          >
            {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar importação
          </Button>
        </DialogFooter>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void readFile(f)
            e.target.value = ''
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
