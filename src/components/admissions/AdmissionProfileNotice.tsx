import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  admissionsService,
  ADMISSION_STATUS_LABELS,
  type Admission,
  type AdmissionStatus,
} from '@/services/admissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList } from 'lucide-react'

const STATUS_BADGE_CLASS: Record<AdmissionStatus, string> = {
  pendente: 'bg-slate-100 text-slate-700 border-slate-200',
  em_andamento: 'bg-amber-50 text-amber-800 border-amber-200',
  concluido: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

/**
 * Aviso no perfil do candidato contratado: indica que existe processo
 * admissional aberto (handoff para o DP) e leva à página de Admissões.
 * Some silenciosamente quando não há processo (fail-open).
 */
export const AdmissionProfileNotice: React.FC<{
  applicationId: string
  candidateName?: string
  jobTitle?: string
}> = ({ applicationId, candidateName, jobTitle }) => {
  const [admission, setAdmission] = useState<Admission | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!applicationId) return
    let cancelled = false
    admissionsService
      .findForApplication(applicationId)
      .then((found) => {
        if (!cancelled) {
          setAdmission(found)
          setChecked(true)
        }
      })
      .catch(() => {
        if (!cancelled) setChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [applicationId])

  if (!checked || !admission) return null

  const status = admission.status as AdmissionStatus

  return (
    <Card className="bg-emerald-50/60 border-emerald-200">
      <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <ClipboardList className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Processo admissional aberto{candidateName ? ` — ${candidateName}` : ''}
            </p>
            <p className="text-xs text-emerald-800/80 mt-0.5 flex items-center gap-2 flex-wrap">
              {jobTitle && <span>{jobTitle}</span>}
              <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE_CLASS[status]}`}>
                {ADMISSION_STATUS_LABELS[status]}
              </Badge>
              <span>Checklist do Departamento Pessoal — entregável: cadastro no Goldway ERP.</span>
            </p>
          </div>
        </div>
        <Link to="/admissoes" className="shrink-0">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Ver admissões
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

export default AdmissionProfileNotice
