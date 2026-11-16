import React, { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Trash2,
  BookOpen,
  Wrench,
  HeartHandshake,
  AlertTriangle,
  FileDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { cargosService } from '@/services/cargos'
import type { Cargo } from '@/types/ats'
import {
  CHA_BLOCK_KEYS,
  CHA_BLOCK_META,
  CHA_LEVELS,
  CHA_LEVEL_LABELS,
  chaItem,
  emptyCha,
  invalidAttitudes,
  isObservableBehavior,
  type ChaBlockKey,
  type ChaData,
  type ChaItem,
  type ChaLevel,
} from '@/lib/cha'
import { salaryCoherenceAlerts, type SalaryAlert } from '@/lib/salaryCoherence'
import { exportCargoPdf } from '@/lib/chaExport'
import { SalaryHistorySection } from '@/components/cargos/SalaryHistorySection'

interface Props {
  open: boolean
  cargo: Cargo | null // null = criação
  onClose: () => void
  onSaved: () => void
  /** Demais cargos da org — base do alerta de coerência de faixa entre níveis. */
  allCargos?: Cargo[]
}

const BLOCK_ICONS: Record<ChaBlockKey, React.ElementType> = {
  conhecimentos: BookOpen,
  habilidades: Wrench,
  atitudes: HeartHandshake,
}

/** Editor de cargo com os três blocos CHA obrigatórios (FASE 1 do modelo CHA). */
export const CargoFormDialog: React.FC<Props> = ({
  open,
  cargo,
  onClose,
  onSaved,
  allCargos = [],
}) => {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [title, setTitle] = useState('')
  const [area, setArea] = useState('')
  const [level, setLevel] = useState<string>('pleno')
  const [mission, setMission] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMed, setSalaryMed] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [cha, setCha] = useState<ChaData>(emptyCha())
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (cargo) {
      setTitle(cargo.title)
      setArea(cargo.area || '')
      setLevel(cargo.level || 'pleno')
      setMission(cargo.mission || '')
      setSalaryMin(cargo.salary_min != null ? String(cargo.salary_min) : '')
      setSalaryMed(cargo.salary_med != null ? String(cargo.salary_med) : '')
      setSalaryMax(cargo.salary_max != null ? String(cargo.salary_max) : '')
      setCha({ ...emptyCha(), ...(cargo.cha || {}) })
    } else {
      setTitle('')
      setArea('')
      setLevel('pleno')
      setMission('')
      setSalaryMin('')
      setSalaryMed('')
      setSalaryMax('')
      setCha(emptyCha())
    }
  }, [open, cargo])

  const setBlock = (key: ChaBlockKey, items: ChaItem[]) =>
    setCha((prev) => ({ ...prev, [key]: { items } }))

  const addItem = (key: ChaBlockKey) => {
    setCha((prev) => ({
      ...prev,
      [key]: { items: [...(prev[key]?.items || []), chaItem()] },
    }))
  }

  const updateItem = (key: ChaBlockKey, idx: number, patch: Partial<ChaItem>) => {
    setCha((prev) => ({
      ...prev,
      [key]: {
        items: (prev[key]?.items || []).map((it, i) => (i === idx ? { ...it, ...patch } : it)),
      },
    }))
  }

  const removeItem = (key: ChaBlockKey, idx: number) => {
    setCha((prev) => ({
      ...prev,
      [key]: { items: (prev[key]?.items || []).filter((_, i) => i !== idx) },
    }))
  }

  // FASE 3 — alerta de coerência cargo/nível × faixa (aviso, não bloqueia).
  const numeric = (v: string) => (v.trim() && !isNaN(parseFloat(v)) ? parseFloat(v) : null)
  const salaryAlerts = useMemo(
    () =>
      open
        ? salaryCoherenceAlerts(
            { id: cargo?.id, title, area, level },
            { min: numeric(salaryMin), med: numeric(salaryMed), max: numeric(salaryMax) },
            allCargos,
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, cargo?.id, title, area, level, salaryMin, salaryMed, salaryMax, allCargos],
  )

  const handleExportPdf = () => {
    setExportingPdf(true)
    try {
      exportCargoPdf(
        {
          title: title.trim() || cargo?.title || 'Cargo',
          area: area.trim() || cargo?.area,
          level: level,
          levelLabel: CHA_LEVEL_LABELS[level as ChaLevel] || level,
          mission: mission.trim() || cargo?.mission,
          salaryMin: numeric(salaryMin) ?? cargo?.salary_min ?? null,
          salaryMed: numeric(salaryMed) ?? cargo?.salary_med ?? null,
          salaryMax: numeric(salaryMax) ?? cargo?.salary_max ?? null,
          cha: cha as unknown as Record<
            string,
            { items?: { description: string; required: boolean; weight: number }[] }
          >,
        },
        '',
      )
    } finally {
      setExportingPdf(false)
    }
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!title.trim()) next.title = 'Informe o título do cargo.'
    if (!mission.trim()) next.mission = 'Informe a missão do cargo (1 parágrafo).'
    for (const key of CHA_BLOCK_KEYS) {
      const items = cha[key]?.items || []
      if (items.length === 0) {
        next[key] = 'O bloco precisa de pelo menos 1 requisito.'
        continue
      }
      const badAtt = invalidAttitudes({ items })
      if (key === 'atitudes' && badAtt.length > 0) {
        next[key] =
          'Descreva comportamentos observáveis — em vez de "proativo", "identifica e reporta desvios de processo sem supervisão".'
      }
      for (const it of items) {
        if (!it.description.trim()) {
          next[key] = 'Todos os requisitos precisam de descrição.'
          break
        }
        if (!Number.isFinite(it.weight) || it.weight < 1 || it.weight > 5) {
          next[key] = 'O peso de cada requisito deve ser de 1 a 5.'
          break
        }
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      setSaving(true)
      const payload: Partial<Cargo> = {
        title: title.trim(),
        area: area.trim(),
        level: level as Cargo['level'],
        mission: mission.trim(),
        salary_min: numeric(salaryMin),
        salary_med: numeric(salaryMed),
        salary_max: numeric(salaryMax),
        cha: cha as unknown as Record<string, unknown>,
      }
      if (cargo) {
        await cargosService.update(cargo.id, payload)
      } else {
        await cargosService.create(payload)
      }
      toast({ title: cargo ? 'Cargo atualizado!' : 'Cargo cadastrado!', description: title.trim() })
      onSaved()
    } catch (err) {
      console.error('Erro ao salvar cargo:', err)
      toast({
        title: 'Erro ao salvar cargo',
        description: 'Verifique os campos e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cargo ? 'Editar Cargo' : 'Novo Cargo'}</DialogTitle>
          <DialogDescription>
            Defina a missão, a faixa salarial e os três blocos CHA — as vagas vinculadas a este
            cargo herdam automaticamente esses requisitos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Identificação */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="cargo-title">Título *</Label>
              <Input
                id="cargo-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Analista de Vendas"
              />
              {errors.title && <p className="text-xs text-rose-600">{errors.title}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cargo-area">Área</Label>
              <Input
                id="cargo-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Ex.: Comercial"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nível *</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o nível" />
                </SelectTrigger>
                <SelectContent>
                  {CHA_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {CHA_LEVEL_LABELS[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cargo-mission">Missão do cargo *</Label>
              <Textarea
                id="cargo-mission"
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                rows={2}
                placeholder="1 parágrafo: por que este cargo existe e o que dele se espera."
              />
              {errors.mission && <p className="text-xs text-rose-600">{errors.mission}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cargo-smin">Faixa salarial — mínimo (R$)</Label>
              <Input
                id="cargo-smin"
                type="number"
                min="0"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cargo-smed">Médio (R$)</Label>
              <Input
                id="cargo-smed"
                type="number"
                min="0"
                value={salaryMed}
                onChange={(e) => setSalaryMed(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cargo-smax">Máximo (R$)</Label>
              <Input
                id="cargo-smax"
                type="number"
                min="0"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
              />
            </div>
          </div>

          {/* FASE 3 — alerta de coerência faixa × nível (aviso, não bloqueia) */}
          {salaryAlerts.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Faixa salarial possivelmente incoerente com o nível
              </p>
              <ul className="list-disc pl-5 space-y-0.5">
                {salaryAlerts.map((a, i) => (
                  <li key={i} className="text-[11px] text-amber-800">
                    {a.message}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-700">
                Aviso apenas — você ainda pode salvar o cargo assim.
              </p>
            </div>
          )}

          {/* Blocos CHA */}
          {CHA_BLOCK_KEYS.map((key) => {
            const Icon = BLOCK_ICONS[key]
            const items = cha[key]?.items || []
            const badIdx = key === 'atitudes' ? invalidAttitudes({ items }) : []
            return (
              <div key={key} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-sky-600" />
                    <span className="text-sm font-semibold text-slate-900">
                      {CHA_BLOCK_META[key].label} *
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => addItem(key)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">{CHA_BLOCK_META[key].hint}</p>
                {key === 'atitudes' && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />
                    Não aceite adjetivo isolado: descreva o comportamento observável. Ex.: em vez de
                    “proativo”, “identifica e reporta desvios de processo sem supervisão”.
                  </p>
                )}
                {errors[key] && <p className="text-xs text-rose-600">{errors[key]}</p>}
                {items.length === 0 && (
                  <p className="text-xs text-slate-400 italic">
                    Nenhum requisito — clique em “Adicionar”.
                  </p>
                )}
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div
                      key={it.id || idx}
                      className={`grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-start rounded-md p-2 ${
                        badIdx.includes(idx) ? 'bg-rose-50 border border-rose-200' : 'bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <Input
                          value={it.description}
                          onChange={(e) => updateItem(key, idx, { description: e.target.value })}
                          placeholder={
                            key === 'atitudes'
                              ? 'Comportamento observável…'
                              : CHA_BLOCK_META[key].hint
                          }
                        />
                        {badIdx.includes(idx) && (
                          <p className="text-[11px] text-rose-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Parece um adjetivo isolado — descreva o comportamento com verbo de ação.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <Switch
                          checked={it.required}
                          onCheckedChange={(v) => updateItem(key, idx, { required: v })}
                          aria-label="Obrigatório"
                        />
                        <span className="text-[11px] text-slate-500 whitespace-nowrap">
                          {it.required ? 'Obrigatório' : 'Desejável'}
                        </span>
                      </div>
                      <Select
                        value={String(it.weight)}
                        onValueChange={(v) => updateItem(key, idx, { weight: Number(v) })}
                      >
                        <SelectTrigger className="w-28 h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((w) => (
                            <SelectItem key={w} value={String(w)}>
                              Peso {w}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-rose-600"
                        onClick={() => removeItem(key, idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* FASE 3 — histórico de alteração de faixa (somente leitura) */}
        <SalaryHistorySection cargoId={cargo?.id || null} />

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportPdf}
            disabled={exportingPdf || !title.trim()}
            title="Gera a descrição do cargo em PDF (impressão → Salvar como PDF)"
          >
            <FileDown className="w-4 h-4 mr-1.5" />
            Exportar PDF
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            {saving ? 'Salvando...' : cargo ? 'Salvar Alterações' : 'Cadastrar Cargo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
