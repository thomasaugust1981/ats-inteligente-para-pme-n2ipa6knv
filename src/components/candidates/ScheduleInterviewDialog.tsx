import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Loader2, Video, MapPin } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { CALENDAR_TOOLKIT, createCalendarEvent, getToolkitStatus } from '@/services/integrations'

interface ScheduleInterviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string
  candidateName: string
  jobTitle: string
  /** Chamado somente quando o evento foi criado no Calendar com sucesso. */
  onScheduled?: (summary: InterviewSummary) => void
}

export interface InterviewSummary {
  date: string
  time: string
  durationMin: number
  format: 'presencial' | 'video'
  location: string
  notes: string
}

type ConnStatus = 'loading' | 'connected' | 'not_connected'

/** Duração padrão de 1h; opções curtas para agilidade. */
const DURATION_OPTIONS = [
  { value: '30', label: '30 minutos' },
  { value: '60', label: '1 hora' },
  { value: '90', label: '1h30' },
  { value: '120', label: '2 horas' },
]

export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  jobTitle,
  onScheduled,
}: ScheduleInterviewDialogProps) {
  const { toast } = useToast()
  const [status, setStatus] = useState<ConnStatus>('loading')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState('60')
  const [format, setFormat] = useState<'presencial' | 'video'>('presencial')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDate('')
    setTime('09:00')
    setDuration('60')
    setFormat('presencial')
    setLocation('')
    setNotes('')
    setStatus('loading')
    getToolkitStatus(CALENDAR_TOOLKIT)
      .then((s) => setStatus(s === 'connected' ? 'connected' : 'not_connected'))
      .catch(() => setStatus('not_connected'))
  }, [open])

  const canSave = status === 'connected' && date.length > 0 && time.length > 0 && !saving

  const handleConfirm = async () => {
    if (!canSave || !candidateId) return
    setSaving(true)
    try {
      const startISO = new Date(`${date}T${time}:00`).toISOString()
      const endISO = new Date(
        new Date(`${date}T${time}:00`).getTime() + Number(duration) * 60_000,
      ).toISOString()

      const fmtLabel = format === 'video' ? 'Vídeo' : 'Presencial'
      const title = `Entrevista: ${candidateName}${jobTitle ? ` — ${jobTitle}` : ''}`
      const descriptionParts = [
        `Entrevista com ${candidateName}${jobTitle ? ` para a vaga ${jobTitle}` : ''}.`,
        `Formato: ${fmtLabel}.`,
        location ? (format === 'video' ? `Link/local: ${location}` : `Local: ${location}`) : '',
        notes ? `Observações: ${notes}` : '',
      ].filter(Boolean)

      const result = await createCalendarEvent({
        title,
        startISO,
        endISO,
        description: descriptionParts.join('\n'),
      })

      if (!result.ok) {
        // Erro de criação do evento: a auditoria NÃO é registrada como sucesso.
        toast({
          title: 'Não foi possível agendar',
          description:
            result.error ||
            'O Google Calendar não confirmou a criação do evento. Tente novamente em instantes.',
          variant: 'destructive',
        })
        return
      }

      toast({ title: 'Entrevista agendada', description: 'Evento criado no seu Google Calendar.' })
      onScheduled?.({
        date,
        time,
        durationMin: Number(duration),
        format,
        location,
        notes,
      })
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Não foi possível agendar',
        description: err instanceof Error ? err.message : 'Erro inesperado ao criar o evento.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-sky-600" />
            Agendar entrevista com {candidateName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            O evento é criado na sua conta do Google Calendar conectada em Integrações.
          </DialogDescription>
        </DialogHeader>

        {status === 'loading' && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando conexão...
          </div>
        )}

        {status === 'not_connected' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 space-y-2">
            <p className="font-semibold">Sua conta do Google Calendar ainda não está conectada.</p>
            <p>Conecte sua conta em Integrações para agendar entrevistas com os candidatos.</p>
            <Link to="/integracoes" className="inline-block font-semibold text-sky-700 underline">
              Ir para Integrações
            </Link>
          </div>
        )}

        {status === 'connected' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="interview-date" className="text-xs">
                  Data
                </Label>
                <Input
                  id="interview-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interview-time" className="text-xs">
                  Hora de início
                </Label>
                <Input
                  id="interview-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Duração</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value} className="text-xs">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Formato</Label>
                <Select
                  value={format}
                  onValueChange={(v) => setFormat(v as 'presencial' | 'video')}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial" className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" /> Presencial
                      </span>
                    </SelectItem>
                    <SelectItem value="video" className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5" /> Vídeo
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interview-location" className="text-xs">
                {format === 'video' ? 'Link da vídeochamada' : 'Local'}{' '}
                <span className="text-slate-400">(opcional)</span>
              </Label>
              <Input
                id="interview-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={
                  format === 'video' ? 'https://meet.google.com/...' : 'Ex: Sala de reunião 2'
                }
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interview-notes" className="text-xs">
                Observações <span className="text-slate-400">(opcional)</span>
              </Label>
              <Textarea
                id="interview-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: levar portfólio, entrevistar com o gestor da área..."
                className="text-xs"
              />
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
              disabled={!canSave}
              onClick={handleConfirm}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              <CalendarPlus className="w-3.5 h-3.5 mr-1" />
              {saving ? 'Agendando...' : 'Agendar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
