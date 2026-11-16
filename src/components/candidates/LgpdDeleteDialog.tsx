import React, { useEffect, useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

interface LgpdDeleteDialogProps {
  open: boolean
  candidateName: string
  hasResume?: boolean
  applicationsCount?: number
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

/**
 * Diálogo de Exclusão LGPD (Grupo 3 da auditoria de segurança).
 * Lista TUDO que será apagado/anonimizado e exige confirmação dupla:
 * digitar EXCLUIR + marcar a caixa de confirmação LGPD.
 * Usado no perfil do candidato e na lista (padroniza a confirmação — item M2).
 */
const LgpdDeleteDialog: React.FC<LgpdDeleteDialogProps> = ({
  open,
  candidateName,
  hasResume = false,
  applicationsCount = 0,
  onOpenChange,
  onConfirm,
}) => {
  const [confirmText, setConfirmText] = useState('')
  const [lgpdChecked, setLgpdChecked] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      setConfirmText('')
      setLgpdChecked(false)
      setDeleting(false)
    }
  }, [open])

  const canConfirm = confirmText.trim().toUpperCase() === 'EXCLUIR' && lgpdChecked && !deleting

  const handleConfirm = async () => {
    if (!canConfirm) return
    setDeleting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir definitivamente {candidateName}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Esta ação elimina de forma <strong>permanente e irreversível</strong> os dados desta
                pessoa, conforme o direito do titular na LGPD. Não há como desfazer.
              </p>
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-900">
                <p className="font-semibold mb-1.5 text-xs uppercase tracking-wide">
                  Será apagado do banco:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>
                    Candidaturas (cadastradas:{' '}
                    {applicationsCount > 0 ? applicationsCount : 'nenhuma'})
                  </li>
                  <li>Scores de IA e seus snapshots</li>
                  <li>Resultados do teste DISC</li>
                  <li>Fichas de avaliação CHA</li>
                  <li>
                    {hasResume ? 'Arquivo do currículo (PDF)' : 'Dados estruturados do currículo'}
                  </li>
                  <li>Dados admissionais (Integração ERP) e cadastro do candidato</li>
                </ul>
                <p className="font-semibold mt-2 mb-1 text-xs uppercase tracking-wide">
                  Trilha de auditoria:
                </p>
                <p className="text-xs">
                  Os registros de auditoria serão <strong>anonimizados</strong> (não apagados):
                  mantêm ação, data e autor, sem nenhum dado pessoal do titular.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Digite EXCLUIR para confirmar"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={deleting}
          />
          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <Checkbox
              checked={lgpdChecked}
              onCheckedChange={(v) => setLgpdChecked(v === true)}
              disabled={deleting}
              className="mt-0.5"
            />
            <span>
              Confirmo que a exclusão atende a um pedido do titular (ou a política de retenção da
              empresa) e que li a lista acima. Entendo que a ação é irreversível.
            </span>
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-rose-600 hover:bg-rose-700"
            disabled={!canConfirm}
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir definitivamente'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default LgpdDeleteDialog
