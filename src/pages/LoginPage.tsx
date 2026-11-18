import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { onboardingService } from '@/services/onboarding'
import { Briefcase, Lock, Mail, User as UserIcon, Building2, CheckCircle2 } from 'lucide-react'
import type { UserRole } from '@/types/ats'
import { DEMO_CREDENTIALS } from '@/lib/demoCredentials'

export const LoginPage: React.FC = () => {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>('login')
  const [loading, setLoading] = useState(false)

  // Login form
  const [loginEmail, setLoginEmail] = useState('thomas.august1981@gmail.com')
  const [loginPassword, setLoginPassword] = useState('Skip@Pass')

  // Register form
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regRole, setRegRole] = useState<UserRole>('recruiter')
  const [regCompany, setRegCompany] = useState('Ausland')

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(loginEmail, loginPassword)
    setLoading(false)

    if (error) {
      toast({
        title: 'Falha no login',
        description: 'E-mail ou senha incorretos. Verifique suas credenciais.',
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Bem-vindo ao Talent!',
        description: 'Login realizado com sucesso.',
      })
      // Quem ainda não concluiu (ou pulou) o onboarding é levado a ele;
      // quem já completou vai direto ao painel.
      try {
        const status = await onboardingService.getOnboardingStatus()
        navigate(status === 'completed' || status === 'skipped' ? '/' : '/onboarding')
      } catch (_) {
        navigate('/')
      }
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regEmail || !regPassword || !regName) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor preencha todos os campos do formulário.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    const { error } = await signUp(regEmail, regPassword, regName, regRole, regCompany)
    setLoading(false)

    if (error) {
      toast({
        title: 'Erro no cadastro',
        description: error.message || 'Não foi possível criar o usuário.',
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Conta criada!',
        description:
          'Sua conta foi criada. Enviamos um e-mail de confirmação para sua caixa de entrada.',
      })
      // Tentar login automático
      await signIn(regEmail, regPassword)
      // Conta recém-criada: leva ao onboarding guiado da empresa
      navigate('/onboarding')
    }
  }

  // Preenche e-mail e senha com as credenciais demo (1 clique — evita erro de
  // digitação de quem recebeu o link da demo).
  const handleFillDemo = () => {
    if (!DEMO_CREDENTIALS) return
    setLoginEmail(DEMO_CREDENTIALS.email)
    setLoginPassword(DEMO_CREDENTIALS.password)
    setActiveTab('login')
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail) return

    setLoading(true)
    const { error } = await requestPasswordReset(forgotEmail)
    setLoading(false)

    if (error) {
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar o e-mail de recuperação.',
        variant: 'destructive',
      })
    } else {
      setResetSent(true)
      toast({
        title: 'E-mail enviado',
        description: 'Se o endereço estiver cadastrado, você receberá instruções de redefinição.',
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-600 text-white shadow-md mb-3">
          <Briefcase className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Talent</h1>
        <p className="text-sm text-slate-600 mt-1">
          Plataforma de Recrutamento e Seleção da Ausland
        </p>
      </div>

      <Card className="w-full max-w-md shadow-lg border-slate-200 bg-white">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-3 w-full rounded-t-lg rounded-b-none border-b bg-slate-50">
            <TabsTrigger value="login" className="text-xs">
              Entrar
            </TabsTrigger>
            <TabsTrigger value="register" className="text-xs">
              Criar Conta
            </TabsTrigger>
            <TabsTrigger value="forgot" className="text-xs">
              Recuperar
            </TabsTrigger>
          </TabsList>

          {/* TAB LOGIN */}
          <TabsContent value="login">
            <form onSubmit={handleLogin}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Acesso ao Painel</CardTitle>
                <CardDescription className="text-xs">
                  Entrada para Administrador, Recrutador ou Gestor Solicitante.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="login-email" className="text-xs font-semibold">
                    E-mail
                  </Label>
                  <div className="relative mt-1">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id="login-email"
                      type="email"
                      required
                      className="pl-9 text-sm"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <Label htmlFor="login-pass" className="text-xs font-semibold">
                      Senha
                    </Label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('forgot')}
                      className="text-xs text-sky-600 hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id="login-pass"
                      type="password"
                      required
                      className="pl-9 text-sm"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                </div>

                {DEMO_CREDENTIALS && (
                  <div className="border border-dashed border-sky-300 bg-sky-50/60 p-2.5 rounded">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] text-sky-800">
                        <strong className="font-semibold">Acesso de demonstração</strong>
                        <span className="text-slate-500"> — dados fictícios</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleFillDemo}
                        className="h-6 px-2 text-[11px] border-sky-300 text-sky-700 hover:bg-sky-100"
                      >
                        Preencher credenciais de demo
                      </Button>
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 p-2.5 rounded text-[11px] text-slate-600 border">
                  <strong>Contas pré-configuradas:</strong>
                  <div className="mt-1 flex flex-col gap-0.5">
                    <span>
                      • Admin: <code>thomas.august1981@gmail.com</code> (Skip@Pass)
                    </span>
                    <span>
                      • Recrutadora: <code>recrutamento@ausland.com.br</code> (Skip@Pass)
                    </span>
                    <span>
                      • Gestor TI: <code>gestor.ti@ausland.com.br</code> (Skip@Pass)
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 pt-2 border-t">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sky-600 hover:bg-sky-700"
                >
                  {loading ? 'Entrando...' : 'Entrar no Sistema'}
                </Button>
                <Link
                  to="/carreiras"
                  className="text-xs text-center text-slate-500 hover:text-slate-800"
                >
                  Ir para a Página Pública de Carreiras
                </Link>
              </CardFooter>
            </form>
          </TabsContent>

          {/* TAB REGISTER */}
          <TabsContent value="register">
            <form onSubmit={handleRegister}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Cadastrar Usuário</CardTitle>
                <CardDescription className="text-xs">
                  Crie um acesso para seu time de RH ou gestão de contratação.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="reg-name" className="text-xs font-semibold">
                    Nome Completo
                  </Label>
                  <div className="relative mt-1">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id="reg-name"
                      required
                      placeholder="Ex: João da Silva"
                      className="pl-9 text-sm"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="reg-email" className="text-xs font-semibold">
                    E-mail Corporativo
                  </Label>
                  <div className="relative mt-1">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id="reg-email"
                      type="email"
                      required
                      placeholder="joao@suaempresa.com.br"
                      className="pl-9 text-sm"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="reg-pass" className="text-xs font-semibold">
                    Senha (mínimo 8 caracteres)
                  </Label>
                  <div className="relative mt-1">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id="reg-pass"
                      type="password"
                      required
                      placeholder="••••••••"
                      className="pl-9 text-sm"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="reg-role" className="text-xs font-semibold">
                      Papel de Acesso
                    </Label>
                    <Select value={regRole} onValueChange={(v) => setRegRole(v as UserRole)}>
                      <SelectTrigger id="reg-role" className="mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="recruiter">Recrutador</SelectItem>
                        <SelectItem value="manager">Gestor Solicitante</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="reg-comp" className="text-xs font-semibold">
                      Empresa
                    </Label>
                    <Input
                      id="reg-comp"
                      className="mt-1 text-xs"
                      value={regCompany}
                      onChange={(e) => setRegCompany(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2 border-t">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sky-600 hover:bg-sky-700"
                >
                  {loading ? 'Cadastrando...' : 'Criar Conta e Começar'}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          {/* TAB FORGOT */}
          <TabsContent value="forgot">
            <form onSubmit={handleForgotPassword}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recuperar Senha</CardTitle>
                <CardDescription className="text-xs">
                  Enviaremos instruções de redefinição para seu e-mail cadastrado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {resetSent ? (
                  <div className="bg-emerald-50 text-emerald-800 p-4 rounded-lg text-xs flex items-start gap-2 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>E-mail enviado!</strong>
                      <p className="mt-1">
                        Verifique sua caixa de entrada e clique no link para redefinir sua senha com
                        segurança.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="forgot-email" className="text-xs font-semibold">
                      Seu E-mail
                    </Label>
                    <div className="relative mt-1">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <Input
                        id="forgot-email"
                        type="email"
                        required
                        placeholder="seu.email@empresa.com.br"
                        className="pl-9 text-sm"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-2 pt-2 border-t">
                {!resetSent && (
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-sky-600 hover:bg-sky-700"
                  >
                    {loading ? 'Enviando link...' : 'Enviar Link de Recuperação'}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveTab('login')}
                  className="text-xs text-slate-600"
                >
                  Voltar para o Login
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
