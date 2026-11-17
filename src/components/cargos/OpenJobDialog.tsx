import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Lock, AlertTriangle, Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { CargoRaw } from '@/services/cargos'
import type { CargoInheritance } from '@/services/jobOpening'
import { formatBRL } from '@/services/jobOpening'

interface OpenJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cargo: CargoRaw | null
  inheritance: CargoInheritance | null
}

interface InheritedItem {
  label: string
  value: string
}

const CONTRACT_OPTIONS = [
  { value: 'clt', label: 'CLT' },
  { value: 'pj', label: 'PJ' },
  { value: 'internship', label: 'Estágio' },
  { value: 'temporary', label: 'Temporário' },
]

const MODEL_OPTIONS = [
  { value: 'on_site', label: 'Presencial' },
  { value: 'hybrid', label: 'Híbrido' },
  { value: 'remote', label: 'Remoto' },
]

const URGENCY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
]

/** FASE 3: diálogo de abertura de vaga a partir de um cargo aprovado.
 *  Herança somente-leitura (posição/cargo/faixa/gestor/centro de custo) +
 *  campos próprios da vaga (quantidade, contrato, modelo, prazo, urgência). */
export const OpenJobDialog: React.FC<OpenJobDialogProps> = ({
  open,
  onOpenChange,
  cargo,
  inheritance,
}) => {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [quantity, setQuantity] = useState('1')
  const [contractType, setContractType] = useState('clt')
  const [workModel, setWorkModel] = useState('hybrid')
  const [deadline, setDeadline] = useState('')
  const [urgency, setUrgency] = useState('normal')
  const [saving, setSaving] = useState(false)

  const inherited: InheritedItem[] = useMemo(() => {
    if (!inheritance) return []
    const items: InheritedItem[] = []
    const node = inheritance.node
    if (node?.name) items.push({ label: 'Posição (organograma)', value: node.name })
    items.push({ label: 'Cargo', value: inheritance.cargo?.title || '—' })
    items.push({
      label: 'Faixa salarial',
      value:
        inheritance.cargo?.salary_min != null || inheritance.cargo?.salary_max != null
          ? `${formatBRL(inheritance.cargo?.salary_min ?? null)} — ${formatBRL(
              inheritance.cargo?.salary_max ?? null,
            )}`
          : '—',
    })
    if (node?.manager) items.push({ label: 'Gestor', value: node.manager })
    if (node?.cost_center) items.push({ label: 'Centro de custo', value: node.cost_center })
    return items
  }, [inheritance, cargo])

  const quantityNum = parseInt(quantity, 10)
  const quantityValid = Number.isFinite(quantityNum) && quantityNum >= 1

  const handleSave = async () => {
    if (!cargo || !inheritance) return
    if (!quantityValid) {
      toast({
        title: 'Quantidade inválida',
        description: 'Informe ao menos 1 posição.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const { jobsService } = await import('@/services/jobs')
      // Campos herdados são gravados a partir do cargo de origem (servidor também
      // valida no hook de create — o cliente envia apenas os vínculos e os próprios).
      await jobsService.createJob({
        title: `${cargo.title}${quantityNum > 1 ? ` (${quantityNum} posições)` : ''}`,
        slug: `${cargo.id}-${Date.now()}`,
        description: cargo.mission || '',
        status: 'draft',
        cargo_id: cargo.id,
        org_node_id: inheritance.node?.id || undefined,
        headcount: quantityNum,
        employment_type: contractType,
        workplace_type: workModel,
        deadline: deadline || undefined,
        urgent: urgency !== 'normal',
        salary_min: inheritance.cargo?.salary_min ?? undefined,
        salary_max: inheritance.cargo?.salary_max ?? undefined,
        manager_id: inheritance.node?.manager_id || undefined,
      } as never)
      toast({ title: 'Vaga aberta!', description: 'A vaga foi criada a partir do cargo.' })
      onOpenChange(false)
      navigate('/vagas')
    } catch (err) {
      console.error('Erro ao abrir vaga:', err)
      toast({
        title: 'Erro ao abrir vaga',
        description: 'Verifique as pré-condições e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!cargo) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Abrir vaga — {cargo.title}
            <Badge variant="outline" className="text-[10px] border-sky-300 text-sky-700">
              herança do cargo
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Os dados herdados vêm do cargo aprovado e do organograma vigente — não podem ser
            alterados aqui.
          </DialogDescription>
        </DialogHeader>

        {/* Herança somente-leitura */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            <Lock className="w-3 h-3" /> Herdado do cargo (somente leitura)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {inherited.map((item) => (
              <div key={item.label} className="rounded border border-slate-200 bg-white p-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{item.label}</p>
                <p className="text-xs font-medium text-slate-800">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Campos próprios da vaga */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="open-qty" className="text-xs font-semibold">
                Quantidade de posições *
              </Label>
              <Input
                id="open-qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Tipo de contrato *</Label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">Modelo de trabalho</Label>
              <Select value={workModel} onValueChange={setWorkModel}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="open-deadline" className="text-xs font-semibold">
                Prazo (contratação até)
              </Label>
              <Input
                id="open-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Urgência</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {URGENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-800">
              A vaga é criada como <strong>rascunho</strong>. Revise título, descrição e requisitos
              específicos em /vagas antes de publicar — o servidor revalida cargo aprovado e
              organograma vigente no momento da publicação.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !quantityValid}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Abrindo...' : 'Abrir vaga'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OpenJobDialog
