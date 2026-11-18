// Painel de integrações do ATS — /integracoes (apenas admin/superadmin).
// 3 cartões: Goldway (ERP), WhatsApp e Calendário. O ponto eletrônico fica por
// conta do próprio ERP: após a aprovação, o cadastro do contratado é exportado
// para o Goldway e o ERP cuida do cadastro no ponto.
// O estado de ativação (Goldway) vive na coleção integration_settings (0021),
// um registro por empresa ativa; WhatsApp e Calendário são contas PRÓPRIAS de
// cada usuário conectadas via conectores (ConnectorButton).
import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  CalendarPlus,
  Download,
  MessageCircle,
  PlugZap,
  RefreshCw,
  Upload,
} from 'lucide-react'
import { useActiveCompany } from '@/hooks/use-active-company'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ConnectorButton } from '@/components/skip/ConnectorButton'
import { GoldwayExportDialog, GoldwayImportDialog } from '@/components/integrations/GoldwayDialogs'
import {
  CALENDAR_TOOLKIT,
  WHATSAPP_TOOLKIT,
  fetchHiredApplications,
  getToolkitStatus,
  integrationsService,
  type HiredApplication,
  type IntegrationKey,
} from '@/services/integrations'
import type { ConnectorStatus } from '@/lib/skipConnectors'

interface CardState {
  enabled: boolean
  lastSyncAt?: string
  lastSyncSummary?: string
}

const GOLDWAY: IntegrationKey = 'goldway'

const formatDate = (iso?: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR')
}

