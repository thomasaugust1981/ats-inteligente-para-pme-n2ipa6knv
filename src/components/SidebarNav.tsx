// Lista de itens do menu lateral com drag-and-drop (ordem POR USUÁRIO).
// Arrastar e soltar reordena na hora (otimista) e salva em segundo plano em
// users.menu_order (migração 0035). "Restaurar ordem padrão" volta ao original.
// Preferências não aplicáveis (item sumiu/sem permissão) são ignoradas sem erro.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { GripVertical, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  applySavedOrder,
  defaultNavIdsFor,
  navIsActive,
  NAV_ITEMS,
  type NavId,
  type NavItem,
  type NavVisibilityContext,
} from '@/lib/navModel'

/** Contexto de visibilidade estendido com a licença do módulo Indicadores. */
type CtxWithLicense = NavVisibilityContext & { indicatorsLicensed?: boolean }
import {
  fetchIndicatorsLicensed,
  loadMenuOrder,
  logBundleVersion,
  menuOrderErrorMessage,
  saveMenuOrder,
} from '@/services/menuOrder'

interface SidebarNavProps {
  ctx: NavVisibilityContext
  /** Classe extra no wrapper (Layout desktop/mobile usam paddings diferentes). */
  className?: string
  /** Ação extra antes de navegar (fecha o drawer mobile). */
  onNavigate?: () => void
}

const navItemsById: Record<string, NavItem | undefined> = Object.fromEntries(
  NAV_ITEMS.map((n) => [n.id, n]),
)

