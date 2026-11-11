import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { candidatesService } from '@/services/candidates'
import { jobsService } from '@/services/jobs'
import type { Candidate, SeniorityLevel, CandidateAvailability, Job } from '@/types/ats'
import {
  Users,
  Search,
  Filter,
  MapPin,
  FileText,
  ExternalLink,
  ShieldCheck,
  Trash2,
  Clock,
  Sparkles,
  Calendar,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export const CandidatesListPage: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  // Filtros solicitados na especificação: competência, senioridade, localidade e disponibilidade
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSeniority, setSelectedSeniority] = useState<string>('all')
  const [selectedAvailability, setSelectedAvailability] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState('')
  const [skillFilter, setSkillFilter] = useState('')

  const loadCandidates = async () => {
    try {
      setLoading(true)
      const list = await candidatesService.listCandidates()
      setCandidates(list)
    } catch (err) {
      console.error('Erro ao carregar candidatos:', err)
      toast({ title: 'Erro ao listar candidatos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCandidates()
  }, [])

  const handlePermanentDelete = async (candidateId: string, name: string) => {
    const confirmation = window.prompt(
      `EXCLUSÃO REAL LGPD:\nPara confirmar a eliminação permanente e irreversível de ${name}, de todos os seus dados e arquivo de currículo, digite EXCLUIR:`,
    )

    if (confirmation !== 'EXCLUIR') {
      return
    }

    try {
      await candidatesService.deleteCandidateRealLGPD(candidateId)
      toast({
        title: 'Dados excluídos com sucesso (LGPD)',
        description: `Todos os registros e currículo de ${name} foram removidos de forma definitiva.`,
      })
      loadCandidates()
    } catch (err) {
      toast({
        title: 'Erro ao excluir candidato',
        description: 'Não foi possível completar a exclusão.',
        variant: 'destructive',
      })
    }
  }

  const filteredCandidates = candidates.filter((cand) => {
    const matchesSearch =
      cand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cand.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesSeniority = selectedSeniority === 'all' || cand.seniority === selectedSeniority

    const matchesAvailability =
      selectedAvailability === 'all' || cand.availability === selectedAvailability

    const matchesLocation =
      !locationFilter.trim() ||
      (cand.location && cand.location.toLowerCase().includes(locationFilter.toLowerCase()))

    const matchesSkill =
      !skillFilter.trim() ||
      (cand.skills && cand.skills.toLowerCase().includes(skillFilter.toLowerCase()))

    return (
      matchesSearch && matchesSeniority && matchesAvailability && matchesLocation && matchesSkill
    )
  })

  const getSeniorityLabel = (s?: string) => {
    const map: Record<string, string> = {
      intern: 'Estágio',
      junior: 'Júnior',
      mid: 'Pleno',
      senior: 'Sênior',
      lead: 'Especialista / Lead',
    }
    return s ? map[s] || s : 'Não informado'
  }

  const getAvailabilityLabel = (a?: string) => {
    const map: Record<string, string> = {
      immediate: 'Imediata',
      two_weeks: 'Em 2 semanas',
      one_month: 'Em 30 dias',
      exploring: 'Apenas avaliando',
    }
    return a ? map[a] || a : 'Não informada'
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Banco de Talentos & Candidatos
          </h1>
          <p className="text-sm text-slate-500">
            Consulte todos os candidatos cadastrados com filtros por competência, senioridade,
            localidade e disponibilidade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200 py-1.5 px-3"
          >
            <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
            Consentimento LGPD Ativo
          </Badge>
        </div>
      </div>

      {/* Barra de Filtros avançados */}
      <Card className="bg-white">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                className="pl-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="relative">
              <Sparkles className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Filtrar por competência (ex: React, SQL)..."
                className="pl-9 text-xs"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
              />
            </div>

            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Filtrar por localidade (ex: SP, Remoto)..."
                className="pl-9 text-xs"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div>
              <Select value={selectedSeniority} onValueChange={setSelectedSeniority}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Senioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Senioridades</SelectItem>
                  <SelectItem value="intern">Estágio</SelectItem>
                  <SelectItem value="junior">Júnior</SelectItem>
                  <SelectItem value="mid">Pleno</SelectItem>
                  <SelectItem value="senior">Sênior</SelectItem>
                  <SelectItem value="lead">Especialista / Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={selectedAvailability} onValueChange={setSelectedAvailability}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Disponibilidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer Disponibilidade</SelectItem>
                  <SelectItem value="immediate">Imediata</SelectItem>
                  <SelectItem value="two_weeks">Em 2 semanas</SelectItem>
                  <SelectItem value="one_month">Em 30 dias</SelectItem>
                  <SelectItem value="exploring">Apenas avaliando</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-slate-500"
                onClick={() => {
                  setSearchTerm('')
                  setSkillFilter('')
                  setLocationFilter('')
                  setSelectedSeniority('all')
                  setSelectedAvailability('all')
                }}
              >
                Limpar Filtros
              </Button>
              <Badge variant="secondary" className="text-xs py-1">
                {filteredCandidates.length} candidatos encontrados
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Candidatos */}
      {loading ? (
        <div className="py-12 text-center text-slate-500">Carregando candidatos...</div>
      ) : filteredCandidates.length === 0 ? (
        <Card className="text-center py-12 bg-white">
          <CardContent>
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-800">Nenhum candidato encontrado</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Ajuste seus filtros ou compartilhe o link de carreiras para atrair novos talentos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCandidates.map((candidate) => (
            <Card
              key={candidate.id}
              className="bg-white hover:border-slate-300 transition flex flex-col"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base font-bold text-slate-900">
                      {candidate.name}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span>{candidate.email}</span>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[11px] bg-slate-50 shrink-0">
                    {getSeniorityLabel(candidate.seniority)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 text-xs space-y-3 pb-3">
                <div className="grid grid-cols-2 gap-2 text-slate-600 bg-slate-50 p-2 rounded">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Localidade</span>
                    <span className="font-medium text-slate-700 truncate block">
                      {candidate.location || 'Não informada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Disponibilidade</span>
                    <span className="font-medium text-slate-700 truncate block">
                      {getAvailabilityLabel(candidate.availability)}
                    </span>
                  </div>
                </div>

                {candidate.skills && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 uppercase font-semibold">
                      Competências
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {candidate.skills
                        .split(',')
                        .slice(0, 4)
                        .map((sk, idx) => (
                          <span
                            key={idx}
                            className="bg-sky-50 text-sky-700 text-[10px] px-1.5 py-0.5 rounded border border-sky-100"
                          >
                            {sk.trim()}
                          </span>
                        ))}
                      {candidate.skills.split(',').length > 4 && (
                        <span className="text-[10px] text-slate-400 px-1 py-0.5">
                          +{candidate.skills.split(',').length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 text-[11px] text-emerald-700 pt-1 border-t">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    LGPD Aceito:{' '}
                    {new Date(candidate.lgpd_consent_date || candidate.created).toLocaleDateString(
                      'pt-BR',
                    )}
                  </span>
                </div>
              </CardContent>

              <div className="p-3 border-t bg-slate-50/50 flex items-center justify-between gap-2">
                <Link to={`/candidato/${candidate.id}`}>
                  <Button size="sm" variant="outline" className="text-xs h-8">
                    Ver Perfil Completo
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
                  onClick={() => handlePermanentDelete(candidate.id, candidate.name)}
                  title="Exclusão real LGPD"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Excluir LGPD
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
