import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import {
  onboardingService,
  ROLE_LABELS,
  DEFAULT_BRAND_COLOR,
  isValidBrandColor,
} from '@/services/onboarding'
import type { Company, TeamInvite, UserRole } from '@/types/ats'
import {
  Building2,
  Globe,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  SkipForward,
  Upload,
  Trash2,
  ExternalLink,
  X,
  Loader2,
} from 'lucide-react'
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

type BrandDraft = {
  name: string
  tradeName: string
  color: string
  logoFile: File | null
  removeLogo: boolean
}

const STEPS = [
  { n: 1, label: 'Dados da Empresa', icon: Building2 },
  { n: 2, label: 'Página de Carreiras', icon: Globe },
  { n: 3, label: 'Convidar Equipe', icon: Users },
  { n: 4, label: 'Conclusão', icon: CheckCircle2 },
]

const BRAND_PRESETS = ['#0284c7', '#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed']

function OnboardingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [step, setStep] = useState(1)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [brandDraft, setBrandDraft] = useState<BrandDraft>({
    name: '',
    tradeName: '',
    color: DEFAULT_BRAND_COLOR,
    logoFile: null,
    removeLogo: false,
  })
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [careersConfirmed, setCareersConfirmed] = useState(false)
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('recruiter')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const comp = await onboardingService.getOrCreateCompany(user?.company_name)
        if (comp) {
          setCompany(comp)
          setBrandDraft({
            name: comp.name || '',
            tradeName: comp.trade_name || '',
            color: isValidBrandColor(comp.brand_color) ? comp.brand_color! : DEFAULT_BRAND_COLOR,
            logoFile: null,
            removeLogo: false,
          })
          if (comp.logo) {
            setLogoPreview(onboardingService.getLogoUrl(comp))
          }
          setInvites(await onboardingService.listInvites())
        }
      } catch (err) {
        console.error('Erro ao carregar onboarding:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const markInProgress = useCallback(async () => {
    if (!company) return
    if (company.onboarding_status === 'completed') return
    try {
      const updated = await onboardingService.updateCompany(company.id, {
        onboarding_status: 'in_progress',
      })
      setCompany(updated)
    } catch (_) {
      // status permanece o atual; não bloqueia o fluxo
    }
  }, [company])

  useEffect(() => {
    markInProgress()
  }, [markInProgress])

  const careersUrl = useMemo(() => `${window.location.origin}/carreiras`, [])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBrandDraft((d) => ({ ...d, logoFile: file, removeLogo: false }))
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleRemoveLogo = () => {
    setBrandDraft((d) => ({ ...d, logoFile: null, removeLogo: true }))
    setLogoPreview(null)
  }

  const saveBrand = async (finish: boolean): Promise<boolean> => {
    if (!company) return false
    const name = brandDraft.name.trim()
    if (!name) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome da empresa antes de continuar.',
        variant: 'destructive',
      })
      return false
    }
    setSaving(true)
    try {
      let updated = await onboardingService.updateCompany(company.id, {
        name,
        trade_name: brandDraft.tradeName.trim() || undefined,
        brand_color: brandDraft.color,
      })
      if (brandDraft.logoFile) {
        updated = await onboardingService.updateLogo(company.id, brandDraft.logoFile)
      } else if (brandDraft.removeLogo) {
        updated = await onboardingService.updateCompany(company.id, { logo: null })
      }
      setCompany(updated)
      if (finish) {
        await onboardingService.updateCompany(company.id, { onboarding_status: 'completed' })
      }
      return true
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description:
          err instanceof Error ? err.message : 'Não foi possível salvar os dados da empresa.',
        variant: 'destructive',
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleAddInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: 'E-mail inválido',
        description: 'Digite um e-mail válido para convidar.',
        variant: 'destructive',
      })
      return
    }
    if (invites.some((i) => i.email === email && i.status === 'pending')) {
      toast({
        title: 'Convite já existe',
        description: 'Este e-mail já possui um convite pendente.',
        variant: 'destructive',
      })
      return
    }
    try {
      const created = await onboardingService.createInvite(email, inviteRole)
      setInvites((prev) => [created, ...prev])
      setInviteEmail('')
      toast({
        title: 'Convite registrado',
        description: `${email} ficará visível na lista de convites pendentes.`,
      })
    } catch (err) {
      toast({
        title: 'Erro ao registrar convite',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleCancelInvite = async (id: string) => {
    try {
      await onboardingService.cancelInvite(id)
      setInvites((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'cancelled' } : i)))
    } catch (err) {
      toast({
        title: 'Erro ao cancelar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleSkip = async () => {
    if (!company) return
    try {
      await onboardingService.updateCompany(company.id, { onboarding_status: 'skipped' })
      navigate('/')
    } catch (err) {
      toast({
        title: 'Erro ao pular',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleComplete = async () => {
    const ok = await saveBrand(true)
    if (!ok) return
    toast({
      title: 'Onboarding concluído!',
      description: 'Sua empresa está configurada. Bem-vindo ao painel.',
    })
    navigate('/')
  }

  const goStep = (n: number) => setStep(n)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Carregando onboarding...</p>
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-md">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Não foi possível carregar a empresa</h2>
          <p className="text-sm text-slate-500 mt-1">
            Tente atualizar a página ou entrar em contato com o suporte.
          </p>
        </div>
      </div>
    )
  }

  const brand = isValidBrandColor(brandDraft.color) ? brandDraft.color : DEFAULT_BRAND_COLOR
  const inviteName = brandDraft.tradeName || brandDraft.name || 'Sua empresa'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8 text-center">
          <Badge
            variant="outline"
            className="mb-3 text-[10px] uppercase tracking-wider border-sky-200 bg-sky-50 text-sky-700"
          >
            Configuração inicial
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight">Bem-vindo(a) ao ATS Inteligente PME</h1>
          <p className="text-sm text-slate-500 mt-1">
            Vamos configurar sua empresa em 4 passos rápidos. Você pode pular agora e retomar depois
            pelo painel.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = step === s.n
            const done = step > s.n
            return (
              <React.Fragment key={s.n}>
                <button
                  type="button"
                  onClick={() => s.n < step && goStep(s.n)}
                  className={`flex flex-col items-center gap-1.5 ${s.n < step ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition ${
                      done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : active
                          ? 'border-sky-600 text-sky-600 bg-white'
                          : 'border-slate-200 text-slate-400 bg-white'
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span
                    className={`text-[10px] font-medium ${active ? 'text-sky-700' : 'text-slate-500'}`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${step > s.n ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  />
                )}
              </React.Fragment>
            )
          })}
        </div>

        <div className="bg-white border rounded-xl shadow-sm p-6">
          {/* PASSO 1: Dados da empresa */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-sky-600" />
                  Dados da Empresa
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Estes dados alimentam a página pública de carreiras da sua empresa.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ob-name" className="text-xs font-semibold">
                    Nome da Empresa *
                  </Label>
                  <Input
                    id="ob-name"
                    className="mt-1 text-sm"
                    placeholder="Ex: Vanguard Soluções PME"
                    value={brandDraft.name}
                    onChange={(e) => setBrandDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="ob-trade" className="text-xs font-semibold">
                    Nome Fantasia
                  </Label>
                  <Input
                    id="ob-trade"
                    className="mt-1 text-sm"
                    placeholder="Ex: Vanguard Tecnologia"
                    value={brandDraft.tradeName}
                    onChange={(e) => setBrandDraft((d) => ({ ...d, tradeName: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Logo da Empresa</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border bg-slate-50 flex items-center justify-center overflow-hidden">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Prévia do logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Building2 className="w-7 h-7 text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 border border-sky-200 rounded-md px-3 py-1.5 hover:bg-sky-50 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        Enviar imagem
                      </span>
                    </label>
                    {logoPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover logo
                      </button>
                    )}
                    <span className="text-[10px] text-slate-400">
                      PNG, JPG, SVG ou WebP (máx. 5 MB)
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Cor de Marca</Label>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {BRAND_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Cor ${c}`}
                      onClick={() => setBrandDraft((d) => ({ ...d, color: c }))}
                      className={`w-8 h-8 rounded-full border-2 transition ${
                        brandDraft.color === c
                          ? 'border-slate-900 scale-110'
                          : 'border-white shadow'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={brand}
                    onChange={(e) => setBrandDraft((d) => ({ ...d, color: e.target.value }))}
                    className="w-8 h-8 rounded-full border-0 cursor-pointer bg-transparent"
                    aria-label="Cor personalizada"
                  />
                  <span className="text-xs text-slate-500 font-mono">{brandDraft.color}</span>
                </div>
              </div>

              <StepNav
                onNext={() => saveBrand(false).then((ok) => ok && goStep(2))}
                onSkip={handleSkip}
                nextDisabled={saving}
                nextLabel={saving ? 'Salvando...' : 'Continuar'}
              />
            </div>
          )}

          {/* PASSO 2: Página de carreiras */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Globe className="w-5 h-5 text-sky-600" />
                  Página de Carreiras
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prévia do link público onde os candidatos verão suas vagas — com a marca
                  configurada no passo anterior.
                </p>
              </div>

              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: `${brand}40` }}
              >
                <div
                  className="flex items-center gap-3 p-4 border-b bg-white"
                  style={{ borderBottomColor: `${brand}20` }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm overflow-hidden"
                    style={{ backgroundColor: brand }}
                  >
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      (inviteName || 'EM').substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{inviteName}</p>
                    <p className="text-[11px] text-slate-500">
                      Portal Oficial de Carreiras &amp; Vagas
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-slate-50">
                  <Label className="text-[11px] font-semibold text-slate-500">Link público</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white border rounded-md px-3 py-2 text-slate-700 truncate">
                      {careersUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => window.open(careersUrl, '_blank')}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      Abrir
                    </Button>
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-emerald-200 bg-emerald-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={careersConfirmed}
                  onChange={(e) => setCareersConfirmed(e.target.checked)}
                  className="mt-0.5 accent-emerald-600"
                />
                <span className="text-xs text-emerald-900">
                  Confirmo que revisei o link e a marca exibida na página de carreiras pública.
                </span>
              </label>

              <StepNav
                onBack={() => goStep(1)}
                onNext={() => goStep(3)}
                onSkip={handleSkip}
                nextDisabled={!careersConfirmed}
                nextLabel="Continuar"
              />
            </div>
          )}

          {/* PASSO 3: Convidar equipe */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-600" />
                  Convidar Equipe
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registre convites para o seu time. Cada convite fica visível no app até ser
                  aceito.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="E-mail do convidado (ex: joao@suaempresa.com.br)"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInvite())}
                  />
                </div>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                  <SelectTrigger className="w-full sm:w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="recruiter">Recrutador</SelectItem>
                    <SelectItem value="manager">Gestor Solicitante</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddInvite} className="bg-sky-600 hover:bg-sky-700">
                  Convidar
                </Button>
              </div>

              <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
                {invites.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    Nenhum convite registrado ainda.
                  </p>
                ) : (
                  invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{inv.email}</p>
                        <p className="text-[11px] text-slate-500">
                          {ROLE_LABELS[inv.role]} • convidado por{' '}
                          {inv.invited_by || 'Administrador'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="secondary"
                          className={
                            inv.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : inv.status === 'accepted'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                          }
                        >
                          {inv.status === 'pending'
                            ? 'Pendente'
                            : inv.status === 'accepted'
                              ? 'Aceito'
                              : 'Cancelado'}
                        </Badge>
                        {inv.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleCancelInvite(inv.id)}
                            className="text-slate-400 hover:text-rose-600"
                            aria-label="Cancelar convite"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <StepNav
                onBack={() => goStep(2)}
                onNext={() => goStep(4)}
                onSkip={handleSkip}
                nextLabel="Continuar"
              />
            </div>
          )}

          {/* PASSO 4: Conclusão */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <h2 className="text-lg font-bold">Tudo pronto!</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Resumo do que foi configurado neste onboarding.
                </p>
              </div>

              <div className="border rounded-lg divide-y text-sm">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-slate-500 text-xs">Empresa</span>
                  <span className="font-medium">{inviteName}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-slate-500 text-xs">Logo</span>
                  <span className="font-medium">{logoPreview ? 'Configurado' : 'Não enviado'}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-slate-500 text-xs">Cor de marca</span>
                  <span className="flex items-center gap-1.5 font-medium font-mono text-xs">
                    <span
                      className="w-3.5 h-3.5 rounded-full inline-block border"
                      style={{ backgroundColor: brand }}
                    />
                    {brand}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-slate-500 text-xs">Página de carreiras</span>
                  <a
                    href={careersUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-sky-600 hover:underline flex items-center gap-1"
                  >
                    Ver link público
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-slate-500 text-xs">Convites pendentes</span>
                  <span className="font-medium">
                    {invites.filter((i) => i.status === 'pending').length} convite(s)
                  </span>
                </div>
              </div>

              <StepNav
                onBack={() => goStep(3)}
                onNext={handleComplete}
                onSkip={handleSkip}
                nextDisabled={saving}
                nextLabel={saving ? 'Concluindo...' : 'Ir para o Painel'}
                nextIcon={<ArrowRight className="w-4 h-4 ml-1.5" />}
                skipLabel="Pular e ir ao painel"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StepNav({
  onBack,
  onNext,
  onSkip,
  nextDisabled,
  nextLabel,
  nextIcon,
  skipLabel,
}: {
  onBack?: () => void
  onNext: () => void
  onSkip?: () => void
  nextDisabled?: boolean
  nextLabel: string
  nextIcon?: React.ReactNode
  skipLabel?: string
}) {
  return (
    <div className="flex items-center justify-between pt-4 border-t">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="text-xs text-slate-600">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
        )}
        {onSkip && (
          <Button variant="ghost" size="sm" onClick={onSkip} className="text-xs text-slate-400">
            <SkipForward className="w-4 h-4 mr-1" />
            {skipLabel || 'Pular onboarding'}
          </Button>
        )}
      </div>
      <Button
        onClick={onNext}
        disabled={nextDisabled}
        className="bg-sky-600 hover:bg-sky-700 text-xs"
      >
        {nextLabel}
        {nextIcon}
      </Button>
    </div>
  )
}

export { OnboardingPage }
export default OnboardingPage
