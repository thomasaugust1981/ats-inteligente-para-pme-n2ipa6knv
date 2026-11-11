import pb from '@/lib/pocketbase/client'
import type { StructuredResume } from '@/types/ats'

const MAGIC = {
  PDF: [0x25, 0x50, 0x44, 0x46], // %PDF
  DOCX: [0x50, 0x4b, 0x03, 0x04], // PK.. (zip — .docx)
}

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export function isAllowedResumeMime(mime: string): boolean {
  return (
    mime === 'application/pdf' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
}

/** Valida tipo real (magic number), extensão e tamanho. Devolve mensagem de erro ou null. */
export async function validateResumeFile(file: File): Promise<string | null> {
  if (!isAllowedResumeMime(file.type) && !/\.(pdf|docx)$/i.test(file.name)) {
    return 'Formato não aceito. Envie o currículo em PDF ou Word (.docx).'
  }
  if (file.size > MAX_SIZE) {
    return 'Arquivo muito grande. O tamanho máximo é de 10 MB.'
  }
  if (file.size === 0) {
    return 'O arquivo está vazio.'
  }

  // Validação do tipo real pelos primeiros bytes (magic number)
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    const isPdf = MAGIC.PDF.every((b, i) => head[i] === b)
    const isZip = MAGIC.DOCX.every((b, i) => head[i] === b)
    if (!isPdf && !isZip) {
      return 'O arquivo não parece ser um PDF ou Word (.docx) válido.'
    }
  } catch (_) {
    // Se a leitura dos bytes falhar, segue o fluxo — o backend valida de novo.
  }
  return null
}

export type ExtractResult = {
  ok: boolean
  data?: StructuredResume
  error?: string
  code?: string
}

/** Envia o arquivo ao hook /backend/v1/resume/extract e devolve o JSON estruturado. */
export async function extractResumeData(file: File): Promise<ExtractResult> {
  const formData = new FormData()
  formData.append('arquivo', file)

  try {
    const res = await fetch(`${pb.buildUrl('')}/backend/v1/resume/extract`, {
      method: 'POST',
      body: formData,
    })
    const payload = await res.json().catch(() => null)

    if (!res.ok) {
      return {
        ok: false,
        error: payload?.error || 'Não foi possível analisar o currículo agora.',
        code: payload?.code || 'http_error',
      }
    }
    return { ok: true, data: payload.data as StructuredResume }
  } catch (_) {
    return {
      ok: false,
      error:
        'Falha de conexão ao analisar o currículo. Você pode preencher o formulário manualmente.',
      code: 'network',
    }
  }
}

/** Normaliza a resposta do agente para o formato usado na UI. */
export function normalizeStructured(
  raw: Partial<StructuredResume> | null | undefined,
): StructuredResume {
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim())
      : []

  const experiences = Array.isArray(raw?.experiences)
    ? raw!
        .experiences!.filter((x) => x && typeof x === 'object')
        .map((x) => ({
          title: String(x.title || ''),
          company: String(x.company || ''),
          start_date: String(x.start_date || ''),
          end_date: String(x.end_date || ''),
          current: !!x.current,
          description: String(x.description || ''),
        }))
    : []

  const education = Array.isArray(raw?.education)
    ? raw!
        .education!.filter((x) => x && typeof x === 'object')
        .map((x) => ({
          degree: String(x.degree || ''),
          institution: String(x.institution || ''),
          start_date: String(x.start_date || ''),
          end_date: String(x.end_date || ''),
          status: String(x.status || ''),
        }))
    : []

  return {
    name: String(raw?.name || ''),
    email: String(raw?.email || ''),
    phone: String(raw?.phone || ''),
    location: String(raw?.location || ''),
    linkedin: String(raw?.linkedin || ''),
    summary: String(raw?.summary || ''),
    skills: arr(raw?.skills),
    experiences,
    education,
    languages: arr(raw?.languages),
    courses: arr(raw?.courses),
  }
}

export function hasExtractedContent(data: StructuredResume): boolean {
  return !!(
    data.name ||
    data.email ||
    data.phone ||
    data.summary ||
    data.skills.length ||
    data.experiences.length ||
    data.education.length ||
    data.languages.length ||
    data.courses.length
  )
}
