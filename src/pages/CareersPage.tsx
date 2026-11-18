import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { jobsService } from '@/services/jobs'
import { companyService } from '@/services/company'
import type { Job, Company } from '@/types/ats'
import {
  Building2,
  MapPin,
  Briefcase,
  Clock,
  Search,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Filter,
  Share2,
  ExternalLink,
} from 'lucide-react'
import { onboardingService } from '@/services/onboarding'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { LoadingState } from '@/components/LoadingState'

export const CareersPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [selectedWorkplace, setSelectedWorkplace] = useState('all')
  const { toast } = useToast()
  const brandColor = onboardingService.getBrandColor(company)
  const logoUrl = onboardingService.getLogoUrl(company)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const jobsList = await jobsService.getPublishedJobs()
        const comp = await companyService.getCompany(
          (jobsList[0] as unknown as { company_id?: string })?.company_id,
        )
        setJobs(jobsList)
        setCompany(comp)
      } catch (err) {
        console.error('Erro ao carregar dados de carreiras:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Inserção da marcação estruturada Google for Jobs (schema.org/JobPosting) para todas as vagas abertas
  useEffect(() => {
    if (!jobs.length) return

    const companyName = company?.trade_name || company?.name || 'Vanguard Tecnologia'
    const baseUrl = window.location.origin

    const structuredData = jobs.map((job) => ({
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: job.title,
      description: `${job.description}\n\nPré-requisitos:\n${job.requirements || ''}\n\nBenefícios:\n${job.benefits || ''}`,
      identifier: {
        '@type': 'PropertyValue',
        name: companyName,
        value: job.id,
      },
      datePosted: job.created,
      validThrough: new Date(
        new Date(job.created).getTime() + 90 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      employmentType:
        job.employment_type === 'clt'
          ? 'FULL_TIME'
          : job.employment_type === 'internship'
            ? 'INTERN'
            : 'CONTRACTOR',
      hiringOrganization: {
        '@type': 'Organization',
        name: companyName,
        sameAs: company?.website || baseUrl,
        logo: logoUrl || 'https://img.usecurling.com/i?q=briefcase&color=azure',
      },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: job.location || 'São Paulo',
          addressRegion: 'SP',
          addressCountry: 'BR',
        },
      },
      jobLocationType: job.workplace_type === 'remote' ? 'TELECOMMUTE' : undefined,
      baseSalary:
        job.salary_disclosed && job.salary_min
          ? {
              '@type': 'MonetaryAmount',
              currency: 'BRL',
              value: {
                '@type': 'QuantitativeValue',
                minValue: job.salary_min,
                maxValue: job.salary_max || job.salary_min,
                unitText: 'MONTH',
              },
            }
          : undefined,
    }))

    const scriptId = 'google-for-jobs-ld-json'
    let script = document.getElementById(scriptId) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(structuredData)

    return () => {
      const el = document.getElementById(scriptId)
      if (el) el.remove()
    }
  }, [jobs, company])

  const departments = Array.from(new Set(jobs.map((j) => j.department).filter(Boolean))) as string[]

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.department && job.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (job.location && job.location.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesDepartment = selectedDepartment === 'all' || job.department === selectedDepartment
    const matchesWorkplace = selectedWorkplace === 'all' || job.workplace_type === selectedWorkplace

    return matchesSearch && matchesDepartment && matchesWorkplace
  })

  const handleShare = (slug: string) => {
    const url = `${window.location.origin}/carreiras/vaga/${slug}?origem=direct_link`
    navigator.clipboard.writeText(url)
    toast({
      title: 'Link copiado!',
      description: 'Link direto da vaga copiado para a área de transferência.',
    })
  }

  const getWorkplaceBadge = (type: string) => {
    switch (type) {
      case 'remote':
        return (
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Remoto
          </Badge>
        )
      case 'hybrid':
        return (
          <Badge variant="secondary" className="bg-sky-50 text-sky-700 border-sky-200">
            Híbrido
          </Badge>
        )
      case 'on_site':
        return (
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">
            Presencial
          </Badge>
        )
      default:
        return null
    }
  }

  const getSeniorityLabel = (seniority: string) => {
    const map: Record<string, string> = {
      intern: 'Estágio',
      junior: 'Júnior',
      mid: 'Pleno',
      senior: 'Sênior',
      lead: 'Especialista / Lead',
      specialist: 'Especialista',
    }
    return map[seniority] || seniority
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header institucional */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm font-bold text-lg overflow-hidden shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo da empresa" className="w-full h-full object-contain" />
              ) : company?.trade_name ? (
                company.trade_name.substring(0, 2).toUpperCase()
              ) : (
                'VA'
              )}
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-slate-900">
                {company?.trade_name || company?.name || 'Vanguard Soluções'}
              </h1>
              <p className="text-xs text-slate-500">Portal Oficial de Carreiras & Vagas</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-xs text-slate-600">
                Acesso Recrutador / Gestor
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Banner / Hero */}
      <section className="bg-gradient-to-b from-white to-slate-50 border-b py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Badge
            className="mb-4 border"
            style={{
              backgroundColor: `${brandColor}1a`,
              color: brandColor,
              borderColor: `${brandColor}33`,
            }}
          >
            Trabalhe Conosco • Vagas Abertas
          </Badge>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            Construa o futuro com a {company?.trade_name || company?.name || 'Vanguard'}
          </h2>
          <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto mb-8">
            {company?.description ||
              'Faça parte de uma equipe que valoriza autonomia, crescimento rápido e impacto real nos negócios de centenas de pequenas e médias empresas.'}
          </p>

          {/* Tag de conformidade Google for Jobs e LGPD */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Marcação Google for Jobs ativa
            </span>
            <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              100% em conformidade com a LGPD
            </span>
            <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Retorno transparente em todas as etapas
            </span>
          </div>
        </div>
      </section>

      {/* Busca e Filtros */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white p-4 rounded-xl border shadow-xs mb-8 flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por cargo, tecnologia ou palavra-chave..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex w-full md:w-auto gap-3">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Áreas</SelectItem>
                {departments.map((dep) => (
                  <SelectItem key={dep} value={dep}>
                    {dep}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedWorkplace} onValueChange={setSelectedWorkplace}>
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Modalidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer Modalidade</SelectItem>
                <SelectItem value="remote">Remoto</SelectItem>
                <SelectItem value="hybrid">Híbrido</SelectItem>
                <SelectItem value="on_site">Presencial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Listagem de Vagas */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Vagas em Aberto
            <Badge variant="secondary" className="rounded-full text-xs">
              {filteredJobs.length}
            </Badge>
          </h3>
        </div>

        {loading ? (
          <LoadingState message="Buscando oportunidades abertas..." />
        ) : filteredJobs.length === 0 ? (
          <Card className="text-center py-16 bg-white border-dashed">
            <CardContent>
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="font-semibold text-slate-700">Nenhuma vaga encontrada</h4>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Tente ajustar os filtros de busca ou volte mais tarde para novas posições.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setSelectedDepartment('all')
                  setSelectedWorkplace('all')
                }}
              >
                Limpar Filtros
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map((job) => (
              <Card
                key={job.id}
                className="flex flex-col hover:border-sky-300 hover:shadow-md transition bg-white"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-md"
                      style={{ backgroundColor: `${brandColor}14`, color: brandColor }}
                    >
                      {job.department || 'Geral'}
                    </span>
                    {getWorkplaceBadge(job.workplace_type)}
                  </div>
                  <CardTitle className="text-lg font-bold line-clamp-1 text-slate-900">
                    {job.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{job.location || 'Brasil'}</span>
                    <span>•</span>
                    <span>{getSeniorityLabel(job.seniority)}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 pb-4">
                  <p className="text-sm text-slate-600 line-clamp-3 mb-4">{job.description}</p>

                  {job.salary_disclosed && job.salary_min && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-100">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>
                        Faixa: R$ {job.salary_min.toLocaleString('pt-BR')}
                        {job.salary_max ? ` a R$ ${job.salary_max.toLocaleString('pt-BR')}` : ''}
                      </span>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2 border-t flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-500 hover:text-slate-800"
                    onClick={() => handleShare(job.slug)}
                    title="Copiar link da vaga com rastreamento de origem"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1" />
                    Compartilhar
                  </Button>

                  <Link to={`/carreiras/vaga/${job.slug}`}>
                    <Button
                      size="sm"
                      className="text-white hover:opacity-90"
                      style={{ backgroundColor: brandColor }}
                    >
                      Ver detalhes
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Rodapé LGPD & Empresa */}
      <footer className="border-t bg-white py-8 mt-12 text-slate-500 text-xs">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-800">{company?.trade_name || company?.name}</p>
            <p>
              Tratamento de dados em conformidade com a Lei Geral de Proteção de Dados (Lei nº
              13.709/2018).
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:underline">
              Área do Recrutador
            </Link>
            <span>•</span>
            <span>Talent · Ausland</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
