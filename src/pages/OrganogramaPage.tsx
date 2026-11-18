/**
 * OrganogramaPage — módulo standalone de organograma organizacional, agora com
 * duas abas na querystring (/organograma?aba=resumo | ?aba=arvore):
 * - "Árvore" (padrão): o arquivo autocontido public/organograma.html em iframe
 *   ocupando a área útil inteira. A URL do backend (PocketBase) é passada via
 *   querystring (?api=...): o iframe é servido na origem do app (estático, sem
 *   proxy /api), e o HTML usa ?api para saber onde gravar os nós (org_nodes) e
 *   criar vagas.
 * - "Resumo": OrganogramaResumo, as três listas da ex-/estrutura.
 * A aba vive na URL para que links possam apontar direto para o resumo;
 * recarregar mantém a aba escolhida (querystring), e valor desconhecido cai
 * no padrão "Árvore" sem erro.
 */
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import OrganogramaResumo from '@/pages/OrganogramaResumo'

type OrganogramaTab = 'arvore' | 'resumo'

const TABS: { id: OrganogramaTab; label: string; icon: typeof GitBranch }[] = [
  { id: 'arvore', label: 'Árvore', icon: GitBranch },
  { id: 'resumo', label: 'Resumo', icon: Building2 },
]

const isTab = (v: string | null): v is OrganogramaTab => v === 'arvore' || v === 'resumo'

export default function OrganogramaPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('aba')
  const tab: OrganogramaTab = isTab(rawTab) ? rawTab : 'arvore'

  const setTab = useCallback(
    (next: OrganogramaTab) => {
      setSearchParams(next === 'arvore' ? {} : { aba: next }, { replace: true })
    },
    [setSearchParams],
  )

  const api = (import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/+$/, '')
  const src = api ? `/organograma.html?api=${encodeURIComponent(api)}` : '/organograma.html'

  return (
    <div className="w-full h-full -m-4 md:-m-8">
      <div className="flex items-center gap-1 px-4 pt-2 pb-0">
        <div
          className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5"
          role="tablist"
          aria-label="Modo de visualização do organograma"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'bg-sky-50 text-sky-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'arvore' ? (
        <iframe
          src={src}
          title="Organograma Organizacional"
          className="w-full border-0"
          style={{ height: 'calc(100vh - 84px)', minHeight: 'calc(100vh - 84px)' }}
        />
      ) : (
        <div className="px-4 py-2 overflow-y-auto" style={{ height: 'calc(100vh - 84px)' }}>
          <OrganogramaResumo />
        </div>
      )}
    </div>
  )
}
