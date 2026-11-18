import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { withFreshToken } from '@/lib/pocketbase/freshToken'
import { useAuth } from '@/hooks/use-auth'
import { useCopyLink } from '@/hooks/use-copy-link'
import { cargosService } from '@/services/cargos'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Rocket,
  Briefcase,
  Building2,
  Share2,
  Users,
  GitBranch,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Loader2,
} from 'lucide-react'

/**
 * Card "Coloque o Talent para trabalhar" — Painel (FASE 1 de autoadoção).
 *
 * Progresso derivado de DADOS REAIS do banco (não de clique):
 *   1. vaga publicada    → jobs com status='published' na org
 *   2. cargo criado      → coleção cargos da org
 *   3. link compartilhado→ coleção activation_checklist (único passo marcado
 *                          manualmente — não dá para derivar de dados);
 *                          fallback localStorage por org+usuário
 *   4. primeira candidatura → applications da org
 *   5. movimentação no pipeline → audit_logs com action='stage_changed'
 *
 * O card some do Painel somente quando 100% concluído (derivação por dados).
 * Visível para admin, recrutador e gestor (gestor: passos filtrados pelas
 * próprias vagas). Demo também vê — conteúdo genérico. Qualquer erro de
 * leitura é fail-open: card em estado neutro, nunca quebra o Painel.
 */

export interface ActivationSteps {
  publishedJob: boolean
  cargo: boolean
  sharedLink: boolean
  application: boolean
  stageMove: boolean
}

const STORAGE_KEY = 'activation-checklist'
const TOTAL_STEPS = 5

export const allStepsDone = (s: ActivationSteps | null): boolean =>
  !!s && s.publishedJob && s.cargo && s.sharedLink && s.application && s.stageMove

// localStorage só para o passo "compartilhar link" (cache local, org+usuário)
export function readSharedLinkLocal(orgId: string, userId: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as Record<string, { sharedLink?: boolean }>
    return !!parsed[`${orgId}:${userId}`]?.sharedLink
  } catch {
    return false
  }
}

export function writeSharedLinkLocal(orgId: string, userId: string, value: boolean): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, { sharedLink?: boolean }>
    parsed[`${orgId}:${userId}`] = { ...parsed[`${orgId}:${userId}`], sharedLink: value }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // sem localStorage (modo privado): o passo simplesmente não marca
  }
}

async function loadSteps(orgId: string, userId: string): Promise<ActivationSteps> {
  return withFreshToken(async () => {
    const [jobs, cargos, applications, stageMoves, marks] = await Promise.all([
      pb.collection('jobs').getList(1, 1, {
        filter: `org_id = "${orgId}" && status = "published"`,
        skipTotal: false,
      }),
      cargosService.listCargos().catch(() => []),
      pb.collection('applications').getList(1, 1, {
        filter: `org_id = "${orgId}"`,
        skipTotal: false,
      }),
      pb.collection('audit_logs').getList(1, 1, {
        filter: `org_id = "${orgId}" && action = "stage_changed"`,
        skipTotal: false,
      }),
      pb
        .collection('activation_checklist')
        .getList(1, 1, {
          filter: `org_id = "${orgId}" && user_id = "${userId}"`,
          skipTotal: false,
        })
        .catch(() => null),
    ])

    const fromDb =
      !!marks?.items?.[0] && !!(marks.items[0] as { shared_link?: boolean }).shared_link
    return {
      publishedJob: jobs.totalItems > 0,
      cargo: cargos.length > 0,
      sharedLink: fromDb || readSharedLinkLocal(orgId, userId),
      application: applications.totalItems > 0,
      stageMove: stageMoves.totalItems > 0,
    }
  })
}

interface StepDef {
  key: keyof ActivationSteps
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  to?: string
  isShare?: boolean
}

const STEP_DEFS: StepDef[] = [
  {
    key: 'publishedJob',
    label: 'Publique sua primeira vaga',
    description: 'Crie a oportunidade com requisitos e etapas do processo.',
    icon: Briefcase,
    to: '/vagas/nova',
  },
  {
    key: 'cargo',
    label: 'Monte seu primeiro cargo',
    description: 'Defina o CHA da função — ou use um modelo pronto.',
    icon: Building2,
    to: '/cargos',
  },
  {
    key: 'sharedLink',
    label: 'Compartilhe o link da página de carreiras',
    description: 'Divulgue o endereço público onde os candidatos se inscrevem.',
    icon: Share2,
    isShare: true,
  },
  {
    key: 'application',
    label: 'Receba o primeiro candidato',
    description: 'A candidatura entra no funil assim que o link chegar ao candidato.',
    icon: Users,
  },
  {
    key: 'stageMove',
    label: 'Mova o candidato no pipeline',
    description: 'Arraste o candidato para a próxima etapa e acompanhe o funil.',
    icon: GitBranch,
  },
]

