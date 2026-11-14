import { useEffect, useState } from 'react'
import { Bot, RefreshCw, Save, ShieldCheck, Info, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useAiAgentSettings } from '@/hooks/use-ai-agent-settings'
import { saveAgentSettings, type AiAgentSettings } from '@/services/aiAgentSettings'

// Painel "Agente de Score de IA": interruptor global, pesos das três dimensões
// (soma obrigatoriamente 100) e gatilhos automáticos ligáveis individualmente.
// Leitura para todos os papéis autenticados; edição apenas administrador.

const TRIGGERS: Array<{ key: keyof AiAgentSettings; label: string; description: string }> = [
  {
    key: 'trigger_new_application',
    label: 'Nova candidatura',
    description: 'Calcula o score assim que o candidato se inscreve na vaga.',
  },
  {
    key: 'trigger_stage_change',
    label: 'Mudança de etapa',
    description: 'Recalcula quando o candidato avança ou recua no pipeline.',
  },
  {
    key: 'trigger_disc_completed',
    label: 'DISC preenchido',
    description: 'Recalcula quando o candidato termina o questionário DISC.',
  },
  {
    key: 'trigger_note_added',
    label: 'Comentário adicionado',
    description: 'Recalcula quando um novo comentário é registrado na candidatura.',
  },
]

const DIMENSIONS: Array<{ key: keyof AiAgentSettings; label: string; description: string }> = [
  {
    key: 'weight_technical',
    label: 'Técnica',
    description: 'Currículo e habilidades vs. pré-requisitos da vaga.',
  },
  {
    key: 'weight_behavioral',
    label: 'Comportamental',
    description: 'Perfil DISC do candidato vs. perfil esperado.',
  },
  {
    key: 'weight_cultural',
    label: 'Cultural',
    description: 'Aderência à visão, missão e valores da empresa.',
  },
]

const sumWeights = (s: {
  weight_technical: number
  weight_behavioral: number
  weight_cultural: number
}) => s.weight_technical + s.weight_behavioral + s.weight_cultural

export default function AiAgentSettingsPage() {
  const { settings, loading, refresh, applyLocal } = useAiAgentSettings()
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  const [draft, setDraft] = useState<AiAgentSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const readOnly = !isAdmin

  useEffect(() => {
    if (!draft && settings.id) setDraft({ ...settings })
  }, [settings, draft])

  const current = draft || settings
  const sum = sumWeights(current)
  const sumOk = sum === 100

  const handleSave = async () => {
    if (!draft || !sumOk) return
    setSaving(true)
    try {
      const saved = await saveAgentSettings(draft)
      applyLocal(saved)
      setDraft({ ...saved })
      toast({
        title: 'Configuração salva',
        description: 'O agente de score passa a usar estas configurações imediatamente.',
      })
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading && !settings.id) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-600" />
            Agente de Score de IA
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configura o cálculo consultivo de aderência candidato × vaga.
          </p>
        </div>
        {readOnly && (
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Somente leitura — apenas o administrador altera
          </Badge>
        )}
      </div>

      {/* Interruptor grande Ativado/Desativado */}
      <Card className={current.enabled ? 'border-emerald-200' : 'border-slate-200'}>
        <CardContent className="py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold flex items-center gap-2">
              <Sparkles
                className={`w-4 h-4 ${current.enabled ? 'text-emerald-600' : 'text-slate-400'}`}
              />
              {current.enabled ? 'Agente ativado' : 'Agente desativado'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {current.enabled
                ? 'O agente calcula e recalcula scores conforme os gatilhos abaixo.'
                : 'Nenhum score é calculado — nem por gatilho automático, nem no botão "Recalcular".'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-medium ${current.enabled ? 'text-emerald-700' : 'text-slate-400'}`}
            >
              {current.enabled ? 'Ativado' : 'Desativado'}
            </span>
            <Switch
              checked={current.enabled}
              disabled={readOnly || saving}
              onCheckedChange={(v) => {
                if (!draft) return
                setDraft({ ...draft, enabled: v })
              }}
              aria-label="Ativar ou desativar o agente de score de IA"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pesos das dimensões */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Pesos das dimensões</CardTitle>
          <p className="text-xs text-slate-500">
            A soma dos três pesos deve ser exatamente 100 — ela define quanto cada dimensão vale no
            score geral.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {DIMENSIONS.map((dim) => (
            <div key={String(dim.key)}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium text-slate-700">{dim.label}</span>
                <span className="tabular-nums font-semibold text-slate-700">
                  {current[dim.key] as number}%
                </span>
              </div>
              <Slider
                value={[current[dim.key] as number]}
                min={0}
                max={100}
                step={5}
                disabled={readOnly || saving}
                onValueChange={(vals) => {
                  if (!draft) return
                  setDraft({ ...draft, [dim.key]: vals[0] })
                }}
                className="py-2"
              />
              <p className="text-[11px] text-slate-400">{dim.description}</p>
            </div>
          ))}

          <div
            className={`text-xs flex items-center gap-2 ${sumOk ? 'text-emerald-700' : 'text-red-600'}`}
          >
            <Info className="w-3.5 h-3.5" />
            {sumOk
              ? 'Soma correta: 100.'
              : `A soma dos pesos é ${sum} — ajuste até chegar exatamente a 100 para salvar.`}
          </div>
        </CardContent>
      </Card>

      {/* Gatilhos automáticos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Gatilhos automáticos</CardTitle>
          <p className="text-xs text-slate-500">
            Cada gatilho pode ser ligado ou desligado individualmente — o agente só recalcula nos
            eventos que estiverem ativos aqui.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {TRIGGERS.map((trigger) => (
            <div key={String(trigger.key)} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-700">{trigger.label}</p>
                <p className="text-[11px] text-slate-400">{trigger.description}</p>
              </div>
              <Switch
                checked={Boolean(current[trigger.key])}
                disabled={readOnly || saving}
                onCheckedChange={(v) => {
                  if (!draft) return
                  setDraft({ ...draft, [trigger.key]: v })
                }}
                aria-label={`Gatilho: ${trigger.label}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={readOnly || saving || !sumOk || !draft}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar configuração'}
        </Button>
        <Button
          variant="ghost"
          disabled={saving}
          onClick={() => {
            setDraft(null)
            refresh()
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Descartar alterações
        </Button>
        {!sumOk && (
          <span className="text-xs text-red-600">
            Ajuste a soma dos pesos para habilitar o botão.
          </span>
        )}
      </div>
    </div>
  )
}
