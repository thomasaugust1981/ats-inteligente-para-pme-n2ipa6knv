import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { candidatesService, applicationsService, auditService } from '@/services/candidates'
import type { Candidate, Application, AuditLog, AuditAction } from '@/types/ats'
import ErpDataDialog from '@/components/candidates/ErpDataDialog'
import { ERP_STAGE_ID } from '@/lib/erpIntegration'
import { ClipboardList } from 'lucide-react'
import {
  ArrowLeft,
  FileText,
  Download,
  Trash2,
  ShieldCheck,
  History,
  Clock,
  User as UserIcon,
  Building2,
  Send,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Linkedin,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { ResumeStructuredPanel } from '@/components/ResumeStructuredPanel'
import { DiscFitPanel } from '@/components/DiscFitPanel'
import { AiScorePanel } from '@/components/AiScorePanel'
import { CandidateWhatsAppButton } from '@/components/candidates/CandidateWhatsAppButton'
import { CandidateScheduleInterviewButton } from '@/components/candidates/CandidateScheduleInterviewButton'

export const CandidateProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const targetAppId = searchParams.get('appId')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  // Última reprovação — mostra no topo do perfil (histórico mantém o candidato ativo no banco)
  const latestRejectedApp = applications
    .filter((a) => a.status === 'rejected')
    .sort((a, b) => (a.created || '').localeCompare(b.created || ''))
    .pop()
  const latestRejection = latestRejectedApp
    ? {
        reason: latestRejectedApp.rejection_reason || '',
        jobTitle: latestRejectedApp.expand?.job_id?.title,
        created: latestRejectedApp.created,
      }
    : null

  // Anotação interna do recrutador
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Etapa "Integração ERP": formulário de dados admissionais
  const [erpDialogOpen, setErpDialogOpen] = useState(false)
  const targetApp = applications.find((a) => a.id === targetAppId) ?? applications[0]
  const isInErpStage = targetApp?.stage_id === ERP_STAGE_ID

  const loadData = async () => {
    if (!id) return
    try {
      setLoading(true)
      const [cand, apps, logs] = await Promise.all([
        candidatesService.getCandidateById(id),
        applicationsService.getCandidateApplications(id),
        auditService.listLogsForCandidate(id),
      ])
      setCandidate(cand)
      setApplications(apps)
      setAuditLogs(logs)
    } catch (err) {
      console.error('Erro ao carregar perfil do candidato:', err)
      toast({ title: 'Candidato não encontrado', variant: 'destructive' })
      navigate('/candidatos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  // Auditoria: registrar quem visualizou o currículo
  const handleViewResume = async () => {
    if (!candidate) return
    const resumeUrl = candidatesService.getResumeUrl(candidate)
    if (!resumeUrl) {
      toast({ title: 'Currículo não disponível', description: 'Nenhum arquivo PDF foi anexado.' })
      return
    }

    // Registrar na trilha de auditoria
    await auditService.recordResumeView(candidate.id, targetAppId || undefined)

    // Recarregar logs para mostrar imediatamente
    auditService.listLogsForCandidate(candidate.id).then(setAuditLogs)

    window.open(resumeUrl, '_blank')
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim() || !candidate) return

    try {
      setSavingNote(true)
      await auditService.createLog({
        candidate_id: candidate.id,
        application_id: targetAppId || undefined,
        user_id: user?.id,
        user_name: user?.name || user?.email,
        user_role: user?.role || 'recruiter',
        action: 'note_added',
        details: newNote.trim(),
      })

      setNewNote('')
      toast({ title: 'Anotação salva na auditoria' })
      loadData()
    } catch (err) {
      toast({ title: 'Erro ao salvar anotação', variant: 'destructive' })
    } finally {
      setSavingNote(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (!candidate) return

    const confirmation = window.prompt(
      `EXCLUSÃO REAL LGPD:\nEsta ação apagará permanentemente todos os dados de ${candidate.name}, arquivo de currículo e candidaturas associadas.\nDigite EXCLUIR para confirmar:`,
    )

    if (confirmation !== 'EXCLUIR') return

    try {
      await candidatesService.deleteCandidateRealLGPD(candidate.id)
      toast({
        title: 'Candidato excluído em definitivo (LGPD)',
        description: 'Todos os registros pessoais e arquivo foram removidos.',
      })
      navigate('/candidatos')
    } catch (err) {
      toast({
        title: 'Erro na exclusão',
        description: 'Não foi possível apagar o candidato.',
        variant: 'destructive',
      })
    }
  }

  const getActionLabel = (action: AuditAction) => {
    switch (action) {
      case 'viewed_resume':
        return (
          <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-800 border-sky-200">
            Visualizou Currículo
          </Badge>
        )
      case 'stage_changed':
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-indigo-50 text-indigo-800 border-indigo-200"
          >
            Moveu Etapa
          </Badge>
        )
      case 'candidate_rejected':
        return (
          <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-800 border-rose-200">
            Reprovou Candidato
          </Badge>
        )
      case 'candidate_hired':
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200"
          >
            Contratou
          </Badge>
        )
      case 'note_added':
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-amber-50 text-amber-800 border-amber-200"
          >
            Parecer / Anotação
          </Badge>
        )
      case 'interview_scheduled':
        return (
          <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-800 border-sky-200">
            Entrevista Agendada
          </Badge>
        )
      case 'candidate_created':
        return (
          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700">
            Inscrição Recebida
          </Badge>
        )
      case 'candidate_deleted':
        return (
          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-800">
            Exclusão Solicitada
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {action}
          </Badge>
        )
    }
  }

  if (loading || !candidate) {
    return <div className="py-20 text-center text-slate-500">Carregando perfil do candidato...</div>
  }

  const resumeUrl = candidatesService.getResumeUrl(candidate)

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-3">
          <Link to="/candidatos">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{candidate.name}</h1>
              <Badge variant="secondary" className="text-xs uppercase">
                {candidate.seniority || 'Geral'}
              </Badge>
              {latestRejection && (
                <Badge
                  variant="outline"
                  className="text-xs bg-rose-50 text-rose-700 border-rose-200 shrink-0"
                >
                  Reprovado
                </Badge>
              )}
            </div>
            {latestRejection && (
              <p className="text-[11px] text-rose-600 mt-1">
                Última reprovação
                {latestRejection.jobTitle ? (
                  <>
                    {' '}
                    em <strong>{latestRejection.jobTitle}</strong>
                  </>
                ) : null}
                {latestRejection.created
                  ? ` — ${new Date(latestRejection.created).toLocaleDateString('pt-BR')}`
                  : ''}
                {latestRejection.reason ? ` · Motivo: ${latestRejection.reason}` : ''}
                {' · '}mantém-se ativo no banco de talentos.
              </p>
            )}
            <p className="text-xs text-slate-500 mt-0.5">
              Cadastrado no Banco de Talentos em{' '}
              {new Date(candidate.created).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInErpStage && (
            <Button
              size="sm"
              variant="outline"
              className="text-sky-700 border-sky-200 hover:bg-sky-50"
              onClick={() => setErpDialogOpen(true)}
            >
              <ClipboardList className="w-4 h-4 mr-1.5" />
              Dados para integração
            </Button>
          )}
          <CandidateWhatsAppButton
            candidateId={candidate.id}
            applicationId={targetAppId || applications[0]?.id}
            candidateName={candidate.name}
            phone={candidate.phone || ''}
            jobTitle={
              (applications.find((a) => a.id === targetAppId) ?? applications[0])?.expand?.job_id
                ?.title || ''
            }
            stageLabel={
              (applications.find((a) => a.id === targetAppId) ?? applications[0])?.stage_id || ''
            }
            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          />
          <CandidateScheduleInterviewButton
            candidateId={candidate.id}
            applicationId={targetAppId || applications[0]?.id}
            candidateName={candidate.name}
            jobTitle={
              (applications.find((a) => a.id === targetAppId) ?? applications[0])?.expand?.job_id
                ?.title || ''
            }
            className="text-sky-700 border-sky-200 hover:bg-sky-50"
          />
          {resumeUrl && (
            <Button
              size="sm"
              className="bg-sky-600 hover:bg-sky-700 text-white"
              onClick={handleViewResume}
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Abrir Currículo (PDF)
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            onClick={handlePermanentDelete}
            title="Exclusão real de dados conforme LGPD"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Exclusão LGPD
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lado Esquerdo: Dados Pessoais & Consentimento LGPD */}
        <div className="space-y-6">
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Dados de Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-medium truncate">{candidate.email}</span>
              </div>

              {candidate.phone && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{candidate.phone}</span>
                </div>
              )}

              {candidate.location && (
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{candidate.location}</span>
                </div>
              )}

              {candidate.cpf && (
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="w-4 text-center font-bold text-slate-400 text-[10px]">CPF</span>
                  <span>{candidate.cpf}</span>
                </div>
              )}

              {candidate.linkedin && (
                <div className="flex items-center gap-2 text-sky-700 pt-1">
                  <Linkedin className="w-4 h-4 text-sky-600 shrink-0" />
                  <a
                    href={candidate.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate hover:underline"
                  >
                    {candidate.linkedin}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card LGPD */}
          <Card className="bg-emerald-50/50 border-emerald-200">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-emerald-800">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <CardTitle className="text-sm font-bold">Conformidade LGPD</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-xs space-y-2 text-emerald-900">
              <p>
                <strong>Consentimento legal:</strong> Concedido e registrado.
              </p>
              <p>
                <strong>Data e hora:</strong>{' '}
                {candidate.lgpd_consent_date
                  ? new Date(candidate.lgpd_consent_date).toLocaleString('pt-BR')
                  : new Date(candidate.created).toLocaleString('pt-BR')}
              </p>
              <p>
                <strong>Versão do termo:</strong>{' '}
                {candidate.lgpd_consent_version || 'LGPD-v1.0-2025'}
              </p>
              <p className="text-[11px] text-emerald-700 pt-1 border-t border-emerald-200">
                O candidato tem garantido o direito de solicitar a exclusão de seus dados a qualquer
                momento via solicitação formal ou botão de Exclusão LGPD acima.
              </p>
            </CardContent>
          </Card>

          {/* Competências e Disponibilidade */}
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Competências</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-1">Disponibilidade para início:</span>
                <Badge variant="outline" className="font-semibold">
                  {candidate.availability === 'immediate'
                    ? 'Imediata'
                    : candidate.availability === 'two_weeks'
                      ? 'Em até 2 semanas'
                      : candidate.availability === 'one_month'
                        ? 'Em 30 dias'
                        : 'Apenas avaliando'}
                </Badge>
              </div>

              {candidate.skills && (
                <div>
                  <span className="text-slate-500 block mb-1.5">Tags de habilidades:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.skills.split(',').map((sk, idx) => (
                      <span
                        key={idx}
                        className="bg-sky-50 text-sky-800 border border-sky-100 text-xs px-2 py-0.5 rounded-md"
                      >
                        {sk.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Currículo estruturado (extraído por IA do upload e revisado pelo candidato) */}
          <ResumeStructuredPanel candidate={candidate} />

          {/* Resultado DISC + aderência à visão/missão da empresa */}
          {targetAppId ? (
            <DiscFitPanel applicationId={targetAppId} />
          ) : applications.length > 0 ? (
            <DiscFitPanel applicationId={applications[0].id} />
          ) : null}

          {/* Score de IA (consultivo) — geral + dimensões + histórico de cálculos */}
          {targetAppId ? (
            <AiScorePanel applicationId={targetAppId} />
          ) : applications.length > 0 ? (
            <AiScorePanel applicationId={applications[0].id} />
          ) : null}
        </div>

        {/* Lado Direito: Candidaturas, Trilha de Auditoria e Pareceres */}
        <div className="lg:col-span-2 space-y-6">
          {/* Candidaturas do candidato (Banco de Talentos) */}
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900">
                Candidaturas & Histórico de Vagas
              </CardTitle>
              <CardDescription className="text-xs">
                Vagas às quais este profissional se candidatou (Banco de Talentos)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {applications.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhuma candidatura ativa.</p>
              ) : (
                applications.map((app) => (
                  <div
                    key={app.id}
                    className="p-3 rounded-lg border bg-slate-50/50 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-sm text-slate-900">
                        {app.expand?.job_id?.title || 'Vaga'}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>
                          Canal de Origem: <strong>{app.source}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Fase atual: <strong>{app.stage_id}</strong>
                        </span>
                      </div>
                      {app.rejection_reason && (
                        <div className="text-[11px] text-rose-600 mt-1">
                          Motivo reprovação: {app.rejection_reason}
                        </div>
                      )}
                    </div>

                    <Link to={`/pipeline/${app.job_id}`}>
                      <Button variant="outline" size="sm" className="text-xs">
                        Abrir no Pipeline
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Trilha de Auditoria Completa */}
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    Trilha de Auditoria
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Registro de quem viu o currículo, quem moveu e quem reprovou com justificativa.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Formulário para adicionar parecer/anotação na auditoria */}
              <form
                onSubmit={handleAddNote}
                className="space-y-2 bg-slate-50 p-3 rounded-lg border"
              >
                <Label htmlFor="note" className="text-xs font-semibold text-slate-700">
                  Adicionar Parecer / Anotação da Entrevista
                </Label>
                <Textarea
                  id="note"
                  rows={2}
                  placeholder="Registre seu parecer sobre o candidato..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="text-xs bg-white"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingNote}
                    className="text-xs bg-sky-600 hover:bg-sky-700"
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Registrar Parecer
                  </Button>
                </div>
              </form>

              {/* Linha do tempo dos registros de auditoria */}
              <div className="space-y-3 pt-2">
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Nenhum evento registrado ainda.
                  </p>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg border bg-white flex flex-col gap-1 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getActionLabel(log.action)}
                          <span className="font-semibold text-slate-800">
                            {log.user_name || 'Sistema'}
                          </span>
                          {log.user_role && (
                            <span className="text-[10px] text-slate-400">({log.user_role})</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(log.created).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      {log.details && (
                        <p className="text-slate-600 text-xs mt-1 bg-slate-50 p-2 rounded">
                          {log.details}
                        </p>
                      )}

                      {log.reason && (
                        <p className="text-rose-700 text-xs bg-rose-50 p-2 rounded border border-rose-100">
                          <strong>Justificativa:</strong> {log.reason}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog "Dados para integração" (etapa Integração ERP) */}
      {candidate && (
        <ErpDataDialog
          open={erpDialogOpen}
          onOpenChange={setErpDialogOpen}
          candidate={candidate}
          job={targetApp?.expand?.job_id}
          onSaved={loadData}
        />
      )}
    </div>
  )
}
