import React, { useEffect, useState } from 'react'
import { BarChart3, Lock, Building2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { getIndicatorsStatus, type IndicatorsStatus } from '@/services/modules'
import { getErrorMessage } from '@/lib/pocketbase/errors'

/** Os 6 indicadores que entram nos pacotes 2–4 — por enquanto, placeholders. */
const INDICATOR_CARDS: { title: string; description: string }[] = [
  {
    title: 'Time to Hire por área',
    description: 'Dias entre abertura e contratação, por área da estrutura.',
  },
  {
    title: 'Conversão entre etapas do funil',
    description: 'Percentual de avanço dos candidatos etapa a etapa do pipeline.',
  },
  {
    title: 'Taxa de aceite de proposta',
    description: 'Propostas aceitas sobre propostas enviadas.',
  },
  {
    title: 'Origem do candidato contratado',
    description: 'De onde vieram os candidatos efetivamente contratados.',
  },
  {
    title: 'Tempo de primeira resposta',
    description: 'Horas até o primeiro contato com o candidato.',
  },
  {
    title: 'Motivo de reprovação',
    description: 'Distribuição dos motivos de reprovação registrados no pipeline.',
  },
]

/**
 * /indicadores — módulo licenciado à parte. Este pacote entrega a fundação:
 * status de licença + esqueleto da página com 6 cards placeholder ("calculando…").
 * Os cálculos reais chegam nos pacotes 2–4.
 */
export const IndicadoresPage: React.FC = () => {
  const [status, setStatus] = useState<IndicatorsStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getIndicatorsStatus()
      .then((s) => {
        if (!cancelled) setStatus(s)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <LoadingState message="Consultando licença do módulo Indicadores..." />
  }

  if (error || !status) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <PageHeader status={null} />
        <EmptyState
          icon={Lock}
          title="Não foi possível verificar a licença"
          description={
            error ||
            'Não conseguimos consultar o status do módulo agora. Tente novamente mais tarde.'
          }
        />
      </div>
    )
  }

  if (!status.licensed) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <PageHeader status={status} />
        <EmptyState
          icon={Lock}
          title="Módulo Indicadores não licenciado"
          description="O módulo de Indicadores é licenciado à parte. Fale com o time comercial da plataforma para contratar — depois que a licença for liberada, os indicadores da sua operação de recrutamento aparecem aqui automaticamente."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader status={status} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INDICATOR_CARDS.map((card) => (
          <Card key={card.title} className="opacity-90">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 mb-3">{card.description}</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Calculando…
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/** Cabeçalho comum: título, subtítulo com a organização e selo de licença. */
const PageHeader: React.FC<{ status: IndicatorsStatus | null }> = ({ status }) => (
  <div className="flex items-center justify-between pb-2 border-b">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-sky-600" />
        Indicadores
      </h1>
      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
        <Building2 className="w-3.5 h-3.5" />
        {status?.org?.name || 'Sua organização'}
      </p>
    </div>
    {status?.licensed && (
      <Badge
        variant="outline"
        className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50"
      >
        Licenciado
      </Badge>
    )}
  </div>
)

export default IndicadoresPage
