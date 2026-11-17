import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FieldError } from './FieldError'
import type { JobFormValues, JobFormErrors, SetJobFormField } from './types'

interface InheritedJobFields {
  salaryMin?: number | null
  salaryMax?: number | null
  managerName?: string
}

interface BasicInfoCardProps {
  values: JobFormValues
  managers: { id: string; name?: string; email?: string; role?: string }[]
  errors: JobFormErrors
  onField: SetJobFormField
  /** FASE 3: quando a vaga vem de um cargo, faixa salarial e gestor são herdados (somente leitura). */
  inherited?: InheritedJobFields | null
}

/** Bloco 1: Dados da Vaga — identificação, classificação, salário e status. */
export const BasicInfoCard: React.FC<BasicInfoCardProps> = ({
  values,
  managers,
  errors,
  onField,
  inherited,
}) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label htmlFor="title" className="text-xs font-semibold">
          Título da Vaga *
        </Label>
        <Input
          id="title"
          placeholder="Ex: Desenvolvedor Full Stack Pleno"
          value={values.title}
          onChange={(e) => onField('title', e.target.value)}
          className="mt-1"
          aria-invalid={Boolean(errors.title)}
        />
        <FieldError message={errors.title} />
      </div>

      <div>
        <Label htmlFor="slug" className="text-xs font-semibold">
          Slug da URL (Carreiras) *
        </Label>
        <Input
          id="slug"
          placeholder="desenvolvedor-full-stack-pleno"
          value={values.slug}
          onChange={(e) => onField('slug', e.target.value)}
          className="mt-1 font-mono text-xs"
          aria-invalid={Boolean(errors.slug)}
        />
        <FieldError message={errors.slug} />
        <span className="text-[11px] text-slate-400">
          URL: /carreiras/vaga/<strong>{values.slug || 'slug-da-vaga'}</strong>
        </span>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <Label htmlFor="department" className="text-xs font-semibold">
          Área / Departamento
        </Label>
        <Input
          id="department"
          placeholder="Ex: Tecnologia, Vendas..."
          value={values.department}
          onChange={(e) => onField('department', e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="location" className="text-xs font-semibold">
          Localidade
        </Label>
        <Input
          id="location"
          placeholder="Ex: São Paulo - SP"
          value={values.location}
          onChange={(e) => onField('location', e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="manager" className="text-xs font-semibold flex items-center gap-1">
          Gestor Responsável
          {inherited?.managerName && <Lock className="w-3 h-3 text-slate-400" />}
        </Label>
        {inherited?.managerName ? (
          <div
            className="mt-1 flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
            title="Herdado do cargo vinculado — somente leitura"
          >
            {inherited.managerName}
          </div>
        ) : (
          <Select value={values.managerId} onValueChange={(v) => onField('managerId', v)}>
            <SelectTrigger id="manager" className="mt-1">
              <SelectValue placeholder="Selecione o gestor" />
            </SelectTrigger>
            <SelectContent>
              {managers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name || m.email} ({m.role || 'membro'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <Label className="text-xs font-semibold">Modalidade</Label>
        <Select
          value={values.workplaceType}
          onValueChange={(v) => onField('workplaceType', v as JobFormValues['workplaceType'])}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="remote">Remoto</SelectItem>
            <SelectItem value="hybrid">Híbrido</SelectItem>
            <SelectItem value="on_site">Presencial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold">Contrato</Label>
        <Select
          value={values.employmentType}
          onValueChange={(v) => onField('employmentType', v as JobFormValues['employmentType'])}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="clt">CLT</SelectItem>
            <SelectItem value="pj">PJ</SelectItem>
            <SelectItem value="internship">Estágio</SelectItem>
            <SelectItem value="temporary">Temporário</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold">Senioridade</Label>
        <Select
          value={values.seniority}
          onValueChange={(v) => onField('seniority', v as JobFormValues['seniority'])}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="intern">Estágio</SelectItem>
            <SelectItem value="junior">Júnior</SelectItem>
            <SelectItem value="mid">Pleno</SelectItem>
            <SelectItem value="senior">Sênior</SelectItem>
            <SelectItem value="lead">Especialista / Lead</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold">Status Inicial</Label>
        <Select
          value={values.status}
          onValueChange={(v) => onField('status', v as JobFormValues['status'])}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="published">Publicada (Aberta)</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="paused">Pausada</SelectItem>
            <SelectItem value="closed">Encerrada</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <Label htmlFor="sal-min" className="text-xs font-semibold flex items-center gap-1">
          Salário Mínimo (R$)
          {inherited?.salaryMin != null && <Lock className="w-3 h-3 text-slate-400" />}
        </Label>
        <Input
          id="sal-min"
          type="number"
          placeholder="Ex: 5000"
          value={values.salaryMin}
          onChange={(e) => onField('salaryMin', e.target.value)}
          className="mt-1"
          disabled={inherited?.salaryMin != null}
        />
        {inherited?.salaryMin != null && (
          <span className="text-[11px] text-slate-400">Herdado do cargo vinculado.</span>
        )}
      </div>

      <div>
        <Label htmlFor="sal-max" className="text-xs font-semibold flex items-center gap-1">
          Salário Máximo (R$)
          {inherited?.salaryMax != null && <Lock className="w-3 h-3 text-slate-400" />}
        </Label>
        <Input
          id="sal-max"
          type="number"
          placeholder="Ex: 7500"
          value={values.salaryMax}
          onChange={(e) => onField('salaryMax', e.target.value)}
          className="mt-1"
          aria-invalid={Boolean(errors.salaryMax)}
          disabled={inherited?.salaryMax != null}
        />
        <FieldError message={errors.salaryMax} />
      </div>
    </div>

    <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
      <div className="space-y-0.5">
        <Label className="text-xs font-semibold">Divulgar salário na página de carreiras</Label>
        <p className="text-[11px] text-slate-500">
          Vagas com salário visível têm maior atração no Google for Jobs.
        </p>
      </div>
      <Switch
        checked={values.salaryDisclosed}
        onCheckedChange={(v) => onField('salaryDisclosed', v)}
      />
    </div>
  </div>
)
