import React, { useState } from 'react'
import type { StructuredResume, StructuredExperience, StructuredEducation } from '@/types/ats'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus, GraduationCap, Briefcase, Sparkles, User as UserIcon } from 'lucide-react'

interface ResumeReviewFormProps {
  data: StructuredResume
  onChange: (data: StructuredResume) => void
  onConfirm: () => void
  onManualStart?: () => void
  disabled?: boolean
  fromExtraction?: boolean
}

/** Etapa de revisão: o candidato edita qualquer campo do modelo padrão antes de confirmar. */
export const ResumeReviewForm: React.FC<ResumeReviewFormProps> = ({
  data,
  onChange,
  onConfirm,
  onManualStart,
  disabled,
  fromExtraction,
}) => {
  const [skillInput, setSkillInput] = useState('')
  const [languageInput, setLanguageInput] = useState('')
  const [courseInput, setCourseInput] = useState('')

  const set = <K extends keyof StructuredResume>(key: K, value: StructuredResume[K]) =>
    onChange({ ...data, [key]: value })

  const addToList = (key: 'skills' | 'languages' | 'courses', value: string) => {
    const v = value.trim()
    if (!v) return
    if (data[key].some((s) => s.toLowerCase() === v.toLowerCase())) return
    set(key, [...data[key], v])
  }

  const updateExperience = (idx: number, patch: Partial<StructuredExperience>) => {
    set(
      'experiences',
      data.experiences.map((exp, i) => (i === idx ? { ...exp, ...patch } : exp)),
    )
  }

  const updateEducation = (idx: number, patch: Partial<StructuredEducation>) => {
    set(
      'education',
      data.education.map((ed, i) => (i === idx ? { ...ed, ...patch } : ed)),
    )
  }

  const addExperience = () =>
    set('experiences', [
      ...data.experiences,
      { title: '', company: '', start_date: '', end_date: '', current: false, description: '' },
    ])

  const addEducation = () =>
    set('education', [
      ...data.education,
      { degree: '', institution: '', start_date: '', end_date: '', status: '' },
    ])

  const tagInput = (
    key: 'skills' | 'languages' | 'courses',
    value: string,
    setValue: (v: string) => void,
    label: string,
    placeholder: string,
  ) => (
    <div>
      <Label className="text-xs font-semibold">{label}</Label>
      <div className="flex flex-wrap gap-1.5 mt-1 mb-1.5">
        {data[key].length === 0 && <span className="text-[11px] text-slate-400">Nenhum item</span>}
        {data[key].map((tag, idx) => (
          <Badge
            key={idx}
            variant="outline"
            className="bg-sky-50 text-sky-800 border-sky-200 gap-1 pr-1"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remover ${tag}`}
              disabled={disabled}
              onClick={() =>
                set(
                  key,
                  data[key].filter((_, i) => i !== idx),
                )
              }
              className="hover:text-rose-600 ml-0.5"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addToList(key, value)
              setValue('')
            }
          }}
          className="text-xs"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            addToList(key, value)
            setValue('')
          }}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )

  return (
    <Card className="bg-white shadow-sm border-sky-100">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
          {fromExtraction ? (
            <Sparkles className="w-5 h-5 text-sky-600" />
          ) : (
            <UserIcon className="w-5 h-5 text-sky-600" />
          )}
          {fromExtraction ? 'Revise os dados do seu currículo' : 'Preencha seu currículo'}
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          {fromExtraction
            ? 'Leitura automática concluída. Confira e EDITE qualquer campo antes de confirmar — nada é salvo sem a sua revisão.'
            : 'Todos os campos são opcionais, mas ajudam o recrutador a conhecer você melhor.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 pt-4">
        {/* Dados básicos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs font-semibold">Nome</Label>
            <Input
              value={data.name}
              onChange={(e) => set('name', e.target.value)}
              className="mt-1 text-sm"
              disabled={disabled}
              placeholder="Nome completo"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">E-mail</Label>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => set('email', e.target.value)}
              className="mt-1 text-sm"
              disabled={disabled}
              placeholder="seu.email@exemplo.com.br"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Telefone</Label>
            <Input
              value={data.phone}
              onChange={(e) => set('phone', e.target.value)}
              className="mt-1 text-sm"
              disabled={disabled}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Cidade / Estado</Label>
            <Input
              value={data.location}
              onChange={(e) => set('location', e.target.value)}
              className="mt-1 text-sm"
              disabled={disabled}
              placeholder="Ex: São Paulo, SP"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">LinkedIn</Label>
            <Input
              value={data.linkedin}
              onChange={(e) => set('linkedin', e.target.value)}
              className="mt-1 text-sm"
              disabled={disabled}
              placeholder="https://linkedin.com/in/seuperfil"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs font-semibold">Resumo profissional</Label>
            <Textarea
              value={data.summary}
              onChange={(e) => set('summary', e.target.value)}
              rows={3}
              className="mt-1 text-sm"
              disabled={disabled}
              placeholder="Breve descrição da sua trajetória..."
            />
          </div>
        </div>

        {/* Experiências */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-slate-500" />
              Experiência profissional
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={addExperience}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adicionar
            </Button>
          </div>
          {data.experiences.length === 0 && (
            <p className="text-[11px] text-slate-400">Nenhuma experiência cadastrada.</p>
          )}
          {data.experiences.map((exp, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-2 bg-slate-50/60">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-rose-600"
                  disabled={disabled}
                  onClick={() =>
                    set(
                      'experiences',
                      data.experiences.filter((_, i) => i !== idx),
                    )
                  }
                  aria-label="Remover experiência"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-slate-500">Cargo</Label>
                  <Input
                    value={exp.title}
                    onChange={(e) => updateExperience(idx, { title: e.target.value })}
                    className="text-xs mt-0.5"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Empresa</Label>
                  <Input
                    value={exp.company}
                    onChange={(e) => updateExperience(idx, { company: e.target.value })}
                    className="text-xs mt-0.5"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Início (MM/AAAA)</Label>
                  <Input
                    value={exp.start_date}
                    onChange={(e) => updateExperience(idx, { start_date: e.target.value })}
                    className="text-xs mt-0.5"
                    disabled={disabled}
                    placeholder="01/2020"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Fim (MM/AAAA)</Label>
                  <Input
                    value={exp.end_date}
                    onChange={(e) => updateExperience(idx, { end_date: e.target.value })}
                    className="text-xs mt-0.5"
                    disabled={disabled}
                    placeholder="Deixe vazio se for atual"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`exp-current-${idx}`}
                  checked={exp.current}
                  onCheckedChange={(c) =>
                    updateExperience(idx, { current: !!c, end_date: c ? '' : exp.end_date })
                  }
                  disabled={disabled}
                />
                <Label
                  htmlFor={`exp-current-${idx}`}
                  className="text-[11px] text-slate-600 cursor-pointer"
                >
                  Emprego atual
                </Label>
              </div>
              <div>
                <Label className="text-[11px] text-slate-500">Descrição / atividades</Label>
                <Textarea
                  value={exp.description}
                  onChange={(e) => updateExperience(idx, { description: e.target.value })}
                  rows={2}
                  className="text-xs mt-0.5"
                  disabled={disabled}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Formação */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
              Formação acadêmica
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={addEducation}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adicionar
            </Button>
          </div>
          {data.education.length === 0 && (
            <p className="text-[11px] text-slate-400">Nenhuma formação cadastrada.</p>
          )}
          {data.education.map((ed, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-2 bg-slate-50/60">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-rose-600"
                  disabled={disabled}
                  onClick={() =>
                    set(
                      'education',
                      data.education.filter((_, i) => i !== idx),
                    )
                  }
                  aria-label="Remover formação"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-slate-500">Curso / formação</Label>
                  <Input
                    value={ed.degree}
                    onChange={(e) => updateEducation(idx, { degree: e.target.value })}
                    className="text-xs mt-0.5"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Instituição</Label>
                  <Input
                    value={ed.institution}
                    onChange={(e) => updateEducation(idx, { institution: e.target.value })}
                    className="text-xs mt-0.5"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Início (MM/AAAA)</Label>
                  <Input
                    value={ed.start_date}
                    onChange={(e) => updateEducation(idx, { start_date: e.target.value })}
                    className="text-xs mt-0.5"
                    disabled={disabled}
                    placeholder="01/2018"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Fim (MM/AAAA)</Label>
                  <Input
                    value={ed.end_date}
                    onChange={(e) => updateEducation(idx, { end_date: e.target.value })}
                    className="text-xs mt-0.5"
                    disabled={disabled}
                    placeholder="12/2022"
                  />
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-slate-500">Situação</Label>
                <Input
                  value={ed.status}
                  onChange={(e) => updateEducation(idx, { status: e.target.value })}
                  className="text-xs mt-0.5"
                  disabled={disabled}
                  placeholder="Concluído / Em andamento"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Competências, idiomas e cursos */}
        {tagInput('skills', skillInput, setSkillInput, 'Competências', 'Ex: React, SQL, Gestão...')}
        {tagInput('languages', languageInput, setLanguageInput, 'Idiomas', 'Ex: Inglês — avançado')}
        {tagInput(
          'courses',
          courseInput,
          setCourseInput,
          'Cursos e certificações',
          'Ex: Scrum Foundation',
        )}

        <div className="flex flex-col gap-2 pt-2 border-t">
          <Button
            type="button"
            disabled={disabled}
            onClick={onConfirm}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white font-medium"
          >
            Confirmar e revisar os dados
          </Button>
          {onManualStart && (
            <Button type="button" variant="ghost" disabled={disabled} onClick={onManualStart}>
              Descartar e preencher manualmente
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
