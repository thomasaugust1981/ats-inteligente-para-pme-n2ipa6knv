import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SendWhatsAppDialog } from '@/components/candidates/SendWhatsAppDialog'
import { auditService } from '@/services/candidates'
import pb from '@/lib/pocketbase/client'

interface CandidateWhatsAppButtonProps {
  candidateId: string
  applicationId?: string
  candidateName: string
  phone: string
  jobTitle: string
  stageLabel: string
  className?: string
}

/**
 * Botão de WhatsApp para o candidato: abre o diálogo de envio e, após um envio
 * bem-sucedido, grava a mensagem na trilha de auditoria do candidato (texto,
 * data e autor — a data é o `created` do próprio registro).
 */
export function CandidateWhatsAppButton({
  candidateId,
  applicationId,
  candidateName,
  phone,
  jobTitle,
  stageLabel,
  className,
}: CandidateWhatsAppButtonProps) {
  const [open, setOpen] = useState(false)

  const handleSent = async (message: string) => {
    const user = pb.authStore.record
    try {
      await auditService.createLog({
        candidate_id: candidateId,
        application_id: applicationId || undefined,
        user_id: user?.id,
        user_name: (user?.name as string) || (user?.email as string) || 'Sistema',
        user_role: (user?.role as string) || 'recruiter',
        action: 'note_added',
        details: `Mensagem WhatsApp enviada para ${phone}: "${message}"`,
      })
    } catch (err) {
      console.warn('Failed to register audit log for WhatsApp message:', err)
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
        <MessageCircle className="w-3.5 h-3.5 mr-1" />
        WhatsApp
      </Button>
      <SendWhatsAppDialog
        open={open}
        onOpenChange={setOpen}
        candidateName={candidateName}
        phone={phone}
        jobTitle={jobTitle}
        stageLabel={stageLabel}
        onSent={handleSent}
      />
    </>
  )
}
