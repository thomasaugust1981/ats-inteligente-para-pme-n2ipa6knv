import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Search,
  BriefcaseBusiness,
  Pencil,
  Trash2,
  BookOpen,
  Wrench,
  HeartHandshake,
  Building2,
  GraduationCap,
  FileDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { cargosService } from '@/services/cargos'
import { exportCargoPdf } from '@/lib/chaExport'
import type { Cargo } from '@/types/ats'
import {
  CHA_BLOCK_KEYS,
  CHA_BLOCK_META,
  CHA_LEVEL_LABELS,
  CHA_LEVELS,
  type ChaBlockKey,
  type ChaLevel,
} from '@/lib/cha'
import { CargoFormDialog } from '@/components/cargos/CargoFormDialog'

const BLOCK_ICONS: Record<ChaBlockKey, React.ElementType> = {
  conhecimentos: BookOpen,
  habilidades: Wrench,
  atitudes: HeartHandshake,
}

export const CargosPage: React.FC = () => {
  const { toast } = useToast()
  const { isAdmin, isRecruiter, isSuperadmin } = useAuth()
  const canEdit = isAdmin || isSuperadmin || isRecruiter

  const [cargos, setCargos] = useState<Cargo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Cargo | null>(null)
  const [deleting, setDeleting] = useState<Cargo | null>(null)

  const load = React.useCallback(async () => {
    try {
      setLoading(true)
      setCargos(await cargosService.listCargos())
    } catch (err) {
      console.error('Erro ao carregar cargos:', err)
      toast({ title: 'Erro ao carregar cargos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const areas = useMemo(
    () => Array.from(new Set(cargos.map((c) => (c.area || '').trim()).filter(Boolean))).sort(),
    [cargos],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cargos.filter((c) => {
      if (areaFilter !== 'all' && (c.area || '') !== areaFilter) return false
      if (levelFilter !== 'all' && (c.level || '') !== levelFilter) return false
      if (!q) return true
      return (
        c.title.toLowerCase().includes(q) ||
        (c.area || '').toLowerCase().includes(q) ||
        (c.mission || '').toLowerCase().includes(q)
      )
    })
  }, [cargos, search, areaFilter, levelFilter])

  const countRequired = (cargo: Cargo, key: ChaBlockKey) => (cargo.cha?.[key]?.items || []).length

  // FASE 3 — PDF da descrição do cargo direto da lista.
  const handleExportPdf = (cargo: Cargo) => {
    exportCargoPdf(
      {
        title: cargo.title,
        area: cargo.area,
        level: cargo.level,
        levelLabel: cargo.level ? CHA_LEVEL_LABELS[cargo.level as ChaLevel] || cargo.level : '',
        mission: cargo.mission,
        salaryMin: cargo.salary_min ?? null,
        salaryMed: cargo.salary_med ?? null,
        salaryMax: cargo.salary_max ?? null,
        cha: (cargo.cha || {}) as Record<
          string,
          { items?: { description: string; required: boolean; weight: number }[] }
        >,
      },
      '',
    )
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await cargosService.delete(deleting.id)
      toast({ title: 'Cargo excluído', description: deleting.title })
      setDeleting(null)
      load()
    } catch (err) {
      console.error('Erro ao excluir cargo:', err)
      toast({
        title: 'Erro ao excluir',
        description: 'Verifique se não há vagas vinculadas a este cargo.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-3">
          <BriefcaseBusiness className="w-6 h-6 text-sky-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cargos</h1>
            <p className="text-xs text-slate-500">
              Catálogo da organização com os requisitos CHA (Conhecimento, Habilidade e Atitude) de
              cada função — a base usada pelas vagas.
            </p>
          </div>
        </div>
        {canEdit && (
          <Button
            className="bg-sky-600 hover:bg-sky-700 text-white"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Cargo
          </Button>
        )}
      </div>

      {/* Busca + filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, área ou missão…"
            className="pl-9"
          />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            {CHA_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {CHA_LEVEL_LABELS[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingState message="Carregando cargos…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title={cargos.length === 0 ? 'Nenhum cargo cadastrado' : 'Nenhum cargo encontrado'}
          description={
            cargos.length === 0
              ? 'Cadastre o primeiro cargo com os blocos CHA — as vagas vão herdar esses requisitos.'
              : 'Ajuste a busca ou os filtros para encontrar o cargo.'
          }
          actions={
            canEdit && cargos.length === 0
              ? [
                  {
                    label: 'Cadastrar cargo',
                    onClick: () => {
                      setEditing(null)
                      setFormOpen(true)
                    },
                  },
                ]
              : []
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((cargo) => (
            <Card key={cargo.id} className="bg-white">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{cargo.title}</h3>
                      {cargo.level && (
                        <Badge variant="outline" className="text-[10px]">
                          {CHA_LEVEL_LABELS[cargo.level as ChaLevel] || cargo.level}
                        </Badge>
                      )}
                      {cargo.area && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Building2 className="w-3 h-3" />
                          {cargo.area}
                        </Badge>
                      )}
                    </div>
                    {cargo.mission && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{cargo.mission}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {CHA_BLOCK_KEYS.map((key) => {
                        const Icon = BLOCK_ICONS[key]
                        const n = countRequired(cargo, key)
                        return (
                          <Badge
                            key={key}
                            variant="outline"
                            className={`text-[10px] gap-1 ${n === 0 ? 'text-rose-600 border-rose-300' : 'text-slate-600'}`}
                          >
                            <Icon className="w-3 h-3" />
                            {CHA_BLOCK_META[key].label}: {n}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Exportar descrição do cargo em PDF"
                      onClick={() => handleExportPdf(cargo)}
                    >
                      <FileDown className="w-4 h-4" />
                    </Button>
                    {canEdit && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditing(cargo)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-600 hover:text-rose-700"
                          onClick={() => setDeleting(cargo)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!canEdit && cargos.length > 0 && (
        <p className="text-xs text-slate-500 text-center">
          Você tem acesso de leitura aos cargos da organização — apenas administradores podem
          editá-los.
        </p>
      )}

      <CargoFormDialog
        open={formOpen}
        cargo={editing}
        allCargos={cargos}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          load()
        }}
      />

      <Dialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cargo</DialogTitle>
            <DialogDescription>
              Excluir “{deleting?.title}”? Vagas vinculadas continuam com os requisitos já herdados,
              mas novas vagas não poderão mais selecionar este cargo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CargosPage
