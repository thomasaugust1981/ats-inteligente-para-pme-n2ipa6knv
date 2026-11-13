import type { Job, Candidate, DiscResult, JobStage, User, Application } from '@/types/ats'
import pb from '@/lib/pocketbase/client'

// Motor de sugestão de candidatos: calcula a aderência (0–100) de cada candidato
// do banco de talentos a uma vaga usando dados já existentes — skills vs
// pré-requisitos (peso 50), senioridade (25), localidade (15) e
// disponibilidade (10). Candidatos com candidatura reprovada participam
// normalmente: é o caso de uso "retorna ao banco" (reprovado em vaga sênior,
// fit ideal em vaga júnior aberta depois).

export const SENIORITY_ORDER: Record<string, number> = {
  intern: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  specialist: 5,
}

const TECH_TERMS = [
  'react',
  'typescript',
  'javascript',
  'node',
  'python',
  'sql',
  'docker',
  'aws',
  'java',
  'php',
  'vue',
  'angular',
  'power bi',
  'excel',
  'sap',
]

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function parseSkills(raw?: string): string[] {
  if (!raw) return []
  return raw
    .split(/[,;]/)
    .map((s) => normalize(s))
    .filter((s) => s.length > 1)
}

/** Variações simples para comparação flexível (ex: "react.js" ≈ "reactjs") */
function skillVariants(skill: string): string[] {
  const cleaned = skill.replace(/[^a-z0-9+#. ]/g, ' ').trim()
  const variants = new Set<string>([cleaned, cleaned.replace(/\./g, '').replace(/\s+/g, ' ')])
  return [...variants].filter((v) => v.length > 1)
}

/** Extrai termos comparáveis dos pré-requisitos (texto livre) e da descrição. */
export function extractRequirements(job: Pick<Job, 'requirements' | 'description'>): string[] {
  const requirements: string[] = []
  if (job.requirements) {
    for (const chunk of String(job.requirements).split(/\n|,|;/)) {
      const cleaned = normalize(chunk)
        .replace(
          /^(desejavel|diferencial|obrigatorio|requerido|experiencia com|experiencia em|experiencia|conhecimento em|conhecimentos de|conhecimentos em|dominio de|dominio em)\s+/,
          '',
        )
        .trim()
      // Considera apenas termos únicos curtos (comparáveis a tags de skill)
      if (cleaned && cleaned.length >= 3 && cleaned.length <= 40 && !cleaned.includes(' ')) {
        requirements.push(cleaned)
      }
    }
  }
  if (job.description) {
    const desc = normalize(String(job.description))
    for (const term of TECH_TERMS) {
      if (desc.includes(term)) requirements.push(term)
    }
  }
  return [...new Set(requirements)]
}

export interface CandidateSuggestion {
  candidateId: string
  matchScore: number
  matchedSkills: string[]
  reasons: string[]
}

/** Cálculo puro de aderência entre um candidato e a vaga. */
export function computeMatch(job: Job, candidate: Candidate): CandidateSuggestion {
  const candidateSkills = parseSkills(candidate.skills)
  const requirements = extractRequirements(job)

  // 1. Skills (peso 50)
  const matchedSkills: string[] = []
  for (const req of requirements) {
    const reqVariants = skillVariants(req)
    const hit = candidateSkills.find((cs) =>
      reqVariants.some((rv) => cs === rv || cs.includes(rv) || rv.includes(cs)),
    )
    if (hit && !matchedSkills.includes(req)) matchedSkills.push(req)
  }
  let score = requirements.length > 0 ? (matchedSkills.length / requirements.length) * 50 : 25
  const reasons: string[] = []
  if (requirements.length > 0) {
    reasons.push(
      matchedSkills.length > 0
        ? `Competências que batem: ${matchedSkills.join(', ')}`
        : 'Nenhuma competência dos pré-requisitos consta no cadastro',
    )
  }

  // 2. Senioridade (peso 25) — candidatos um nível acima continuam pontuando bem:
  // é o caso "sênior reprovado que dá fit numa vaga júnior".
  const candSen = candidate.seniority ? SENIORITY_ORDER[candidate.seniority] : undefined
  const jobSen = job.seniority ? SENIORITY_ORDER[job.seniority] : undefined
  if (candSen != null && jobSen != null) {
    const diff = candSen - jobSen
    if (diff === 0) {
      score += 25
      reasons.push('Senioridade exata da vaga')
    } else if (diff === 1) {
      score += 18
      reasons.push('Senioridade um nível acima da vaga')
    } else if (diff === -1) {
      score += 12
      reasons.push('Senioridade um nível abaixo da vaga')
    } else if (diff > 1) {
      score += 8
      reasons.push('Senioridade acima da vaga')
    } else {
      score += 2
      reasons.push('Senioridade abaixo da vaga')
    }
  } else {
    score += 12
  }

  // 3. Localidade (peso 15) — vaga remota pontua para todos
  if (job.workplace_type === 'remote' || !job.location) {
    if (job.workplace_type === 'remote') reasons.push('Vaga remota (sem restrição de cidade)')
    score += 15
  } else {
    const jobCity = normalize(job.location)
      .split(/[/,\-–]/)[0]
      .trim()
    const candLoc = normalize(candidate.location || '')
    if (candLoc && jobCity && (candLoc.includes(jobCity) || jobCity.includes(candLoc))) {
      score += 15
      reasons.push('Mesma localidade da vaga')
    } else if (job.workplace_type === 'hybrid') {
      score += 7
      reasons.push('Modelo híbrido — verificar deslocamento')
    } else {
      score += 3
      reasons.push('Localidade diferente da vaga — verificar')
    }
  }

  // 4. Disponibilidade (peso 10)
  if (candidate.availability === 'immediate') {
    score += 10
    reasons.push('Disponibilidade imediata')
  } else if (candidate.availability === 'two_weeks') {
    score += 8
    reasons.push('Disponível em até 2 semanas')
  } else if (candidate.availability === 'one_month') {
    score += 6
    reasons.push('Disponível em 30 dias')
  } else if (candidate.availability === 'exploring') {
    score += 2
    reasons.push('Apenas avaliando oportunidade')
  }

  return {
    candidateId: candidate.id,
    matchScore: Math.min(100, Math.round(score)),
    matchedSkills,
    reasons: reasons.slice(0, 4),
  }
}

export interface RejectionInfo {
  reason: string
  jobTitle?: string
}

export interface EnrichedSuggestion extends CandidateSuggestion {
  candidate: Candidate
  lastRejection?: RejectionInfo
  discProfile?: string
  fitScore?: number
  discApplicationId?: string
  alreadyApplied: boolean
}

export interface AppSummary extends Pick<
  Application,
  'id' | 'job_id' | 'candidate_id' | 'status' | 'rejection_reason' | 'created'
> {
  jobTitle?: string
}

export const AVAILABILITY_LABELS: Record<string, string> = {
  immediate: 'Imediata',
  two_weeks: 'Em até 2 semanas',
  one_month: 'Em 30 dias',
  exploring: 'Apenas avaliando',
}

export const SOURCE_LABELS: Record<string, string> = {
  google_for_jobs: 'Google for Jobs',
  direct_link: 'Link direto',
  whatsapp: 'WhatsApp',
  referral: 'Indicação',
  linkedin: 'LinkedIn',
  other: 'Outro',
  suggested: 'Sugerido pelo sistema',
  manual: 'Manual',
  erp: 'ERP',
}

/** Busca TODAS as candidaturas (ativas e reprovadas) com o título da vaga. */
export async function fetchAllApplications(): Promise<AppSummary[]> {
  const results: AppSummary[] = []
  let page = 1
  for (;;) {
    const res = await pb
      .collection('applications')
      .getList<Application>(page, 200, { sort: '-created', expand: 'job_id' })
    for (const item of res.items) {
      results.push({
        id: item.id,
        job_id: item.job_id,
        candidate_id: item.candidate_id,
        status: item.status,
        rejection_reason: item.rejection_reason,
        created: item.created,
        jobTitle: item.expand?.job_id?.title,
      })
    }
    if (res.items.length < res.perPage || page >= res.totalPages) break
    page++
  }
  return results
}

/** Junta o cálculo com histórico de reprovações, DISC e candidatura existente na vaga. */
export function buildSuggestions(
  job: Job,
  candidates: Candidate[],
  allApplications: AppSummary[],
  discResults: DiscResult[],
): EnrichedSuggestion[] {
  const appsByCandidate = new Map<string, AppSummary[]>()
  for (const a of allApplications) {
    const list = appsByCandidate.get(a.candidate_id) || []
    list.push(a)
    appsByCandidate.set(a.candidate_id, list)
  }

  const discByApp = new Map<string, DiscResult>()
  for (const d of discResults) {
    if (!discByApp.has(d.application_id)) discByApp.set(d.application_id, d)
  }

  const suggestions = candidates.map((candidate) => {
    const match = computeMatch(job, candidate)
    const apps = appsByCandidate.get(candidate.id) || []

    // Reprovação mais recente com motivo registrado
    const rejected = apps
      .filter((a) => a.status === 'rejected' && a.rejection_reason)
      .sort((a, b) => (a.created || '').localeCompare(b.created || ''))
      .pop()

    // DISC mais relevante: da candidatura nesta vaga ou da mais recente
    const currentApp = apps.find((a) => a.job_id === job.id)
    const discAppId = currentApp?.id || apps[0]?.id
    const disc = discAppId ? discByApp.get(discAppId) : undefined

    return {
      ...match,
      candidate,
      lastRejection: rejected
        ? { reason: rejected.rejection_reason as string, jobTitle: rejected.jobTitle }
        : undefined,
      discProfile: disc?.status === 'completed' ? disc.profile : undefined,
      fitScore: disc?.status === 'completed' ? disc.fit_score : undefined,
      discApplicationId: disc?.status === 'completed' ? discAppId : undefined,
      alreadyApplied: Boolean(currentApp && currentApp.status !== 'withdrawn'),
    }
  })

  return suggestions.sort((a, b) => b.matchScore - a.matchScore)
}

/** Carrega tudo que o painel precisa e devolve sugestões ordenadas por aderência. */
export async function loadSuggestions(job: Job): Promise<EnrichedSuggestion[]> {
  const [candidatesRes, apps, disc] = await Promise.all([
    pb.collection('candidates').getFullList<Candidate>({ sort: '-created', batch: 200 }),
    fetchAllApplications(),
    pb.collection('disc_results').getFullList<DiscResult>({ batch: 200 }),
  ])
  return buildSuggestions(job, candidatesRes, apps, disc)
}

/** Inscreve o candidato sugerido na vaga, na etapa de triagem, com origem e auditoria. */
export async function inviteSuggestion(
  job: Job,
  sug: EnrichedSuggestion,
  user?: User | null,
): Promise<void> {
  const firstStage = parseStages(job)[0]?.id || 'applied'
  const created = await pb.collection('applications').create<Application>({
    candidate_id: sug.candidate.id,
    job_id: job.id,
    stage_id: firstStage,
    status: 'active',
    source: 'suggested',
  })

  // Trilha de auditoria: "candidato sugerido pelo sistema" + usuário que inscreveu.
  // Falha de auditoria nunca bloqueia a inscrição.
  try {
    const base = {
      application_id: created.id,
      candidate_id: sug.candidate.id,
      user_id: user?.id,
      user_name: user?.name || user?.email || 'Recrutador',
      user_role: user?.role || 'recruiter',
    }
    await pb.collection('audit_logs').create({
      ...base,
      action: 'candidate_suggested',
      to_stage: firstStage,
      details: `Candidato sugerido pelo sistema (aderência ${sug.matchScore}%) e inscrito na vaga pelo usuário.`,
    })
    await pb.collection('audit_logs').create({
      ...base,
      action: 'candidate_created',
      details: `Inscrição criada pelo recrutador a partir da sugestão do sistema${sug.lastRejection ? ' (candidato retorna ao banco de talentos)' : ''}.`,
    })
  } catch (err) {
    console.error('Erro ao registrar auditoria da inscrição sugerida:', err)
  }
}
