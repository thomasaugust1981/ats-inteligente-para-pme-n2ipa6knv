import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  UserPlus,
  Sparkles,
  Users,
  RotateCcw,
  Undo2,
  CheckCircle2,
  MapPin,
  Clock,
  BrainCircuit,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useActiveCompany } from '@/hooks/use-active-company'
import type { Job } from '@/types/ats'
import {
  AVAILABILITY_LABELS,
  inviteSuggestion,
  loadSuggestions,
  type EnrichedSuggestion,
} from '@/lib/candidateSuggest'

interface SuggestedCandidatesPanelProps {
  job: Job
}

/** Painel "Candidatos sugeridos para esta vaga" — ordenado por aderência. */
export const SuggestedCandidatesPanel: React.FC<SuggestedCandidatesPanelProps> = ({ job }) => {
  const { toast } = useToast()
  const { user } = useAuth()
  const { activeCompanyId, companyVersion } = useActiveCompany()
  const [suggestions, setSuggestions] = useState<EnrichedSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState<string | null>(null)
  const [toConfirm, setToConfirm] = useState<EnrichedSuggestion | null>(null)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await loadSuggestions(job, activeCompanyId)
        if (!cancelled) setSuggestions(res)
      } catch (err) {
        console.error('Erro ao calcular sugestões:', err)
        if (!cancelled) setSuggestions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [job, activeCompanyId, companyVersion])

  const withMatch = useMemo(() => suggestions.filter((s) => s.matchScore > 0), [suggestions])

  const handleInvite = async () => {
    if (!toConfirm) return
    setInviting(toConfirm.candidate.id)
    try {
      await inviteSuggestion(job, toConfirm, user)
      setInvitedIds((prev) => new Set(prev).add(toConfirm.candidate.id))
      setSuggestions((prev) =>
        prev.map((s) =>
          s.candidate.id === toConfirm.candidate.id ? { ...s, alreadyApplied: true } : s,
        ),
      )
      toast({
        title: 'Candidatura criada!',
        description: `${toConfirm.candidate.name} foi inscrito na etapa de triagem desta vaga.`,
      })
    } catch (err: unknown) {
      console.error('Erro ao inscrever candidato sugerido:', err)
      toast({
        title: 'Erro ao inscrever',
        description: 'Não foi possível criar a candidatura. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setInviting(null)
      setToConfirm(null)
    }
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-600" />
              Candidatos sugeridos para esta vaga
            </CardTitle>
            <CardDescription className="text-xs">
              Aderência calculada sobre o banco de talentos: competências vs. pré-requisitos,
              senioridade, localidade e disponibilidade. Reprovados continuam elegíveis.
            </CardDescription>
          </div>
          {!loading && withMatch.length > 0 && (
            <Badge variant="secondary" className="shrink-0">
              <Users className="w-3 h-3 mr-1" />
              {withMatch.length} {withMatch.length === 1 ? 'sugestão' : 'sugestões'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-md bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : withMatch.length === 0 ? (
          <div className="py-10 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-900">Nenhum candidato com fit ainda</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              O banco de talentos ainda não tem candidatos com aderência aos pré-requisitos desta
              vaga. Conforme novos currículos entrarem pelo portal, as sugestões aparecem aqui.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {withMatch.map((s) => {
              const initials = s.candidate.name
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()
              const invited = invitedIds.has(s.candidate.id) || s.alreadyApplied
              return (
                <li key={s.candidate.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs bg-sky-100 text-sky-700">
                        {initials || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">
                          {s.candidate.name}
                        </span>
                        {s.lastRejection && (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1 border-amber-300 text-amber-700 bg-amber-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Retorna ao banco
                          </Badge>
                        )}
                        {invited && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {s.alreadyApplied && !invitedIds.has(s.candidate.id)
                              ? 'Já é candidato'
                              : 'Inscrito'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500 mt-0.5">
                        <span className="capitalize">{s.candidate.seniority || 'n/d'}</span>
                        {s.candidate.location && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" />
                            {s.candidate.location}
                          </span>
                        )}
                        {s.candidate.availability && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {AVAILABILITY_LABELS[s.candidate.availability] ||
                              s.candidate.availability}
                          </span>
                        )}
                        {(s.discProfile || s.fitScore != null) && (
                          <span className="flex items-center gap-0.5">
                            <BrainCircuit className="w-3 h-3" />
                            {s.discProfile ? `DISC ${s.discProfile}` : 'DISC ok'}
                            {s.fitScore != null ? ` · FIT ${s.fitScore}%` : ''}
                          </span>
                        )}
                      </div>
                      {s.matchedSkills.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1.5">
                          {s.matchedSkills.map((sk) => (
                            <Badge key={sk} variant="secondary" className="text-[10px]">
                              {sk}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {s.lastRejection && (
                        <p className="text-[11px] text-amber-700 mt-1">
                          Reprovado em “{s.lastRejection.jobTitle || 'vaga anterior'}”
                          {s.lastRejection.reason ? ` — ${s.lastRejection.reason}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0 w-36">
                      <div className="text-right w-full">
                        <span className="text-sm font-bold text-slate-900">{s.matchScore}%</span>
                        <span className="block text-[10px] text-slate-400">aderência</span>
                      </div>
                      <Progress value={s.matchScore} className="h-1.5 w-full" />
                      <Button
                        size="sm"
                        variant={invited ? 'ghost' : 'outline'}
                        disabled={invited || inviting === s.candidate.id}
                        onClick={() => setToConfirm(s)}
                        className="text-xs h-7"
                      >
                        {inviting === s.candidate.id ? (
                          'Inscrição...'
                        ) : invited ? (
                          <>
                            <Undo2 className="w-3 h-3 mr-1" />
                            Inscrito
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3 mr-1" />
                            Inscrever
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={Boolean(toConfirm)} onOpenChange={(open) => !open && setToConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inscrever candidato sugerido?</DialogTitle>
            <DialogDescription>
              {toConfirm?.candidate.name} será inscrito na etapa de triagem desta vaga, com origem
              “sugerido pelo sistema” e registro na trilha de auditoria.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToConfirm(null)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={inviting !== null}>
              <UserPlus className="w-4 h-4 mr-1.5" />
              {inviting ? 'Inscrevendo...' : 'Inscrever na vaga'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
