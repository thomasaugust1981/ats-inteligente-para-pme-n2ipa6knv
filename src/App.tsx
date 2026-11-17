/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { ActiveCompanyProvider } from '@/hooks/use-active-company'
import { AiAgentSettingsProvider } from '@/hooks/use-ai-agent-settings'
import AiAgentSettingsPage from './pages/AiAgentSettingsPage'

import Layout from './components/Layout'
import Index from './pages/Index'
import NotFound from './pages/NotFound'

// Páginas Públicas
import { PortalPage } from './pages/PortalPage'
import { CareersPage } from './pages/CareersPage'
import { JobApplicationPage } from './pages/JobApplicationPage'
import { LoginPage } from './pages/LoginPage'
import { VerifyEmailPage, ResetPasswordPage } from './pages/AuthAuxPages'
import { OnboardingPage } from './pages/OnboardingPage'
import { DiscFormPage } from './pages/DiscFormPage'

// Páginas Administrativas
import { JobsListPage } from './pages/JobsListPage'
import { JobFormPage } from './pages/JobFormPage'
import { CandidatesListPage } from './pages/CandidatesListPage'
import { PipelinePage } from './pages/PipelinePage'
import { CandidateProfilePage } from './pages/CandidateProfilePage'
import OrganogramaPage from './pages/OrganogramaPage'
import SuperAdminPage from './pages/SuperAdminPage'
import { SuperAdminRouteGuard } from './components/SuperAdminRouteGuard'
import { AdminRouteGuard } from './components/AdminRouteGuard'
import EmpresasPage from './pages/EmpresasPage'
import IntegrationsPage from './pages/IntegrationsPage'
import { CargosPage } from './pages/CargosPage'
import EstruturaPage from './pages/EstruturaPage'
import { IndicadoresPage } from './pages/IndicadoresPage'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <ActiveCompanyProvider>
        <AiAgentSettingsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              {/* Rotas Públicas de Carreiras e Candidatura (com Google for Jobs & LGPD) */}
              <Route path="/portal" element={<PortalPage />} />
              <Route path="/carreiras" element={<CareersPage />} />
              <Route path="/carreiras/vaga/:slug" element={<JobApplicationPage />} />
              <Route path="/disc/:token" element={<DiscFormPage />} />

              {/* Autenticação e Recuperação de Senha */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/verificar-email" element={<VerifyEmailPage />} />
              <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />

              {/* Rotas Protegidas dentro do Layout do ATS */}
              <Route element={<Layout />}>
                <Route path="/" element={<Index />} />
                <Route path="/vagas" element={<JobsListPage />} />
                <Route path="/vagas/nova" element={<JobFormPage />} />
                <Route path="/vagas/editar/:id" element={<JobFormPage />} />
                <Route path="/pipeline" element={<PipelinePage />} />
                <Route path="/pipeline/:jobId" element={<PipelinePage />} />
                <Route path="/candidatos" element={<CandidatesListPage />} />
                <Route path="/candidato/:id" element={<CandidateProfilePage />} />
                <Route path="/organograma" element={<OrganogramaPage />} />
                <Route path="/empresas" element={<EmpresasPage />} />
                <Route path="/cargos" element={<CargosPage />} />
                <Route path="/estrutura" element={<EstruturaPage />} />
                <Route path="/indicadores" element={<IndicadoresPage />} />
                <Route path="/agente-score" element={<AiAgentSettingsPage />} />
                <Route element={<AdminRouteGuard />}>
                  <Route path="/integracoes" element={<IntegrationsPage />} />
                </Route>
                <Route element={<SuperAdminRouteGuard />}>
                  <Route path="/superadmin" element={<SuperAdminPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </AiAgentSettingsProvider>
      </ActiveCompanyProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
