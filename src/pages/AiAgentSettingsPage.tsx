import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, KeyRound, Save, Sparkles } from 'lucide-react'
import {
  AiAgentSettings,
  AiProvider,
  DEFAULT_AGENT_SETTINGS,
  PROVIDER_MODEL_PLACEHOLDER,
  getAgentSettings,
  saveAgentSettings,
  saveProviderKey,
  testProviderConnection,
} from '@/services/aiAgentSettings'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { formatScoreDate } from '@/hooks/use-ai-score'

const PROVIDERS: { value: AiProvider; label: string; description: string }[] = [
  {
    value: 'native',
    label: 'Nativo (padrão)',
    description: 'Agente embutido do Talent — sem custo extra, nada a configurar.',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'Use a SUA chave da OpenAI — o custo é cobrado direto na sua conta.',
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    description: 'Use a SUA chave do Gemini — o custo é cobrado direto na sua conta.',
  },
]

export default function AiAgentSettingsPage() {
  const { user } = useAuth()
  const userOrgId = String((pb.authStore.record as Record<string, unknown> | null)?.org_id || '')
  const { toast } = useToast()
  const location = useLocation()
  const isAdmin = user?.role === 'admin'
  const readOnly = !isAdmin

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testingResult, setTestingResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [settings, setSettings] = useState<AiAgentSettings>({
    ...DEFAULT_AGENT_SETTINGS,
    id: '',
    org_id: '',
    updated: '',
  })
  const [aiProvider, setAiProvider] = useState<AiProvider>('native')
  const [apiKey, setApiKey] = useState('')
  const [aiModel, setAiModel] = useState('')

  // Recarrega quando a organização ativa muda (config por organização, 0029).
  useEffect(() => {
    let cancelled = false
    getAgentSettings().then((data) => {
      if (cancelled) return
      setSettings(data)
      setAiProvider(data.ai_provider || 'native')
      setAiModel(data.ai_model || '')
      setApiKey('')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [userOrgId])

  // Sincroniza com a Sidebar (item ativo do menu).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ats:active-item', { detail: location.pathname }))
  }, [location.pathname])

  const handleTest = async () => {
    if (!aiProvider || aiProvider === 'native') {
      toast({
        title: 'Provedor nativo',
        description: 'O agente nativo não usa chave própria — nada a testar.',
      })
      return
    }
    setTesting(true)
    setTestingResult(null)
    try {
      const res = await testProviderConnection(aiProvider, apiKey, aiModel)
      setTestingResult(
        res.ok
          ? { ok: true, text: res.message || 'Conexão OK.' }
          : { ok: false, text: res.error || 'Não foi possível conectar ao provedor.' },
      )
    } catch (err) {
      setTestingResult({ ok: false, text: 'Não foi possível conectar ao provedor.' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await saveAgentSettings({
        ...settings,
        id: settings.id,
        org_id: settings.org_id || userOrgId,
        ai_provider: aiProvider,
        ai_model: aiModel,
      })
      // A chave só é gravada (write-only) quando o admin digitou uma nova.
      if (!readOnly && aiProvider !== 'native' && apiKey.trim()) {
        await saveProviderKey(aiProvider, apiKey.trim(), aiModel)
      }
      const refreshed = await getAgentSettings()
      setSettings(refreshed)
      setAiProvider(refreshed.ai_provider || 'native')
      setAiModel(refreshed.ai_model || '')
      setApiKey('')
      setTestingResult(null)
      toast({
        title: 'Configuração salva com sucesso.',
        description: settings.ai_key_last4
          ? `Chave ativa: •••• ${refreshed.ai_key_last4 || settings.ai_key_last4}`
          : undefined,
      })
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: getErrorMessage(err) || 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const keyMasked = settings.ai_key_last4
    ? `Chave configurada •••• ${settings.ai_key_last4}${
        settings.ai_key_updated_at
          ? ` (atualizada em ${formatScoreDate(settings.ai_key_updated_at)})`
          : ''
      }`
    : 'Nenhuma chave configurada ainda.'

  const saveKeyLabel = settings.ai_key_last4 ? 'Trocar chave' : 'Salvar chave'

  const canEdit = !readOnly && settings.enabled !== undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agente de Score de IA</h1>
        <p className="text-muted-foreground text-sm">
          Configure o agente consultivo que avalia os candidatos no pipeline.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {readOnly && (
            <Alert>
              <AlertDescription className="flex items-center gap-2">
                <Badge variant="outline">Somente leitura</Badge>
                Apenas administradores podem alterar estas configurações.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Geral
              </CardTitle>
              <CardDescription>
                O agente dá um score consultivo (0–100) com justificativa — nunca aprova ou reprova.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="agent-enabled">Agente ativado</Label>
                  <p className="text-muted-foreground text-xs">
                    Desativado: nenhum score é calculado (manual ou automático).
                  </p>
                </div>
                <Switch
                  id="agent-enabled"
                  checked={settings.enabled}
                  disabled={readOnly}
                  onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="w-tech">Peso técnico (%)</Label>
                  <Input
                    id="w-tech"
                    type="number"
                    min={0}
                    max={100}
                    value={settings.weight_technical}
                    disabled={readOnly}
                    onChange={(e) =>
                      setSettings({ ...settings, weight_technical: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="w-beh">Peso comportamental (%)</Label>
                  <Input
                    id="w-beh"
                    type="number"
                    min={0}
                    max={100}
                    value={settings.weight_behavioral}
                    disabled={readOnly}
                    onChange={(e) =>
                      setSettings({ ...settings, weight_behavioral: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="w-cult">Peso cultural (%)</Label>
                  <Input
                    id="w-cult"
                    type="number"
                    min={0}
                    max={100}
                    value={settings.weight_cultural}
                    disabled={readOnly}
                    onChange={(e) =>
                      setSettings({ ...settings, weight_cultural: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" /> Provedor de IA
              </CardTitle>
              <CardDescription>
                Com chave própria, o custo de IA é cobrado direto na sua conta no provedor
                escolhido. Se o provedor falhar, o agente nativo assume automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={aiProvider}
                onValueChange={(v) => setAiProvider(v as AiProvider)}
                disabled={readOnly}
                className="gap-2"
              >
                {PROVIDERS.map((p) => (
                  <Label
                    key={p.value}
                    htmlFor={`provider-${p.value}`}
                    className="hover:bg-accent/50 flex cursor-pointer items-start gap-3 rounded-lg border p-4"
                  >
                    <RadioGroupItem value={p.value} id={`provider-${p.value}`} className="mt-1" />
                    <div>
                      <p className="font-medium">{p.label}</p>
                      <p className="text-muted-foreground text-xs">{p.description}</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>

              {aiProvider !== 'native' && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="api-key">
                        Chave de API
                        {settings.ai_key_last4 ? ' (deixe vazio para manter a atual)' : ''}
                      </Label>
                      {settings.ai_key_last4 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground h-7 px-2 text-xs"
                          disabled={readOnly}
                          onClick={() => {
                            setApiKey('')
                            document.getElementById('api-key')?.focus()
                          }}
                        >
                          <KeyRound className="mr-1 h-3 w-3" /> Trocar chave
                        </Button>
                      )}
                    </div>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder={
                        settings.ai_key_last4 ? `•••• ${settings.ai_key_last4}` : 'sk-...'
                      }
                      value={apiKey}
                      disabled={readOnly}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="off"
                    />
                    <p className="text-muted-foreground text-xs">{keyMasked}</p>
                    <p className="text-muted-foreground/70 text-[11px]">
                      A chave nunca é exibida por inteiro — apenas os 4 últimos caracteres (
                      {saveKeyLabel} substitui a atual).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai-model">Modelo (opcional)</Label>
                    <Input
                      id="ai-model"
                      placeholder={PROVIDER_MODEL_PLACEHOLDER[aiProvider]}
                      value={aiModel}
                      disabled={readOnly}
                      onChange={(e) => setAiModel(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTest}
                      disabled={testing || readOnly}
                    >
                      {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Testar conexão
                    </Button>
                    {testingResult && (
                      <span
                        className={
                          testingResult.ok ? 'text-sm text-green-600' : 'text-destructive text-sm'
                        }
                      >
                        {testingResult.text}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving || readOnly || !canEdit}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar configuração
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