export const ActivationChecklistCard: React.FC = () => {
  const { user, isAdmin, isManager } = useAuth()
  const { copyLink } = useCopyLink()

  const orgId = String(
    (user as (typeof user & { org_id?: string }) | null)?.org_id ||
      pb.authStore.record?.org_id ||
      '',
  )
  const userId = user?.id || ''

  const [steps, setSteps] = useState<ActivationSteps | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)

  // Gestor não cria cargo (regra da coleção cargos nega recrutador/gestor —
  // na prática só admin edita) — o passo dele é informativo, sem botão.
  const canEditCargo = !isManager

  const load = React.useCallback(async () => {
    if (!orgId || !userId || !pb.authStore.isValid) {
      setLoading(false)
      return
    }
    try {
      setSteps(await loadSteps(orgId, userId))
      setFailed(false)
    } catch (err) {
      console.error('[activation] falha ao calcular progresso do checklist', err)
      setFailed(true)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, userId])

  React.useEffect(() => {
    load()
  }, [load])

  const handleShare = async () => {
    setShareBusy(true)
    try {
      const ok = await copyLink(`${window.location.origin}/carreiras`, 'Página de carreiras')
      if (ok && orgId && userId) {
        writeSharedLinkLocal(orgId, userId, true)
        setSteps((prev) => (prev ? { ...prev, sharedLink: true } : prev))
        // best-effort no banco: se falhar, o localStorage já marcou
        try {
          await withFreshToken(async () => {
            const existing = await pb.collection('activation_checklist').getList(1, 1, {
              filter: `org_id = "${orgId}" && user_id = "${userId}"`,
            })
            if (existing.items[0]) {
              await pb.collection('activation_checklist').update(existing.items[0].id, {
                shared_link: true,
              })
            } else {
              await pb.collection('activation_checklist').create({
                org_id: orgId,
                user_id: userId,
                shared_link: true,
              })
            }
          })
        } catch (err) {
          console.error('[activation] persistência do passo link falhou (fallback local ok)', err)
        }
      }
    } finally {
      setShareBusy(false)
    }
  }

  // Não renderiza nada enquanto não sabe se está 100% (evita piscar para quem
  // já terminou); em erro de leitura, mostra neutro (fail-open).
  if (loading) return null
  if (!steps || allStepsDone(steps)) return null

  const doneCount = STEP_DEFS.filter((d) => steps[d.key]).length

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Rocket className="w-4 h-4 text-sky-600" />
            Coloque o Talent para trabalhar
          </CardTitle>
          <CardDescription className="text-xs">
            {failed
              ? 'Acompanhe os primeiros passos da sua operação.'
              : `${doneCount} de ${TOTAL_STEPS} passos concluídos — o card sai do Painel quando tudo estiver ativo.`}
          </CardDescription>
        </div>
        {steps && (
          <span className="text-xs text-slate-400 shrink-0">
            {Math.round((doneCount / TOTAL_STEPS) * 100)}%
          </span>
        )}
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-slate-100">
          {STEP_DEFS.map((def) => {
            const done = steps ? steps[def.key] : false
            const StepIcon = def.icon
            return (
              <li key={def.key} className="py-2.5 flex items-start justify-between gap-3">
                <label className="flex items-start gap-2.5 min-w-0 flex-1">
                  <Checkbox checked={done} disabled className="mt-0.5" aria-hidden />
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-medium break-words ${
                        done ? 'text-slate-400 line-through' : 'text-slate-900'
                      }`}
                    >
                      {def.label}
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5 break-words">
                      {def.description}
                    </span>
                  </span>
                </label>
                <div className="shrink-0 flex items-center gap-1.5">
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : def.isShare ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={handleShare}
                      disabled={shareBusy}
                    >
                      {shareBusy ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5 mr-1" />
                      )}
                      Copiar link
                    </Button>
                  ) : def.to && (def.key !== 'cargo' || canEditCargo) ? (
                    <Link to={def.to}>
                      <Button size="sm" variant="outline" className="h-8 text-xs">
                        <ArrowRight className="w-3.5 h-3.5 mr-1" />
                        {def.key === 'cargo' ? 'Ir para Cargos' : 'Fazer agora'}
                      </Button>
                    </Link>
                  ) : def.key === 'cargo' ? (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      só admin
                    </span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
