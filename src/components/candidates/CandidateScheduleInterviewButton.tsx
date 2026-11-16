import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ScheduleInterviewDialog,
  type InterviewSummary,
} from '@/components/candidates/ScheduleInterviewDialog'
import { auditService } from '@/services/candidates'
import pb from '@/lib/pocketbase/client'

interface CandidateScheduleInterviewButtonProps {
  candidateId: string
  applicationId?: string
  candidateName: string
  jobTitle: string
  className?: string
}

/**
 * Botão "Agendar entrevista": abre o diálogo de agendamento e, somente após a
 * criação bem-sucedida do evento no Google Calendar, registra `interview_scheduled`
 * na trilha de auditoria do candidato (data, formato e autor).
 */
export function CandidateScheduleInterviewButton({
  candidateId,
  applicationId,
  candidateName,
  jobTitle,
  className,
}: CandidateScheduleInterviewButtonProps) {
  const [open, setOpen] = useState(false)

  const formatScheduledAuditDetails = (s: InterviewSummary) => {
    const [h, m] = s.time.split(':')
    const endMinutes = Number(h) * 60 + Number(m) + s.durationMin
    const endH = String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')
    const endM = String(endMinutes % 60).padStart(2, '0')
    const [y, mo, d] = s.date.split('-')
    return [
      `Entrevista agendada para ${d}/${mo}/${y} das ${s.time} às ${endH}:${endMinLabel(endM)}`,
      `Formato: ${s.format === 'video' ? 'vídeo' : 'presencial'}.`,
      s.location ? `${s.format === 'video' ? 'Link' : 'Local'}: ${s.location}` : '',
      s.notes ? `Observações: ${s.notes}` : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  const endMinLabel = (m: string) => m

  const handleScheduled = async (summary: InterviewSummary) => {
    const user = pb.authStore.record
    try {
      await auditService.createLog({
        candidate_id: candidateId,
        application_id: applicationId || undefined,
        user_id: user?.id,
        user_name: (user?.name as string) || (user?.email as string) || 'Sistema',
        user_role: (user?.role as string) || 'recruiter',
        action: 'interview_scheduled',
        details: formatScheduledAuditDetails(summary),
      })
    } catch (err) {
      console.warn('Failed to register audit log for scheduled interview:', err)
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={className ?? 'h-7 text-[11px] w-full justify-center'}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <CalendarPlus className="w-3.5 h-3.5 mr-1" />
        Agendar entrevista
      </Button>
      <ScheduleInterviewDialog
        open={open}
        onOpenChange={setOpen}
        candidateId={candidateId}
        candidateName={candidateName}
        jobTitle={jobTitle}
        onScheduled={handleScheduled}
      />
    </>
  )
}
