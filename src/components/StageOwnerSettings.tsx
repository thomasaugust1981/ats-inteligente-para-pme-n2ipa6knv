import React, { useEffect, useRef, useState } from 'react'
import { BellRing, Loader2, UserPlus } from 'lucide-react'
import type { User, JobStage } from '@/types/ats'
import {
  stageSettingsService,
  buildStageDrafts,
  DEFAULT_REMINDER_DAYS,
  FINAL_STAGE_IDS,
  type StageConfigDraft,
} from '@/services/stageSettings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

type Props = {
  /** Vaga à qual as etapas pertencem. Se null, o componente só exibe/permite editar o rascunho (usado no onboarding antes de existir vaga). */
  jobId?: string | null
  stages: JobStage[]
  teamMembers: User[]
  /** Quando muda de valor, dispara o salvamento das configurações (via toast de resultado). */
  saveSignal?: number
  onSaved?: () => void
}

/**
 * Editor de responsáveis e notificações por etapa:
 * para cada etapa do processo, escolhe o responsável (usuário da equipe e/ou
 * e-mail livre) e se quer receber lembretes periódicos.
 */
export const StageOwnerSettings: React.FC<Props> = ({
  jobId,
  stages,
  teamMembers,
  saveSignal = 0,
  onSaved,
}) => {
  const [drafts, setDrafts] = useState<StageConfigDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  const { toast } = useToast()
  // Evita dois salvamentos paralelos (ex: duplo clique em "Salvar"/"Continuar")
  const savingRef = useRef(false)

  const activeStages = stages.filter((s) => !FINAL_STAGE_IDS.includes(s.id))

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!jobId) return
      setLoading(true)
      try {
        const existing = await stageSettingsService.listByJob(jobId)
        if (!cancelled) setDrafts(buildStageDrafts(stages, existing))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, stages.map((s) => s.id).join('|')])

  // Onboarding sem vaga ainda: monta rascunho local a partir das etapas padrão
  useEffect(() => {
    if (!jobId) {
      setDrafts(buildStageDrafts(stages, []))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, stages.map((s) => s.id).join('|')])

  const updateDraft = (stageId: string, patch: Partial<StageConfigDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.stage_id === stageId ? { ...d, ...patch } : d)))
  }

  const handleSave = async () => {
    if (savingRef.current) return
    if (!jobId) {
      toast({
        title: 'Configuração ainda não salvável',
        description: 'Conclua a criação da vaga para salvar os responsáveis por etapa.',
      })
      return
    }
    setSaving(true)
    savingRef.current = true
    try {
      const error = await stageSettingsService.saveAll(jobId, draftsRef.current)
      if (error) {
        toast({ title: 'Erro ao salvar', description: error, variant: 'destructive' })
        return
      }
      toast({
        title: 'Responsáveis por etapa salvos!',
        description: 'Notificações e lembretes atualizados.',
      })
      onSaved?.()
    } finally {
      setSaving(false)
      savingRef.current = false
    }
  }

  // Salva quando o pai sinaliza (botão "Salvar"/"Continuar" do passo/tela).
  // Dois caminhos com dedupe pelo MESMO contador (handledSignalRef):
  //  - efeito em [saveSignal]: o pai incrementa sem desmontar o componente
  //    (ex: botão "Salvar configuração" do dialog no pipeline);
  //  - cleanup do efeito de montagem: o pai incrementa E desmonta no mesmo clique
  //    (ex: "Continuar" do onboarding avança de passo) — um efeito comum nunca
  //    chegaria a rodar, e a configuração se perdia.
  // O dedupe evita salvar duas vezes (efeito + cleanup) e evita salvar spuriously
  // ao remontar com um sinal antigo (handledSignalRef começa no valor do mount).
  const saveSignalRef = useRef(saveSignal)
  saveSignalRef.current = saveSignal
  const handledSignalRef = useRef(saveSignal)
  const handleSaveRef = useRef<(() => Promise<void>) | null>(null)
  handleSaveRef.current = handleSave
  const triggerSaveIfSignalled = () => {
    if (!saveSignalRef.current) return
    if (saveSignalRef.current === handledSignalRef.current) return
    handledSignalRef.current = saveSignalRef.current
    void handleSaveRef.current?.()
  }
  useEffect(() => {
    triggerSaveIfSignalled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal])
  useEffect(() => {
    return () => {
      triggerSaveIfSignalled()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando configuração de etapas...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activeStages.map((stage) => {
        const draft = drafts.find((d) => d.stage_id === stage.id)
        if (!draft) return null
        return (
          <div key={stage.id} className="border rounded-lg p-3 space-y-2.5 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: stage.color || '#64748b' }}
              />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                {stage.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">
                  Responsável (usuário da equipe)
                </Label>
                <Select
                  value={draft.owner_user_id || '__none__'}
                  onValueChange={(v) =>
                    updateDraft(stage.id, { owner_user_id: v === '__none__' ? '' : v })
                  }
                >
                  <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem usuário responsável —</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name || m.email} ({m.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600">
                  E-mail adicional (opcional)
                </Label>
                <Input
                  type="email"
                  className="mt-1 h-8 text-xs bg-white"
                  placeholder="ex: triagem@suaempresa.com.br"
                  value={draft.owner_email}
                  onChange={(e) => updateDraft(stage.id, { owner_email: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={draft.reminder_enabled}
                  onCheckedChange={(v) => updateDraft(stage.id, { reminder_enabled: v })}
                />
                <span className="text-[11px] text-slate-600 flex items-center gap-1">
                  <BellRing className="w-3.5 h-3.5 text-amber-500" />
                  Receber lembretes enquanto a etapa estiver pendente
                </span>
              </label>
              {draft.reminder_enabled && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-slate-500">Lembrar após</span>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    className="w-16 h-7 text-xs bg-white"
                    value={draft.reminder_days}
                    onChange={(e) =>
                      updateDraft(stage.id, {
                        reminder_days: Math.max(1, parseInt(e.target.value || '1', 10)),
                      })
                    }
                  />
                  <span className="text-[11px] text-slate-500">dia(s) pendente(s)</span>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {activeStages.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">
          Nenhuma etapa configurável neste processo.
        </p>
      )}

      {teamMembers.length === 0 && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5 shrink-0" />
          Nenhum usuário da equipe cadastrado ainda — você pode usar apenas o e-mail adicional por
          enquanto.
        </p>
      )}

      <p className="text-[10px] text-slate-400">
        Padrão: lembrete após {DEFAULT_REMINDER_DAYS} dia(s) pendente(s), no máximo 1 lembrete por
        dia por candidato/etapa.
      </p>

      {saving && (
        <span className="text-xs text-slate-500 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando configuração...
        </span>
      )}
    </div>
  )
}

export default StageOwnerSettings
