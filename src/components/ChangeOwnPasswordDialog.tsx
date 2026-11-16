import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ShieldCheck } from 'lucide-react'
import { superadminService } from '@/services/superadmin'

interface ChangeOwnPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPasswordChanged?: () => void
}

/** Modal de troca da própria senha (usuário logado, via oldPassword). */
const ChangeOwnPasswordDialog: React.FC<ChangeOwnPasswordDialogProps> = ({
  open,
  onOpenChange,
  onPasswordChanged,
}) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Preencha todos os campos.')
      return
    }
    if (newPassword.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação não confere com a nova senha.')
      return
    }
    setSaving(true)
    try {
      await superadminService.changeOwnPassword(currentPassword, newPassword)
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onPasswordChanged?.()
      setTimeout(() => {
        setSuccess(false)
        onOpenChange(false)
      }, 1500)
    } catch (err) {
      setError(
        (err as Error)?.message || 'Não foi possível alterar a senha. Verifique a senha atual.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-600" /> Alterar minha senha
          </DialogTitle>
          <DialogDescription>
            Use a senha atual para confirmar e defina a nova senha (mínimo 8 caracteres).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-current">Senha atual *</Label>
            <Input
              id="cp-current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">Nova senha *</Label>
            <Input
              id="cp-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Confirmar nova senha *</Label>
            <Input
              id="cp-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">Senha alterada com sucesso!</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…
                </>
              ) : (
                'Salvar nova senha'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ChangeOwnPasswordDialog
