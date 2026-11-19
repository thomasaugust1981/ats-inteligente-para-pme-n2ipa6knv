// Card de Requisições Pendentes do Painel (aprovador admin/recrutador).
// Mostra quantas requisições aguardam decisão ("Orçamento Aprovado?") e leva
// à fila em /requisicoes. Leitura via requisitionsService.listPending com
// withFreshToken e FAIL-OPEN: qualquer erro some com o card sem afetar o resto
// do Painel (mesma postura do fetchIndicatorsLicensed).
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { requisitionsService } from '@/services/requisitions'

const isApprover = (role?: string) => role === 'admin' || role === 'recruiter'

export const PendingRequisitionsCard: React.FC = () => {
  const { user } = useAuth()
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  const approver = isApprover(user?.role)

  useEffect(() => {
    if (!approver) return
    let cancelled = false
    requisitionsService
      .listPending()
      .then((list) => {
        if (!cancelled) setPendingCount(list.length)
      })
      .catch((err) => {
        // Fail-open: erro na leitura não pode quebrar o Painel.
        console.warn('[dashboard] falha ao carregar requisições pendentes:', err)
        if (!cancelled) setPendingCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [approver, user?.role])

  if (!approver || pendingCount == null || pendingCount === 0) return null

  return (
    <Link to="/requisicoes" className="block">
      <Card className="bg-white hover:border-sky-300 transition-colors cursor-pointer">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-sky-50 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4.5 h-4.5 text-sky-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {pendingCount}{' '}
                {pendingCount === 1
                  ? 'requisição aguardando aprovação'
                  : 'requisições aguardando aprovação'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                Gateway "Orçamento Aprovado?" — avalie as solicitações dos gestores.
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </CardContent>
      </Card>
    </Link>
  )
}

export default PendingRequisitionsCard