export const SidebarNav: React.FC<SidebarNavProps> = ({ ctx, className, onNavigate }) => {
  const { toast } = useToast()
  const location = useLocation()
  // FAIL-OPEN: licença indefinida (não consultada) mantém o item visível; só
  // some quando o fetch confirmar false. Sem isso o item nunca aparece, pois o
  // ctx recebido do Layout nunca carrega indicatorsLicensed.
  const [licensed, setLicensed] = useState<boolean | undefined>(undefined)
  const [order, setOrder] = useState<NavId[]>([])
  const [draggingId, setDraggingId] = useState<NavId | null>(null)
  const [overId, setOverId] = useState<NavId | null>(null)
  const [isCustomized, setIsCustomized] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const dragIndexRef = useRef<number | null>(null)
  const licensedRef = useRef<boolean | undefined>(undefined)

  // ctx efetivo: papéis do Layout + licença resolvida (afeta ORDEM e RENDER).
  const effectiveCtx = useMemo<CtxWithLicense>(
    () => ({ ...ctx, indicatorsLicensed: licensed }),
    [ctx, licensed],
  )

  // Ordem padrão aplicada enquanto a preferência/licença não chegam.
  useEffect(() => {
    setOrder((current) => (current.length > 0 ? current : defaultNavIdsFor(effectiveCtx)))
  }, [effectiveCtx])

  // Itens que o usuário pode ver AGORA (licença de Indicadores entra no ctx).
  const items = useMemo<NavItem[]>(
    () =>
      order
        .map((id) => navItemsById[id])
        .filter((n): n is NavItem => !!n && n.visible(effectiveCtx)),
    [order, effectiveCtx],
  )

  // Recarrega a preferência do backend e aplica por cima do padrão.
  const reload = async () => {
    const [saved, licensedNow] = await Promise.all([loadMenuOrder(), fetchIndicatorsLicensed()])
    if (import.meta.env.DEV || licensedNow === false) {
      // Visível no console do usuário APENAS quando a licença realmente esconde
      // o item — o caso que estava invisível até agora. DEV sempre loga.
      console.info('[SidebarNav] licença Indicadores =', licensedNow)
    }
    licensedRef.current = licensedNow
    const nextCtx = { ...ctx, indicatorsLicensed: licensedNow } as CtxWithLicense
    setLicensed(licensedNow)
    const merged = applySavedOrder(saved, nextCtx)
    setOrder(merged)
    setIsCustomized(!!saved && saved.length > 0)
    return merged
  }

  // Carrega uma vez por usuário (ctx muda só com login/logout/troca de papel).
  useEffect(() => {
    let cancelled = false
    logBundleVersion()
    void (async () => {
      try {
        if (!cancelled) await reload()
      } catch (err) {
        // silencioso: cai no padrão já setado no useState inicial
        console.warn('[SidebarNav] reload falhou — menu fica na ordem padrão', err)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isAdmin, ctx.isRecruiter, ctx.isManager, ctx.isSuperadmin])

  /** Persistência otimista: a ordem já está na tela; salva em segundo plano. */
  const persist = async (next: NavId[]) => {
    setSaveFailed(false)
    try {
      await saveMenuOrder(next)
      setIsCustomized(true)
    } catch (err) {
      setSaveFailed(true)
      toast({
        variant: 'destructive',
        title: 'Não foi possível salvar a ordem do menu',
        description: menuOrderErrorMessage(err),
      })
      // Reverte na próxima navegação: relê a preferência do backend.
      void loadMenuOrder().then((saved) =>
        setOrder(
          applySavedOrder(saved, {
            ...ctx,
            indicatorsLicensed: licensedRef.current ?? true,
          } as CtxWithLicense),
        ),
      )
    }
  }

  const move = (from: number, to: number) => {
    if (from === to || to < 0) return
    setOrder((current) => {
      if (from >= current.length || to >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      void persist(next)
      return next
    })
  }

  const handleDropOn = (targetId: NavId) => {
    const from = dragIndexRef.current
    dragIndexRef.current = null
    setDraggingId(null)
    setOverId(null)
    if (from === null) return
    const to = items.findIndex((i) => i.id === targetId)
    if (to < 0 || from === to) return
    move(from, to)
  }

  const handleReset = () => {
    const def = defaultNavIdsFor(effectiveCtx)
    setOrder(def)
    setIsCustomized(false)
    setSaveFailed(false)
    void saveMenuOrder(def).catch(() => {
      setSaveFailed(true)
      toast({
        variant: 'destructive',
        title: 'Não foi possível salvar a ordem do menu',
        description: 'A ordem padrão aparece agora, mas não foi persistida.',
      })
    })
  }

  return (
    <ul className={cn('space-y-1', className)}>
      {items.map((item, index) => {
        const Icon = item.icon
        const active = navIsActive(item.path, location.pathname)
        const superadminTone = item.tone === 'superadmin'
        const isDragging = draggingId === item.id
        const isOver = overId === item.id && !isDragging
        return (
          <li
            key={item.id}
            draggable
            onDragStart={(e) => {
              dragIndexRef.current = index
              setDraggingId(item.id)
              e.dataTransfer.effectAllowed = 'move'
              try {
                e.dataTransfer.setData('text/plain', item.id)
              } catch (_) {
                /* legacy */
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setOverId(item.id)
            }}
            onDragLeave={() => setOverId((cur) => (cur === item.id ? null : cur))}
            onDrop={(e) => {
              e.preventDefault()
              handleDropOn(item.id)
            }}
            onDragEnd={() => {
              dragIndexRef.current = null
              setDraggingId(null)
              setOverId(null)
            }}
            className={cn(
              'group relative rounded-md transition-colors',
              isDragging && 'opacity-50',
              isOver && 'ring-1 ring-primary/50 bg-primary/5',
            )}
            aria-label={`Reordenar ${item.label}`}
          >
            <div className="flex items-center">
              <span
                aria-hidden
                className="absolute left-0.5 top-1/2 z-10 flex h-7 w-4 -translate-y-1/2 cursor-grab items-center justify-center rounded text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/60 active:cursor-grabbing"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </span>
              <NavLink
                to={item.path}
                onClick={onNavigate}
                className={cn(
                  'flex flex-1 items-center gap-3 rounded-md py-2.5 pl-6 pr-3 text-xs font-medium transition-colors',
                  active
                    ? superadminTone
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-sky-600 text-white shadow-xs'
                    : superadminTone
                      ? 'text-violet-300 hover:text-white hover:bg-slate-800/80'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80',
                  isDragging && 'pointer-events-none',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.id === 'agente-score' && (
                  <span
                    className={cn(
                      'ml-auto w-2 h-2 rounded-full',
                      ctx.agentEnabled ? 'bg-emerald-400' : 'bg-slate-600',
                    )}
                    title={ctx.agentEnabled ? 'Agente ativado' : 'Agente desativado'}
                  />
                )}
              </NavLink>
            </div>
          </li>
        )
      })}

      <li className="pt-2">
        <button
          type="button"
          onClick={handleReset}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            !isCustomized && 'invisible',
          )}
        >
          <RotateCcw className="h-3 w-3" />
          Restaurar ordem padrão
        </button>
        {saveFailed && (
          <p className="px-3 pt-1 text-[11px] text-amber-600">
            Ordem não salva — será revertida na próxima navegação.
          </p>
        )}
      </li>
    </ul>
  )
}

export default SidebarNav
