import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/hooks/use-toast'
import {
  superadminService,
  slugify,
  SUPERADMIN_SEED_EMAIL,
  type OrganizationWithCounts,
} from '@/services/superadmin'
import { useAuth } from '@/hooks/use-auth'
import ChangeOwnPasswordDialog from '@/components/ChangeOwnPasswordDialog'

const SuperAdminPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [orgs, setOrgs] = useState<OrganizationWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Form: criar organização + admin
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Toggle ativo/inativo em andamento
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const isSeedSuperadmin = superadminService.isSuperadminSeed(user)
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)

  const loadOrganizations = useCallback(async () => {
    setLoading(true)
    try {
      const list = await superadminService.listOrganizations()
      setOrgs(list)
    } catch (err) {
      console.error('Erro ao carregar organizações:', err)
      toast({
        title: 'Erro ao carregar organizações',
        description: 'Verifique se você está autenticado como superadmin e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadOrganizations()
  }, [loadOrganizations])

  // Banner de senha padrão: só testa quando for o seed superadmin@ats.local
  useEffect(() => {
    if (!isSeedSuperadmin) return
    let cancelled = false
    superadminService.isUsingDefaultPassword().then((usingDefault) => {
      if (!cancelled) setNeedsPasswordChange(usingDefault)
    })
    return () => {
      cancelled = true
    }
  }, [isSeedSuperadmin])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orgs
    return orgs.filter((o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q))
  }, [orgs, search])

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  const handleSlugChange = (value: string) => {
    setSlugEdited(true)
    setSlug(value)
  }

  const resetForm = () => {
    setName('')
    setSlug('')
    setSlugEdited(false)
    setAdminName('')
    setAdminEmail('')
    setAdminPassword('')
    setFieldErrors({})
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!name.trim()) errors.name = 'Informe o nome da organização.'
    if (!slug.trim()) errors.slug = 'Informe o slug da organização.'
    if (!adminName.trim()) errors.admin_name = 'Informe o nome do administrador.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail.trim()))
      errors.admin_email = 'E-mail inválido.'
    if (adminPassword.length < 8)
      errors.admin_password = 'A senha inicial deve ter pelo menos 8 caracteres.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await superadminService.createOrganizationWithAdmin({
        name: name.trim(),
        slug: slug.trim(),
        admin_name: adminName.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
      })
      toast({
        title: 'Organização criada',
        description: `A organização "${name.trim()}" e o admin ${adminEmail.trim()} foram criados.`,
      })
      resetForm()
      setFormOpen(false)
      await loadOrganizations()
    } catch (err) {
      const error = err as Error & { field?: string }
      if (error.field) {
        setFieldErrors({ [error.field]: error.message })
      } else {
        toast({
          title: 'Erro ao criar organização',
          description: error.message || 'Tente novamente.',
          variant: 'destructive',
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (org: OrganizationWithCounts) => {
    setTogglingId(org.id)
    try {
      const next = !org.is_active
      await superadminService.setOrganizationActive(org.id, next)
      setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, is_active: next } : o)))
      toast({
        title: next ? 'Organização ativada' : 'Organização desativada',
        description: next
          ? 'Os usuários voltam a acessar os dados normalmente.'
          : 'Os usuários desta organização não conseguem mais acessar os dados.',
      })
    } catch (err) {
      console.error('Erro ao alterar status:', err)
      toast({
        title: 'Erro ao alterar status',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-sky-600" />
            Painel Superadmin
          </h1>
          <p className="text-sm text-slate-500">
            Gerencie as organizações (empresas clientes) da plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao painel
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={loadOrganizations} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
            <Plus className="w-4 h-4 mr-1" /> Nova organização
          </Button>
          {isSeedSuperadmin && (
            <Button
              size="sm"
              variant={needsPasswordChange ? 'destructive' : 'outline'}
              onClick={() => setPasswordDialogOpen(true)}
            >
              <ShieldCheck className="w-4 h-4 mr-1" /> Alterar minha senha
            </Button>
          )}
        </div>
      </div>

      {/* Banner urgente: senha padrão do seed */}
      {isSeedSuperadmin && needsPasswordChange && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex flex-col md:flex-row md:items-center gap-3 py-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-900">
                Segurança: você ainda usa a senha padrão do superadmin
              </p>
              <p className="text-amber-800">
                Troque a senha agora para proteger o acesso à administração da plataforma.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setPasswordDialogOpen(true)}
              className="shrink-0"
            >
              Trocar senha agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Formulário: criar organização + admin */}
      {formOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova organização</CardTitle>
            <CardDescription>
              Cria a organização e o primeiro usuário administrador do cliente em uma única etapa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="org-name">Nome da organização *</Label>
                  <Input
                    id="org-name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ex.: Acme Tecnologia"
                  />
                  {fieldErrors.name && <p className="text-xs text-rose-600">{fieldErrors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="org-slug">Slug *</Label>
                  <Input
                    id="org-slug"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="gerado a partir do nome"
                  />
                  <p className="text-[11px] text-slate-500">
                    Identificador único na URL (ex.: {slug || 'exemplo'}).
                  </p>
                  {fieldErrors.slug && <p className="text-xs text-rose-600">{fieldErrors.slug}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-name">Nome do administrador *</Label>
                  <Input
                    id="admin-name"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Ex.: Maria Souza"
                  />
                  {fieldErrors.admin_name && (
                    <p className="text-xs text-rose-600">{fieldErrors.admin_name}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-email">E-mail do administrador *</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="maria@acme.com.br"
                  />
                  {fieldErrors.admin_email && (
                    <p className="text-xs text-rose-600">{fieldErrors.admin_email}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-password">Senha inicial do admin *</Label>
                  <Input
                    id="admin-password"
                    type="text"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="mínimo 8 caracteres"
                  />
                  {fieldErrors.admin_password && (
                    <p className="text-xs text-rose-600">{fieldErrors.admin_password}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando…
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" /> Criar organização + admin
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou slug…"
          className="pl-9"
        />
      </div>

      {/* Tabela de organizações */}
      {loading ? (
        <LoadingState label="Carregando organizações…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma organização encontrada"
          description={
            search
              ? 'Nenhuma organização corresponde à busca.'
              : 'Crie a primeira organização cliente para começar.'
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-3 px-4 font-medium">Organização</th>
                    <th className="py-3 px-4 font-medium">Slug</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Empresas</th>
                    <th className="py-3 px-4 font-medium">Usuários</th>
                    <th className="py-3 px-4 font-medium">Criada em</th>
                    <th className="py-3 px-4 font-medium text-right">Ativa</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((org) => (
                    <tr key={org.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">{org.name}</td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                          {org.slug}
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        {org.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Ativa
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-rose-600 border-rose-200">
                            <XCircle className="w-3 h-3 mr-1" /> Inativa
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {org.companies_count}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {org.users_count}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {org.created ? new Date(org.created).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Switch
                          checked={!!org.is_active}
                          disabled={togglingId === org.id}
                          onCheckedChange={() => handleToggleActive(org)}
                          aria-label={`Ativar ou desativar ${org.name}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ChangeOwnPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onPasswordChanged={() => {
          setNeedsPasswordChange(false)
          toast({
            title: 'Senha alterada',
            description: 'Sua nova senha já está em uso.',
          })
        }}
      />
    </div>
  )
}

export default SuperAdminPage
