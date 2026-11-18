import React, { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useActiveCompany } from '@/hooks/use-active-company'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Map, Plus, Trash2, Loader2, CheckCircle2 } from 'lucide-react'
import { roadmapService, sortRoadmapItems, type RoadmapItem } from '@/services/roadmap'
import { isDemoUserEmail } from '@/lib/demoCredentials'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'

const roadmapSchema = z.object({
  title: z.string().trim().min(2, 'Informe o título da tarefa'),
  description: z.string().trim().max(1000, 'Máximo de 1000 caracteres').optional(),
})

type RoadmapFormValues = z.infer<typeof roadmapSchema>

/**
 * Card "Roadmap do Talent" — Painel.
 *
 * Visível SOMENTE para usuários com papel 'admin' (guard de render abaixo):
 * recrutador e gestor nunca montam o componente, e os dados em si ficam atrás
 * da regra de coleção (admins da própria org — migração 0041), então nem via
 * URL direta a API devolve algo a não-admins.
 *
 * O usuário de DEMONSTRAÇÃO comercial (demo@ausland.com.br, papel admin) TAMBÉM
 * não vê o card: visitantes externos durante uma demo não devem enxergar as
 * tasks internas do roadmap — nem o card, nem qualquer chamada à API.
 *
 * Degrada em silêncio: qualquer falha de carregamento/escrita apenas loga no
 * console — o Painel nunca quebra por causa deste card.
 */
export const DashboardRoadmapCard: React.FC = () => {
  const { user, isAdmin } = useAuth()
  const { activeCompanyId, companyVersion } = useActiveCompany()
  const isDemoUser = isDemoUserEmail(user?.email)
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [pendingDoneId, setPendingDoneId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const form = useForm<RoadmapFormValues>({
    resolver: zodResolver(roadmapSchema),
    defaultValues: { title: '', description: '' },
  })

  const loadItems = useCallback(async () => {
    if (!pb.authStore.isValid || !isAdmin || !activeCompanyId || isDemoUser) {
      setLoading(false)
      setLoaded(true)
      return
    }
    setLoading(true)
    try {
      const list = await roadmapService.list(activeCompanyId)
      setItems(list)
    } catch (err) {
      console.error('[roadmap] falha ao carregar itens', err)
      setItems([])
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [isAdmin, activeCompanyId, isDemoUser])

  useEffect(() => {
    loadItems()
  }, [loadItems, companyVersion])

  if (!isAdmin || isDemoUser) return null

  const addItem = form.handleSubmit(async (values) => {
    if (!activeCompanyId) return
    try {
      const created = await roadmapService.create({
        org_id: activeCompanyId,
        title: values.title,
        description: values.description || undefined,
        created_by: user?.id,
      })
      setItems((prev) => sortRoadmapItems([...prev, created]))
      form.reset({ title: '', description: '' })
    } catch (err) {
      console.error('[roadmap] falha ao adicionar item', err)
    }
  })

  const toggleDone = async (item: RoadmapItem) => {
    setPendingDoneId(item.id)
    try {
      const updated = await roadmapService.setDone(item.id, !item.done)
      setItems((prev) => sortRoadmapItems(prev.map((i) => (i.id === updated.id ? updated : i))))
    } catch (err) {
      console.error('[roadmap] falha ao atualizar item', err)
    } finally {
      setPendingDoneId(null)
    }
  }

  const removeItem = async (item: RoadmapItem) => {
    setPendingDeleteId(item.id)
    try {
      await roadmapService.remove(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err) {
      console.error('[roadmap] falha ao remover item', err)
    } finally {
      setPendingDeleteId(null)
    }
  }

  const pending = items.filter((i) => !i.done)
  const completed = items.filter((i) => i.done)

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Map className="w-4 h-4 text-sky-600" />
            Roadmap do Talent
          </CardTitle>
          <CardDescription className="text-xs">
            Próximas tarefas e funcionalidades que você quer adicionar à ferramenta — visível apenas
            para administradores.
          </CardDescription>
        </div>
        <span className="text-xs text-slate-400 shrink-0">
          {completed.length}/{items.length} concluídas
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={addItem} className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        placeholder="Ex.: Integrar com o Goldway (ERP)"
                        className="h-9 text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                size="sm"
                className="bg-sky-600 hover:bg-sky-700 shrink-0"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-1.5" />
                )}
                Adicionar
              </Button>
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Descrição opcional (contexto, prioridade…)"
                      className="h-8 text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </form>
        </Form>

        {loading && !loaded ? (
          <div className="space-y-2 pt-1">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-600">Nenhuma tarefa no roadmap ainda</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Adicione a primeira ideia de funcionalidade acima — ela fica registrada aqui para
              guiar as próximas evoluções do Talent.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {pending.map((item) => (
                  <li key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                    <label className="flex items-start gap-2.5 cursor-pointer group min-w-0">
                      <Checkbox
                        checked={false}
                        disabled={pendingDoneId === item.id}
                        onCheckedChange={() => toggleDone(item)}
                        className="mt-0.5"
                        aria-label={`Marcar "${item.title}" como concluída`}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900 group-hover:text-sky-700 break-words">
                          {item.title}
                        </span>
                        {item.description && (
                          <span className="block text-xs text-slate-500 mt-0.5 break-words">
                            {item.description}
                          </span>
                        )}
                      </span>
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-slate-300 hover:text-red-600 hover:bg-red-50"
                      onClick={() => removeItem(item)}
                      disabled={pendingDeleteId === item.id}
                      aria-label={`Remover "${item.title}"`}
                    >
                      {pendingDeleteId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {completed.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Concluídas ({completed.length})
                </p>
                <ul className="divide-y divide-slate-100">
                  {completed.map((item) => (
                    <li
                      key={item.id}
                      className="py-2.5 flex items-start justify-between gap-3 opacity-70"
                    >
                      <label className="flex items-start gap-2.5 cursor-pointer group min-w-0">
                        <Checkbox
                          checked
                          disabled={pendingDoneId === item.id}
                          onCheckedChange={() => toggleDone(item)}
                          className="mt-0.5"
                          aria-label={`Reabrir "${item.title}"`}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-400 line-through break-words">
                            {item.title}
                          </span>
                          {item.description && (
                            <span className="block text-xs text-slate-400 line-through break-words">
                              {item.description}
                            </span>
                          )}
                        </span>
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-slate-300 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeItem(item)}
                        disabled={pendingDeleteId === item.id}
                        aria-label={`Remover "${item.title}"`}
                      >
                        {pendingDeleteId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {items.length > 0 && completed.length === 0 && pending.length === 0 && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Tudo em ordem.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