export default function IntegrationsPage() {
  const { toast } = useToast()
  const { activeCompany, activeCompanyId } = useActiveCompany()

  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Record<string, CardState>>({})
  const [goldwayCount, setGoldwayCount] = useState<number | null>(null)
  const [hiredForExport, setHiredForExport] = useState<HiredApplication[]>([])
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState<ConnectorStatus>('not_connected')
  const [calendarStatus, setCalendarStatus] = useState<ConnectorStatus>('not_connected')

  const hasCompany = Boolean(activeCompanyId)

  const load = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [list, hired, waStatus, calStatus] = await Promise.all([
        integrationsService.list(),
        fetchHiredApplications(activeCompanyId),
        getToolkitStatus(WHATSAPP_TOOLKIT),
        getToolkitStatus(CALENDAR_TOOLKIT),
      ])
      const next: Record<string, CardState> = {}
      for (const s of list) {
        if (s.company_id === activeCompanyId) {
          next[s.integration] = {
            enabled: Boolean(s.enabled),
            lastSyncAt: s.last_sync_at,
            lastSyncSummary: s.last_sync_summary,
          }
        }
      }
      setSettings(next)
      setGoldwayCount(hired.length)
      setHiredForExport(hired)
      setWhatsappStatus(waStatus)
      setCalendarStatus(calStatus)
    } catch (err) {
      toast({
        title: 'Erro ao carregar integrações',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    load()
  }, [load])

  const goldway = settings[GOLDWAY] || { enabled: false }

  const toggleGoldway = async (enabled: boolean) => {
    if (!activeCompanyId) return
    try {
      await integrationsService.save(GOLDWAY, activeCompanyId, {
        enabled,
        config: {},
      })
      setSettings((prev) => ({ ...prev, [GOLDWAY]: { ...prev[GOLDWAY], enabled } }))
      toast({
        title: enabled ? 'Integração Goldway ativada' : 'Integração Goldway desativada',
        description: enabled
          ? 'Agora você pode exportar os contratados para o ERP.'
          : 'A exportação de contratados ficará indisponível.',
      })
    } catch (err) {
      toast({
        title: 'Não foi possível salvar',
        description: err instanceof Error ? err.message : 'Erro inesperado.',
        variant: 'destructive',
      })
    }
  }

  const openExportDialog = () => {
    if (!activeCompanyId || !goldway.enabled) return
    if (hiredForExport.length === 0) {
      toast({
        title: 'Nenhum contratado para exportar',
        description: 'Não há candidatos com status "contratado" nesta empresa.',
      })
      return
    }
    setExportOpen(true)
  }

  const afterExport = async (count: number) => {
    const now = new Date().toISOString()
    const summary = `${count} contratado(s) exportado(s)`
    try {
      await integrationsService.save(GOLDWAY, activeCompanyId!, {
        enabled: goldway.enabled,
        config: {},
        last_sync_at: now,
        last_sync_summary: summary,
      })
    } catch {
      /* registro de sync é best-effort */
    }
    setSettings((prev) => ({
      ...prev,
      [GOLDWAY]: { ...prev[GOLDWAY], enabled: true, lastSyncAt: now, lastSyncSummary: summary },
    }))
  }

  const goldwayBadge = goldway.enabled ? 'Ativa' : 'Inativa'
  const whatsappBadge =
    whatsappStatus === 'connected'
      ? 'Conectada'
      : whatsappStatus === 'expired'
        ? 'Sessão expirada'
        : 'Desconectada'
  const calendarBadge =
    calendarStatus === 'connected'
      ? 'Conectada'
      : calendarStatus === 'expired'
        ? 'Sessão expirada'
        : 'Desconectada'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte o Talent aos sistemas usados pela empresa{' '}
          <span className="font-medium text-foreground">{activeCompany?.name || '—'}</span>.
        </p>
      </div>

      {!hasCompany && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Selecione uma empresa ativa para configurar as integrações.
          </CardContent>
        </Card>
      )}

      {hasCompany && loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-9 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasCompany && !loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* ---------------- GOLDWAY ---------------- */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500" />
                Goldway ERP
              </CardTitle>
              <Badge variant={goldway.enabled ? 'default' : 'secondary'}>{goldwayBadge}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Destino pós-contratação: após a aprovação do candidato, o cadastro do contratado é
                exportado para o ERP no layout "Cadastro Profissional" (planilha pronta para
                importação). O ponto eletrônico fica por conta do próprio ERP, que cadastra o
                usuário diretamente nele — sem integração adicional no Talent.
              </p>
              <p className="text-sm">
                <span className="font-medium">{goldwayCount ?? '—'}</span>{' '}
                <span className="text-muted-foreground">contratado(s) exportável(is)</span>
              </p>
              {goldway.lastSyncAt && (
                <p className="text-xs text-muted-foreground">
                  Última exportação: {formatDate(goldway.lastSyncAt)} ·{' '}
                  {goldway.lastSyncSummary || ''}
                </p>
              )}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Switch checked={goldway.enabled} onCheckedChange={toggleGoldway} />
                  <span className="text-sm text-muted-foreground">
                    {goldway.enabled ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar
                  </Button>
                  <Button
                    size="sm"
                    disabled={!goldway.enabled || (goldwayCount ?? 0) === 0}
                    onClick={openExportDialog}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar contratados
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ---------------- WHATSAPP ---------------- */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
                WhatsApp
              </CardTitle>
              <Badge variant={whatsappStatus === 'connected' ? 'default' : 'secondary'}>
                {whatsappBadge}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cada usuário conecta a{' '}
                <span className="font-medium text-foreground">própria conta</span> de WhatsApp. Com
                a conta conectada, o perfil do candidato ganha a ação de enviar mensagem/status; se
                o envio direto não estiver disponível, o app abre a conversa com a mensagem pronta.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <ConnectorButton toolkit={WHATSAPP_TOOLKIT} name="WhatsApp" />
                <Button variant="outline" size="sm" onClick={load}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar status
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ---------------- CALENDÁRIO ---------------- */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-sky-600" />
                Calendário (Google)
              </CardTitle>
              <Badge variant={calendarStatus === 'connected' ? 'default' : 'secondary'}>
                {calendarBadge}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Conecte o <span className="font-medium text-foreground">seu</span> Google Calendar
                para agendar entrevistas direto do pipeline: o evento é criado na sua agenda com
                candidato, vaga e horário escolhidos.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <ConnectorButton toolkit={CALENDAR_TOOLKIT} name="Google Calendar" />
                <Button variant="outline" size="sm" onClick={load}>
                  <PlugZap className="mr-2 h-4 w-4" />
                  Atualizar status
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {hasCompany && activeCompanyId && (
        <>
          <GoldwayExportDialog
            open={exportOpen}
            onOpenChange={setExportOpen}
            hired={hiredForExport}
            companyName={activeCompany?.name || 'empresa'}
            onExported={afterExport}
          />
          <GoldwayImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            companyId={activeCompanyId}
            onImported={load}
          />
        </>
      )}
    </div>
  )
}
