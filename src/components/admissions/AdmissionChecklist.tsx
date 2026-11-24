import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  admissionsService,
  type Admission,
  type AdmissionChecklistItem,
} from '@/services/admissions'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react'

interface AdmissionChecklistProps {
  admission: Admission
  /** Recarrega os itens após mudanças (pai controla o estado). */
  onChange: () => void
  compact?: boolean
}

/**
 * Checklist admissional editável (itens padrão + extras), com concluído-por e
 * data em cada item. Usado no diálogo do Pipeline, na página Admissões e no
 * perfil do candidato contratado.
 */
export const AdmissionChecklist: React.FC<AdmissionChecklistProps> = ({
  admission,
  onChange,
  compact = false,
}) => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AdmissionChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [savingNew, setSavingNew] = useState(false)

  const loadItems = async () => {
    try {
      const rows = await admissionsService.listItems(admission.id)
      setItems(rows)
    } catch (err) {
      console.error('Erro ao carregar checklist admissional:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!admission.id) return
    setLoading(true)
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admission.id])

  const handleToggle = async (item: AdmissionChecklistItem) => {
    const next = !item.done
    // Otimista: reflete na tela antes da rede confirmar.
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: next } : i)))
    try {
      await admissionsService.setItemDone(item.id, next, user?.name)
      onChange()
      satisfies
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      toast({
        title: 'Erro ao atualizar item',
        description: Object.values(fieldErrors)[0] || 'Tente novamente.',
        variant: 'destructive',
      })
      loadItems()
    }
  }

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    setSavingNew(true)
    try {
      await admissionsService.addItem(admission.id, title, items.length + 1)
      setNewTitle('')
      await loadItems()
      onChange()
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      toast({
        title: 'Erro ao adicionar item',
        description: Object.values(fieldErrors)[0] || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingNew(false)
    }
  }

  const handleRemove = async (item: AdmissionChecklistItem) => {
    try {
      await admissionsService.removeItem(item.id)
      await loadItems()
      onChange()
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      toast({
        title: 'Erro ao remover item',
        description: Object.values(fieldErrors)[0] || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const doneCount = items.filter((i) => i.done).length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Checklist admissional ({doneCount}/{items.length})
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 py-2">Carregando checklist...</p>
      ) : (
        <ul className={compact ? 'space-y-1.5' : 'space-y-2'}>
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2 p-2 rounded-md border bg-slate-50/60 group"
            >
              <Checkbox
                checked={item.done}
                onCheckedChange={() => handleToggle(item)}
                className="mt-0.5"
                aria-label={`Marcar "${item.title}"`}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs leading-snug ${
                    item.done ? 'line-through text-slate-400' : 'text-slate-700'
                  }`}
                >
                  {item.title}
                </p>
                {item.done && (
                  <p className="text-[10px] text-emerald-700 mt-0.5 flex items-center gap-1">
                    <Circle className="w-1.5 h-1.5 fill-emerald-600" />
                    Concluído por {item.expand?.done_by?.name || item.done_by || 'usuário'}
                    {item.done_at ? ` em ${new Date(item.done_at).toLocaleString('pt-BR')}` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(item)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-rose-600 p-0.5"
                title="Remover item"
                aria-label={`Remover "${item.title}"`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-xs text-slate-400 py-2">Nenhum item no checklist.</li>
          )}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleAdd()
        }}
        className="flex gap-2 pt-1"
      >
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Adicionar item ao checklist..."
          className="h-8 text-xs bg-white"
          aria-label="Novo item do checklist"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={savingNew || !newTitle.trim()}
          className="h-8 text-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-0.5" />
          Adicionar
        </Button>
      </form>
    </div>
  )
}

export default AdmissionChecklist
