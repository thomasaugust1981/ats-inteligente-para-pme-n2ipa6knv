import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { getToolkitStatus, sendWhatsAppMessage, WHATSAPP_TOOLKIT } from '@/services/integrations'
import {
  FREE_TEXT_TEMPLATE_ID,
  MESSAGE_TEMPLATES,
  renderTemplate,
  type MessageTemplateContext,
} from '@/lib/candidateMessageTemplates'

interface SendWhatsAppDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateName: string
  phone: string
  jobTitle: string
  stageLabel: string
  onSent?: (message: string) => void
}

type ConnStatus = 'loading' | 'connected' | 'not_connected'

export function SendWhatsAppDialog({
  open,
  onOpenChange,
  candidateName,
  phone,
  jobTitle,
  stageLabel,
  onSent,
}: SendWhatsAppDialogProps) {
  const { toast } = useToast()
  const [status, setStatus] = useState<ConnStatus>('loading')
  const [toPhone, setToPhone] = useState(phone)
  const [templateId, setTemplateId] = useState<string>(FREE_TEXT_TEMPLATE_ID)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const ctx: MessageTemplateContext = { candidateName, jobTitle, stageLabel }

  useEffect(() => {
    if (!open) return
    setToPhone(phone)
    setTemplateId(FREE_TEXT_TEMPLATE_ID)
    setMessage('')
    setStatus('loading')
    getToolkitStatus(WHATSAPP_TOOLKIT)
      .then((s) => setStatus(s === 'connected' ? 'connected' : 'not_connected'))
      .catch(() => setStatus('not_connected'))
  }, [open, phone])

  const pickTemplate = (id: string) => {
    setTemplateId(id)
    const tpl = MESSAGE_TEMPLATES.find((t) => t.id === id)
    if (tpl) setMessage(renderTemplate(tpl.body, ctx))
  }

  const preview = useMemo(() => message.trim(), [message])
  const canSend = status === 'connected' && toPhone.trim().length > 0 && preview.length > 0

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)
    try {
      const result = await sendWhatsAppMessage(toPhone, preview)
      if (result.sent) {
        toast({ title: 'Mensagem enviada', description: `Enviada para ${candidateName}.` })
        onSent?.(preview)
        onOpenChange(false)
      } else {
        toast({
          title: 'Não foi possível enviar',
          description:
            'Tente novamente em instantes. Se persistir, confira a conexão do WhatsApp em Integrações.',
          variant: 'destructive',
        })
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            Enviar WhatsApp para {candidateName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            A mensagem sai pela sua conta de WhatsApp conectada em Integrações.
          </DialogDescription>
        </DialogHeader>

        {status === 'loading' && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando conexão...
          </div>
        )}

        {status === 'not_connected' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 space-y-2">
            <p className="font-semibold">Seu WhatsApp ainda não está conectado.</p>
            <p>Conecte sua conta em Integrações para enviar mensagens aos candidatos.</p>
            <Link to="/integracoes" className="inline-block font-semibold text-sky-700 underline">
              Ir para Integrações
            </Link>
          </div>
        )}

        {status === 'connected' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wa-phone" className="text-xs">
                Telefone
              </Label>
              <Input
                id="wa-phone"
                value={toPhone}
                onChange={(e) => setToPhone(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Modelo</Label>
              <div className="flex flex-wrap gap-1.5">
                {MESSAGE_TEMPLATES.map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    size="sm"
                    variant={templateId === t.id ? 'default' : 'outline'}
                    className="h-7 text-[11px]"
                    onClick={() => pickTemplate(t.id)}
                  >
                    {t.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={templateId === FREE_TEXT_TEMPLATE_ID ? 'default' : 'outline'}
                  className="h-7 text-[11px]"
                  onClick={() => pickTemplate(FREE_TEXT_TEMPLATE_ID)}
                >
                  Texto livre
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-message" className="text-xs">
                Mensagem
              </Label>
              <Textarea
                id="wa-message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva a mensagem..."
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Pré-visualização</Label>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-xs text-slate-700 whitespace-pre-wrap min-h-12">
                {preview || 'Nada para enviar ainda.'}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {status === 'connected' && (
            <Button
              type="button"
              size="sm"
              disabled={!canSend || sending}
              onClick={handleSend}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              {sending ? 'Enviando...' : 'Enviar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
