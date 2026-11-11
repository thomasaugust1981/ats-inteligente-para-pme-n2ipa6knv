/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'

import Layout from './components/Layout'
import Index from './pages/Index'
import NotFound from './pages/NotFound'

// Páginas Públicas
import { CareersPage } from './pages/CareersPage'
import { JobApplicationPage } from './pages/JobApplicationPage'
import { LoginPage } from './pages/LoginPage'
import { VerifyEmailPage, ResetPasswordPage } from './pages/AuthAuxPages'

// Páginas Administrativas
import { JobsListPage } from './pages/JobsListPage'
import { JobFormPage } from './pages/JobFormPage'
import { CandidatesListPage } from './pages/CandidatesListPage'
import { PipelinePage } from './pages/PipelinePage'
import { CandidateProfilePage } from './pages/CandidateProfilePage'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rotas Públicas de Carreiras e Candidatura (com Google for Jobs & LGPD) */}
          <Route path="/carreiras" element={<CareersPage />} />
          <Route path="/carreiras/vaga/:slug" element={<JobApplicationPage />} />

          {/* Autenticação e Recuperação de Senha */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verificar-email" element={<VerifyEmailPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

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
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
