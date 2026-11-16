import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  LogIn,
} from 'lucide-react'
import { companyService } from '@/services/company'
import { jobsService } from '@/services/jobs'
import { onboardingService } from '@/services/onboarding'
import type { Company } from '@/types/ats'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

/**
 * Página de entrada pública do ATS (rota /portal, sem autenticação).
 * Usa a mesma fonte de marca da página /carreiras: o registro `companies`
 * criado no onboarding (nome, logo, cor e descrição).
 */
export const PortalPage: React.FC = () => {
  const [company, setCompany] = useState<Company | null>(null)
  const [openJobs, setOpenJobs] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const brandColor = onboardingService.getBrandColor(company)
  const logoUrl = onboardingService.getLogoUrl(company)
  const companyName = company?.trade_name || company?.name || 'Ausland'
  const portalUrl = `${window.location.origin}/portal`
  const htmlSnippet = `<a href="${portalUrl}" target="_blank" rel="noopener">\n  Vagas ${companyName}\n</a>`

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        // Mesmo padrão de JobApplicationPage/CareersPage: a marca vem do
        // company_id da vaga publicada (não do primeiro registro da coleção).
        const jobs = await jobsService.getPublishedJobs()
        setOpenJobs(jobs.length)
        const comp = await companyService.getCompany(jobs[0]?.company_id)
        setCompany(comp)
      } catch (err) {
        console.error('Erro ao carregar dados do portal:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Copiado!',
        description: `${label} copiado para a área de transferência.`,
      })
    } catch (_) {
      toast({
        title: 'Não foi possível copiar',
        description: 'Copie manualmente selecionando o texto abaixo.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm font-bold text-lg overflow-hidden shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`Logo da ${companyName}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                companyName.substring(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-slate-900">{companyName}</h1>
              <p className="text-xs text-slate-500">Portal de Recrutamento & Seleção</p>
            </div>
          </div>
          <Link to="/login">
            <Button variant="ghost" size="sm" className="text-xs text-slate-600 gap-1.5">
              <LogIn className="w-3.5 h-3.5" />
              Entrar
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center">
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-24 text-center w-full">
          <Badge
            className="mb-5 border"
            style={{
              backgroundColor: `${brandColor}1a`,
              color: brandColor,
              borderColor: `${brandColor}33`,
            }}
          >
            Portal de Carreiras • {companyName}
          </Badge>

          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-5">
            Junte-se ao time da {companyName}
          </h2>

          <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto mb-4">
            {company?.description ||
              `Acompanhe as oportunidades abertas, candidate-se em poucos minutos e acompanhe cada etapa do processo seletivo — tudo em um só lugar.`}
          </p>

          {openJobs !== null && (
            <p className="text-sm text-slate-500 mb-8 flex items-center justify-center gap-1.5">
              <Briefcase className="w-4 h-4" style={{ color: brandColor }} />
              {loading
                ? 'Carregando vagas…'
                : `${openJobs} ${openJobs === 1 ? 'vaga aberta' : 'vagas abertas'} no momento`}
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/carreiras">
              <Button
                size="lg"
                className="text-white hover:opacity-90 shadow-md w-full sm:w-auto"
                style={{ backgroundColor: brandColor }}
              >
                Ver vagas abertas
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                <LogIn className="w-4 h-4" />
                Entrar
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-10 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Candidatura 100% online
            </span>
            <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Processo transparente
            </span>
            <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Dados protegidos (LGPD)
            </span>
          </div>
        </div>
      </section>

      {/* Link para embutir no site externo do cliente */}
      <section className="pb-12">
        <div className="max-w-3xl mx-auto px-4">
          <Card className="bg-white">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${brandColor}1a`, color: brandColor }}
                >
                  <Link2 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Link deste portal</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Copie o endereço abaixo para criar um botão "Trabalhe conosco" na página{' '}
                    <span className="font-medium text-slate-700">erpreport.ausland.com.br</span>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-2.5">
                <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                <code className="text-xs text-slate-700 flex-1 truncate select-all">
                  {portalUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 shrink-0"
                  onClick={() => copyToClipboard(portalUrl, 'Link do portal')}
                >
                  <Copy className="w-3 h-3" />
                  Copiar
                </Button>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  Ou use este trecho de HTML pronto no seu site:
                </p>
                <div className="relative bg-slate-900 rounded-lg px-3 py-2.5">
                  <pre className="text-[11px] leading-relaxed text-slate-200 overflow-x-auto whitespace-pre">
                    {htmlSnippet}
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-6 text-[10px] gap-1 absolute top-1.5 right-1.5"
                    onClick={() => copyToClipboard(htmlSnippet, 'Código HTML do botão')}
                  >
                    <Copy className="w-3 h-3" />
                    Copiar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="border-t bg-white py-6 text-slate-500 text-xs">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="font-semibold text-slate-800">{companyName}</p>
          <div className="flex items-center gap-4">
            <Link to="/carreiras" className="hover:underline">
              Ver vagas
            </Link>
            <span>•</span>
            <Link to="/login" className="hover:underline">
              Área do Recrutador
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
