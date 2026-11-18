import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { confirmVerification } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function verify() {
      if (!token) {
        setStatus('error')
        setErrorMessage('Token de verificação ausente ou expirado.')
        return
      }

      const { error } = await confirmVerification(token)
      if (error) {
        setStatus('error')
        setErrorMessage(error.message || 'Token inválido ou expirado.')
      } else {
        setStatus('success')
      }
    }
    verify()
  }, [token])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Verificação de E-mail</CardTitle>
          <CardDescription>Confirmação da sua conta de acesso ao Talent</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6">
          {status === 'loading' && (
            <p className="text-slate-500">Validando seu token de segurança...</p>
          )}

          {status === 'success' && (
            <div className="space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-lg font-bold text-slate-800">E-mail Confirmado!</h3>
              <p className="text-sm text-slate-600">
                Sua conta foi verificada com sucesso. Agora você já pode acessar todos os recursos
                do painel.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
              <h3 className="text-lg font-bold text-slate-800">Falha na Verificação</h3>
              <p className="text-sm text-rose-600">{errorMessage}</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Link to="/login" className="w-full">
            <Button className="w-full bg-sky-600 hover:bg-sky-700">Ir para o Login</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { confirmPasswordReset } = useAuth()
  const { toast } = useToast()

  const [password, setPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast({
        title: 'Token ausente',
        description: 'O link de recuperação parece inválido.',
        variant: 'destructive',
      })
      return
    }
    if (password.length < 8) {
      toast({
        title: 'Senha curta',
        description: 'A senha deve ter no mínimo 8 caracteres.',
        variant: 'destructive',
      })
      return
    }
    if (password !== confirmPass) {
      toast({
        title: 'Senhas divergentes',
        description: 'As senhas digitadas não coincidem.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    const { error } = await confirmPasswordReset(token, password)
    setLoading(false)

    if (error) {
      toast({
        title: 'Erro ao redefinir',
        description: error.message || 'Token expirado.',
        variant: 'destructive',
      })
    } else {
      setSuccess(true)
      toast({ title: 'Senha atualizada!', description: 'Você já pode entrar com a nova senha.' })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Redefinir Senha</CardTitle>
          <CardDescription>Crie uma nova senha de acesso segura para sua conta</CardDescription>
        </CardHeader>
        {success ? (
          <CardContent className="text-center py-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-slate-800">Senha Alterada!</h3>
            <p className="text-sm text-slate-600">Sua senha foi redefinida com sucesso.</p>
            <Link to="/login">
              <Button className="w-full mt-4 bg-sky-600 hover:bg-sky-700">Fazer Login</Button>
            </Link>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-semibold">Nova Senha</Label>
                <Input
                  type="password"
                  required
                  placeholder="Mínimo 8 dígitos"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Confirme a Nova Senha</Label>
                <Input
                  type="password"
                  required
                  placeholder="Repita a nova senha"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  className="mt-1"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-700"
              >
                {loading ? 'Salvando...' : 'Salvar Nova Senha'}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
