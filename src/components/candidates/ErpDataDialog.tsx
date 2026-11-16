import { Database } from 'lucide-react'
import { useMemo, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { toast } from '@/hooks/use-toast'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ERP_INTEGRATION_FIELDS,
  buildErpFormDefaults,
  candidateKnownFields,
  type ErpIntegrationData,
} from '@/lib/erpIntegration'
import { cn } from '@/lib/utils'
import type { Candidate, Job } from '@/types/ats'

export interface ErpDataDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidate: Candidate
  job?: Job
  admissionDate?: string
  onSaved: (data: ErpIntegrationData) => void
}

/** Formulário "Dados para integração" da etapa Integração ERP. */
const ErpDataDialog: React.FC<ErpDataDialogProps> = ({
  open,
  onOpenChange,
  candidate,
  job,
  admissionDate,
  onSaved,
}) => {
  const [data, setData] = useState<ErpIntegrationData>({})
  const [initialized, setInitialized] = useState(false)
  const [saving, setSaving] = useState(false)

  // Prepara o formulário a cada abertura (salvo + sugestões da vaga).
  if (open && !initialized) {
    setData(buildErpFormDefaults(candidate, job, admissionDate))
    setInitialized(true)
  }
  if (!open && initialized) setInitialized(false)

  const known = useMemo(() => candidateKnownFields(candidate), [candidate])
  const handleSave = async () => {
    setSaving(true)
    try {
      await pb.collection('candidates').update(candidate.id, { erp_data: data })
      toast({ title: 'Dados salvos!', description: 'Os dados para integração foram gravados.' })
      onSaved(data)
      onOpenChange(false)
    } catch (err) {
      console.error('Erro ao salvar dados de integração:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível gravar os dados. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-600" />
            Dados para integração — {candidate.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Preencha os dados admissionais e documentais que faltam para integrar o colaborador no
            ERP Goldway. Esses dados alimentam a exportação "Cadastro Profissional" em /integracoes.
            Campos essenciais estão marcados com <span className="text-rose-500">*</span>.{' '}
            {job ? `Vaga: ${job.title}.` : ''}
          </DialogDescription>
        </DialogHeader>

        {known.length > 0 && (
          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded p-2">
            <span className="font-semibold text-slate-600">Já no cadastro (somente leitura): </span>
            {known.map((f, i) => (
              <span key={f.label}>
                {i > 0 && ' · '}
                <span className="text-slate-700">{f.label}:</span> {f.value}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          {ERP_INTEGRATION_FIELDS.map((field) => {
            const highlight = !(data[field.key] || '').trim()
            return (
              <div key={field.key} className="space-y-1">
                <Label
                  className={cn(
                    'text-xs font-semibold',
                    highlight ? 'text-amber-700' : 'text-slate-600',
                  )}
                >
                  {field.label}
                  {field.essential && <span className="text-rose-500"> *</span>}
                  {highlight && (
                    <span className="ml-1.5 text-[10px] text-amber-600 font-normal">
                      (faltando)
                    </span>
                  )}
                </Label>
                {field.type === 'select' ? (
                  <Select
                    value={data[field.key] || 'none'}
                    onValueChange={(v) =>
                      setData((p) => ({ ...p, [field.key]: v === 'none' ? '' : v }))
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        'text-xs',
                        highlight && 'border-amber-300 ring-1 ring-amber-200 bg-amber-50',
                      )}
                    >
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">
                        (selecione)
                      </SelectItem>
                      {(field.options || []).map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-xs">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={data[field.key] || ''}
                    type={
                      field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'
                    }
                    placeholder={field.placeholder}
                    onChange={(e) => setData((p) => ({ ...p, [field.key]: e.target.value }))}
                    className={cn(
                      'text-xs',
                      highlight && 'border-amber-300 ring-1 ring-amber-200 bg-amber-50',
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={handleSave}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            {saving ? 'Salvando...' : 'Salvar dados'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ErpDataDialog
