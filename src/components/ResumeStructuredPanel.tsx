import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Sparkles, PenLine, GraduationCap, Briefcase } from 'lucide-react'
import type { Candidate, StructuredResume } from '@/types/ats'
import { normalizeStructured } from '@/services/resumeReader'

interface ResumeStructuredPanelProps {
  candidate: Candidate | null
}

const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400'

export const ResumeStructuredPanel: React.FC<ResumeStructuredPanelProps> = ({ candidate }) => {
  if (!candidate) return null

  const raw = (candidate as unknown as { resume_structured?: unknown }).resume_structured
  if (!raw) return null

  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
  }

  const data: StructuredResume = normalizeStructured(parsed)
  const source = (candidate as unknown as { resume_source?: string }).resume_source

  return (
    <Card className="bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-sky-600" />
          Currículo Estruturado
        </CardTitle>
        <CardDescription className="text-xs flex items-center gap-1.5">
          {source === 'ai_extracted' ? (
            <>
              <Sparkles className="w-3 h-3 text-violet-500" />
              Extraído por IA do arquivo enviado e revisado pelo candidato
            </>
          ) : (
            <>
              <PenLine className="w-3 h-3 text-slate-400" />
              Preenchido pelo candidato
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {data.summary && (
          <div>
            <div className={SECTION_TITLE}>Resumo</div>
            <p className="text-slate-700 whitespace-pre-line mt-1">{data.summary}</p>
          </div>
        )}

        <div>
          <div className={SECTION_TITLE}>Formação</div>
          {data.education.length === 0 ? (
            <p className="text-slate-400 mt-1">Não informado</p>
          ) : (
            <ul className="mt-1 space-y-1.5">
              {data.education.map((ed, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-700">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="font-semibold">{ed.degree}</strong>
                    {ed.institution ? ` — ${ed.institution}` : ''}
                    {(ed.start_date || ed.end_date) &&
                      ` (${[ed.start_date, ed.end_date].filter(Boolean).join(' – ')})`}
                    {ed.status ? ` — ${ed.status}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className={SECTION_TITLE}>Experiência</div>
          {data.experiences.length === 0 ? (
            <p className="text-slate-400 mt-1">Não informado</p>
          ) : (
            <ul className="mt-1 space-y-2">
              {data.experiences.map((ex, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-700">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="font-semibold">{ex.title}</strong>
                    {ex.company ? ` — ${ex.company}` : ''}
                    {(ex.start_date || ex.end_date || ex.current) &&
                      ` (${[ex.start_date, ex.current ? 'atual' : ex.end_date].filter(Boolean).join(' – ')})`}
                    {ex.description ? (
                      <p className="text-slate-500 mt-0.5 whitespace-pre-line">{ex.description}</p>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className={SECTION_TITLE}>Competências</div>
          {data.skills.length === 0 ? (
            <p className="text-slate-400 mt-1">Não informado</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {data.skills.map((sk, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] bg-sky-50 text-sky-700">
                  {sk}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {data.languages.length > 0 && (
          <div>
            <div className={SECTION_TITLE}>Idiomas</div>
            <p className="text-slate-700 mt-1">{data.languages.join(', ')}</p>
          </div>
        )}

        {data.courses.length > 0 && (
          <div>
            <div className={SECTION_TITLE}>Cursos e Certificações</div>
            <p className="text-slate-700 mt-1 whitespace-pre-line">{data.courses.join(', ')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
