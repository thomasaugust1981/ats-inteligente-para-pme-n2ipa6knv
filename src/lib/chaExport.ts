//
// FASE 3 do modelo CHA — exportações.
//
//   • exportChaEvaluationsCsv: planilha das avaliações CHA de uma vaga
//     (padrão do exportador Goldway: separador ";", BOM para o Excel
//     preservar acentos, download via Blob).
//   • exportCargoPdf: descrição do cargo em PDF via a caixa de impressão do
//     navegador (window.print com stylesheet @media print) — sem dependência
//     nova, mesmo mecanismo leve já usado pelo app para saídas de documento.
//

import { CHA_BLOCK_KEYS, CHA_BLOCK_META, type ChaBlockKey } from '@/lib/cha'
import {
  CHA_EVAL_BLOCK_LABELS,
  type ChaEvalItem,
  type ChaEvaluation,
  parseGrades,
} from '@/services/chaEvaluation'
import type { Cargo } from '@/types/ats'

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const csvCell = (value: unknown): string => {
  const s = String(value ?? '')
  return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const slugifyFile = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const fmtDate = (iso?: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export interface ChaCsvRow {
  candidateName: string
  jobTitle: string
  cargoTitle?: string
  items: ChaEvalItem[] // requisitos com nota (parseGrades da ficha)
  weightedScore: number
  blockScores: Record<string, number> | null
  evaluatorName?: string
  evaluatedAt?: string
}

/**
 * CSV das avaliações CHA: uma linha por candidato; uma coluna por requisito
 * (nota 0-5) + colunas de evidências (mesma ordem), blocos, score ponderado,
 * avaliador e data.
 */
export function buildChaEvaluationsCsv(rows: ChaCsvRow[]): string {
  const reqCols = rows[0]?.items ?? []
  const header: string[] = ['Candidato', 'Vaga', 'Cargo']
  for (const it of reqCols) {
    header.push(
      `${it.block ? CHA_EVAL_BLOCK_LABELS[it.block as ChaBlockKey] || it.block : it.block} — ${it.description}`,
    )
  }
  for (const it of reqCols) {
    header.push(`Evidência — ${it.description}`)
  }
  for (const b of CHA_BLOCK_KEYS) header.push(`Bloco: ${CHA_BLOCK_META[b].label} (%)`)
  header.push('Score ponderado (%)', 'Avaliador', 'Data da avaliação')

  const lines = [header.map(csvCell).join(';')]
  for (const row of rows) {
    const cells: string[] = [
      row.candidateName,
      row.jobTitle,
      row.cargoTitle || '',
      ...reqCols.map((col) => {
        const found = row.items.find((it) => it.key === col.key)
        return found ? String(found.grade) : ''
      }),
      ...reqCols.map((col) => {
        const found = row.items.find((it) => it.key === col.key)
        return found?.evidence || ''
      }),
      ...CHA_BLOCK_KEYS.map((b) => String(row.blockScores?.[b] ?? '')),
      String(row.weightedScore),
      row.evaluatorName || '',
      fmtDate(row.evaluatedAt),
    ]
    lines.push(cells.map(csvCell).join(';'))
  }
  return '\uFEFF' + lines.join('\r\n')
}

export function exportChaEvaluationsCsv(rows: ChaCsvRow[], jobTitle: string): void {
  if (rows.length === 0) return
  const csv = buildChaEvaluationsCsv(rows)
  downloadBlob(csv, `avaliacoes-cha-${slugifyFile(jobTitle)}.csv`, 'text/csv;charset=utf-8;')
}

// ---------------------------------------------------------------------------
// PDF — descrição do cargo (impressão → "Salvar como PDF")
// ---------------------------------------------------------------------------

const BRL = (n: number | null | undefined): string =>
  n == null || isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      })

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export interface CargoPdfData {
  title: string
  area?: string
  level?: string
  levelLabel?: string
  mission?: string
  salaryMin?: number | null
  salaryMed?: number | null
  salaryMax?: number | null
  cha: Record<string, { items?: { description: string; required: boolean; weight: number }[] }>
}

export function exportCargoPdf(cargo: CargoPdfData, orgName = ''): void {
  const salaryLine =
    cargo.salaryMin != null || cargo.salaryMed != null || cargo.salaryMax != null
      ? `De ${BRL(cargo.salaryMin)} a ${BRL(cargo.salaryMax)}${
          cargo.salaryMed != null ? ` · médio ${BRL(cargo.salaryMed)}` : ''
        }`
      : 'Faixa salarial não definida'

  const blocksHtml = CHA_BLOCK_KEYS.map((key) => {
    const items = cargo.cha?.[key]?.items || []
    const rows = items
      .map(
        (it) =>
          `<tr><td>${esc(it.description)}</td><td class="c">${it.required ? 'Obrigatório' : 'Desejável'}</td><td class="c">${it.weight}</td></tr>`,
      )
      .join('')
    return `<section><h2>${esc(CHA_BLOCK_META[key].label)}</h2>${
      rows
        ? `<table><thead><tr><th>Requisito</th><th class="c">Exigência</th><th class="c">Peso (1-5)</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p class="empty">Nenhum requisito neste bloco.</p>'
    }</section>`
  }).join('')

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${esc(cargo.title)} — Descrição de cargo</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1e293b; margin: 40px; max-width: 780px; }
  header { border-bottom: 3px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
  header small { color: #64748b; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
  h1 { font-size: 22px; margin: 6px 0 4px; }
  .meta { font-size: 12px; color: #475569; }
  .meta span { display: inline-block; margin-right: 18px; }
  h2 { font-size: 14px; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 6px; }
  section { margin-bottom: 10px; }
  .mission { font-size: 13px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
  td.c, th.c { text-align: center; width: 90px; }
  .empty { font-size: 12px; color: #94a3b8; font-style: italic; }
  footer { margin-top: 28px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
  @media print { body { margin: 12mm; } }
</style></head>
<body>
  <header>
    <small>${esc(orgName || 'ATS Inteligente')} · Descrição de cargo</small>
    <h1>${esc(cargo.title)}</h1>
    <div class="meta">
      ${cargo.area ? `<span>Área: ${esc(cargo.area)}</span>` : ''}
      ${cargo.levelLabel ? `<span>Nível: ${esc(cargo.levelLabel)}</span>` : ''}
      <span>${esc(salaryLine)}</span>
    </div>
  </header>
  ${cargo.mission ? `<section><h2>Missão do cargo</h2><p class="mission">${esc(cargo.mission)}</p></section>` : ''}
  ${blocksHtml}
  <footer>Documento gerado pelo ATS Inteligente em ${new Date().toLocaleDateString('pt-BR')} — modelo CHA (Conhecimentos, Habilidades e Atitudes).</footer>
  <script>window.onload = function () { window.print() }</script>
</body></html>`

  const w = window.open('', '_blank', 'width=860,height=900')
  if (!w) {
    // Popup bloqueado: cai para um blob na mesma aba (o usuário pode imprimir).
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `descricao-cargo-${slugifyFile(cargo.title)}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}
