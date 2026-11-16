// Gestão de empresas da organização (multi-empresa): listar, criar matriz
// ou filial, editar e excluir (com aviso de vagas/candidaturas vinculadas).
import React, { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  Plus,
  Network,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  MapPin,
  Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/hooks/use-auth'
import {
  companiesService,
  type CompanyFormPayload,
  type CompanyNode,
  type CompanyUsage,
} from '@/services/companies'
import { useActiveCompany } from '@/hooks/use-active-company'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface CompanyFormState {
  id?: string
  name: string
  trade_name: string
  company_type: 'matriz' | 'filial'
  parent_id: string
  city: string
  state: string
  website: string
  logo: File | null
  is_active: boolean
}

const EMPTY_FORM: CompanyFormState = {
  name: '',
  trade_name: '',
  company_type: 'filial',
  parent_id: '',
  city: '',
  state: '',
  website: '',
  logo: null,
  is_active: true,
}

export const EmpresasPage: React.FC = () => {
  const { isAdmin, isSuperadmin } = useAuth()
  const { activeCompanyId, setActiveCompany, refreshCompanies } = useActiveCompany()
  const { toast } = useToast()
  const [companies, setCompanies] = useState<CompanyNode[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<CompanyFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CompanyNode | null>(null)
  const [deleteUsage, setDeleteUsage] = useState<CompanyUsage | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)

  const canManage = isAdmin || isSuperadmin

  const load = useCallback(async () => {
    setLoading(true)
    await refreshCompanies()
    setCompanies(await companiesService.listMyCompanies())
    setLoading(false)
  }, [refreshCompanies])

  useEffect(() => {
    void load()
  }, [load])

  const matrizList = companies.filter((c) => c.company_type !== 'filial')

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, company_type: matrizList.length > 0 ? 'filial' : 'matriz' })
    setFormOpen(true)
  }

  const openEdit = (c: CompanyNode) => {
    setForm({
      id: c.id,
      name: c.name || '',
      trade_name: c.trade_name || '',
      company_type: c.company_type === 'filial' ? 'filial' : 'matriz',
      parent_id: c.parent_id || '',
      city: c.city || '',
      state: c.state || '',
      website: c.website || '',
      logo: null,
      is_active: c.is_active !== false,
    })
    setFormOpen(true)
  }

  const openDelete = async (c: CompanyNode) => {
    setDeleteTarget(c)
    setUsageLoading(true)
    try {
      setDeleteUsage(await companiesService.getUsage(c.id))
    } finally {
      setUsageLoading(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome da empresa.',
        variant: 'destructive',
      })
      return
    }
    if (form.company_type === 'filial' && !form.parent_id) {
      toast({
        title: 'Matriz obrigatória',
        description: 'Uma filial precisa estar vinculada a uma matriz.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const payload: CompanyFormPayload = {
        name: form.name.trim(),
        trade_name: form.trade_name.trim() || undefined,
        company_type: form.company_type,
        parent_id: form.company_type === 'filial' ? form.parent_id : null,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        website: form.website.trim() || undefined,
        logo: form.logo,
        is_active: form.is_active,
      }
      if (form.id) {
        await companiesService.update(form.id, payload)
        toast({ title: 'Empresa atualizada com sucesso' })
      } else {
        const created = await companiesService.create(payload)
        setActiveCompany(created.id)
        toast({
          title: 'Empresa criada com sucesso',
          description: 'Ela já está disponível no seletor do topo.',
        })
      }
      setFormOpen(false)
      await load()
    } catch (err) {
      toast({
        title: form.id ? 'Erro ao atualizar empresa' : 'Erro ao criar empresa',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await companiesService.delete(deleteTarget.id)
      toast({ title: 'Empresa excluída', description: `${deleteTarget.name} foi removida.` })
      setDeleteTarget(null)
      setDeleteUsage(null)
      await load()
    } catch (err) {
      toast({
        title: 'Não foi possível excluir',
        description:
          'A empresa pode ter registros vinculados (vagas, candidaturas ou configurações). ' +
          'Desative-a em vez de excluir.',
        variant: 'destructive',
      })
      console.error('Erro ao excluir empresa:', getErrorMessage(err))
    }
  }

  const parentName = (c: CompanyNode) => c.expand?.parent_id?.name || null
  const typeBadge = (c: CompanyNode) =>
    c.company_type === 'filial' ? (
      <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600">
        Filial
      </Badge>
    ) : (
      <Badge className="text-[10px] bg-sky-600">Matriz</Badge>
    )

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Empresas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Matriz e filiais da sua organização. A empresa ativa filtra as vagas, candidatos e o
            pipeline.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Nova empresa
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState message="Carregando empresas..." />
      ) : companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa ainda"
          description="Crie a matriz da sua organização para começar a publicar vagas."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border p-4 bg-white transition ${
                c.id === activeCompanyId
                  ? 'border-sky-400 ring-1 ring-sky-200'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
                    {c.logo ? (
                      <img
                        src={c.logo}
                        alt={c.name}
                        className="w-full h-full rounded-lg object-cover"
                      />
                    ) : (
                      <Building2 className="w-5 h-5 text-sky-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 truncate">{c.name}</h3>
                      {typeBadge(c)}
                      {c.id === activeCompanyId && (
                        <Badge className="text-[10px] bg-emerald-600">Ativa</Badge>
                      )}
                      {c.is_active === false && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-300 text-amber-700"
                        >
                          Inativa
                        </Badge>
                      )}
                    </div>
                    {c.trade_name && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{c.trade_name}</p>
                    )}
                    {parentName(c) && (
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Network className="w-3 h-3" />
                        Filial de {parentName(c)}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                      {(c.city || c.state) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {[c.city, c.state].filter(Boolean).join(' / ')}
                        </span>
                      )}
                      {c.website && (
                        <span className="flex items-center gap-1 truncate">
                          <Globe className="w-3 h-3" />
                          {c.website.replace(/^https?:\/\//, '')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                {c.id !== activeCompanyId && (
                  <Button size="sm" variant="outline" onClick={() => setActiveCompany(c.id)}>
                    Tornar ativa
                  </Button>
                )}
                {canManage && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Editar
                    </Button>
                    {c.company_type === 'filial' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => void openDelete(c)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Excluir
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de criar/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
            <DialogDescription>
              {form.id
                ? 'Atualize os dados da empresa da sua organização.'
                : 'Crie uma matriz (se for a primeira) ou uma filial vinculada a uma matriz.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="company-name">Nome *</Label>
              <Input
                id="company-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Vanguard Filial Sul"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-trade">Nome fantasia</Label>
              <Input
                id="company-trade"
                value={form.trade_name}
                onChange={(e) => setForm((f) => ({ ...f, trade_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.company_type}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      company_type: v === 'filial' ? 'filial' : 'matriz',
                      parent_id: v === 'filial' ? f.parent_id : '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matriz">Matriz</SelectItem>
                    <SelectItem value="filial">Filial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Matriz (quando filial)</Label>
                <Select
                  value={form.parent_id || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, parent_id: v }))}
                  disabled={form.company_type !== 'filial'}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        form.company_type === 'filial' ? 'Selecione a matriz' : 'Só para filiais'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {matrizList
                      .filter((m) => m.id !== form.id)
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="company-city">Cidade</Label>
                <Input
                  id="company-city"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company-state">Estado</Label>
                <Input
                  id="company-state"
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-website">Website</Label>
              <Input
                id="company-website"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-logo">Logo</Label>
              <Input
                id="company-logo"
                type="file"
                accept="image/*"
                onChange={(e) => setForm((f) => ({ ...f, logo: e.target.files?.[0] || null }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <Label htmlFor="company-active">Empresa ativa</Label>
                <p className="text-xs text-slate-500">
                  Empresas inativas continuam listadas, mas não devem receber novas vagas.
                </p>
              </div>
              <Switch
                id="company-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {form.id ? 'Salvar alterações' : 'Criar empresa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão (bloqueada quando há vínculos) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {usageLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando vínculos...
                </span>
              ) : deleteUsage && (deleteUsage.jobs > 0 || deleteUsage.applications > 0) ? (
                <span className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  Esta empresa possui {deleteUsage.jobs} vaga(s) e {deleteUsage.applications}{' '}
                  candidatura(s) vinculadas. A exclusão não é recomendada — prefira desativá-la.
                </span>
              ) : (
                'Esta ação não pode ser desfeita. A empresa será removida da organização.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={usageLoading}
            >
              Excluir mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default EmpresasPage
