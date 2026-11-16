import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Wrench,
  HeartHandshake,
  Link2,
  ExternalLink,
  ShieldCheck,
  History,
  CircleAlert,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChaSection } from './ChaSection'
import {
  CHA_BLOCK_KEYS,
  CHA_BLOCK_META,
  CHA_LEVEL_LABELS,
  buildChaRequirements,
  emptyChaRequirements,
  parseJobCha,
  type ChaBlockKey,
} from '@/lib/cha'
import type { Cargo } from '@/types/ats'
import type { JobFormValues, JobFormErrors, SetJobFormField } from './types'

const BLOCK_ICONS: Record<ChaBlockKey, React.ElementType> = {
  conhecimentos: BookOpen,
  habilidades: Wrench,
  atitudes: HeartHandshake,
}

interface Props {
  values: JobFormValues
  errors: JobFormErrors
  onField: SetJobFormField
  cargos: Cargo[]
  cargosLoading: boolean
  /** CHA efetivo em edição (carregado da vaga). Vazio em criação. */
  chaRequirements: ReturnType<typeof parseJobCha>
  onChaSpecificChange: (req: ReturnType<typeof parseJobCha>) => void
  /** Converte a descrição legada em rascunho dos requisitos específicos. */
  onConvertLegacy: () => void
  hasLegacyText: boolean
}

/**
 * FASE 1 CHA — vínculo da vaga com o cargo:
 * requisito do cargo (somente leitura, fonte = cargo) + requisitos específicos
 * da vaga (editáveis). A publicação exige os três blocos não vazios.
 */
export const ChaInheritCard: React.FC<Props> = ({
  values,
  errors,
  onField,
  cargos,
  cargosLoading,
  chaRequirements,
  onChaSpecificChange,
  onConvertLegacy,
  hasLegacyText,
}) => {
  const selectedCargo = useMemo(
    () => cargos.find((c) => c.id === values.cargoId) || null,
    [cargos, values.cargoId],
  )

  const handleCargoChange = (cargoId: string) => {
    const cargo = cargos.find((c) => c.id === cargoId) || null
    if (!cargo) {
      // Desvincular: zera tudo
      onField('cargoId', '')
      onChaSpecificChange(emptyChaRequirements())
      return
    }
    onField('cargoId', cargoId)
    // Herda automaticamente os requisitos CHA do cargo
    onChaSpecificChange(buildChaRequirements(cargo.cha))
  }

  const cargoBlocks = CHA_BLOCK_KEYS.filter(
    (k) => (selectedCargo?.cha?.[k]?.items || []).length > 0,
  )
  const specificBlocks = CHA_BLOCK_KEYS.filter(
    (k) => (chaRequirements?.specific?.[k]?.items || []).length > 0,
  )

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Link2 className="w-4 h-4 text-sky-600" />
          Cargo &amp; requisitos CHA
        </CardTitle>
        <CardDescription className="text-xs">
          Vincule a vaga a um cargo para herdar os requisitos CHA; adicione depois o que for
          específico desta vaga.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seleção do cargo */}
        <div className="space-y-1.5 max-w-sm">
          <Label>Cargo (da organização)</Label>
          <Select value={values.cargoId || ''} onValueChange={handleCargoChange}>
            <SelectTrigger>
              <SelectValue
                placeholder={cargosLoading ? 'Carregando cargos…' : 'Sem cargo vinculado'}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem cargo vinculado (vaga genérica)</SelectItem>
              {cargos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                  {c.level ? ` — ${CHA_LEVEL_LABELS[c.level] || c.level}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCargo ? (
            <p className="text-[11px] text-slate-500">
              Requisitos do cargo herdados automaticamente
              {selectedCargo.area ? ` · Área: ${selectedCargo.area}` : ''}.
              <Link to="/cargos" className="text-sky-600 hover:underline inline-flex items-center">
                <ExternalLink className="w-3 h-3 inline ml-1" />
                Editar cargo
              </Link>
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">
              Sem cargo vinculado, preencha os requisitos específicos abaixo — os três blocos CHA
              são obrigatórios para publicar.
            </p>
          )}
        </div>

        {/* Descrição legada (compatibilidade) */}
        {hasLegacyText && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">
                Descrição legada (texto livre)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 whitespace-pre-wrap line-clamp-3">
              {values.requirements}
            </p>
            <p className="text-[11px] text-slate-500">
              O texto legado é preservado e exibido como leitura. Para convertê-lo nos blocos CHA,
              transcreva manualmente ou use o botão abaixo para copiar como rascunho dos requisitos
              específicos.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={onConvertLegacy}
            >
              Converter legado em rascunho CHA
            </Button>
          </div>
        )}

        {/* Requisitos do cargo — somente leitura */}
        {selectedCargo && cargoBlocks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-800">
                Requisitos do cargo — somente leitura (fonte: {selectedCargo.title})
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {cargoBlocks.map((k) => (
                <div key={k} className="border rounded-md p-2 bg-emerald-50/40 border-emerald-200">
                  <div className="flex items-center gap-1.5 mb-1">
                    {React.createElement(BLOCK_ICONS[k], { className: 'w-3 h-3 text-emerald-700' })}
                    <span className="text-[11px] font-semibold text-emerald-900">
                      {CHA_BLOCK_META[k].label}
                    </span>
                  </div>
                  <ul className="text-[11px] text-slate-600 space-y-0.5 list-disc list-inside">
                    {(selectedCargo.cha?.[k]?.items || []).slice(0, 4).map((it) => (
                      <li key={it.id} className="truncate">
                        {it.description}
                        {!it.required && ' (desejável)'}
                      </li>
                    ))}
                    {(selectedCargo.cha?.[k]?.items || []).length > 4 && (
                      <li className="text-slate-400">
                        + {(selectedCargo.cha?.[k]?.items || []).length - 4} outro(s)
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Estes requisitos vêm do cargo e não podem ser editados aqui — altere em{' '}
              <Link to="/cargos" className="text-sky-600 hover:underline">
                Cargos
              </Link>
              .
            </p>
          </div>
        )}

        {/* Requisitos específicos da vaga — editáveis */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <CircleAlert className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-xs font-semibold text-sky-800">
              Requisitos específicos da vaga — editáveis
            </span>
          </div>
          <ChaSection
            value={chaRequirements?.specific || emptyChaRequirements().specific}
            onChange={(specific) =>
              onChaSpecificChange({ cargo: chaRequirements?.cargo ?? null, specific })
            }
            errors={errors as Record<string, string>}
          />
          {specificBlocks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {specificBlocks.map((k) => (
                <Badge key={k} variant="secondary" className="text-[10px] gap-1">
                  {React.createElement(BLOCK_ICONS[k], { className: 'w-3 h-3' })}
                  {CHA_BLOCK_META[k].label}: {(chaRequirements?.specific?.[k]?.items || []).length}{' '}
                  requisito(s)
                </Badge>
              ))}
            </div>
          )}
        </div>

        {(errors.cha || errors.chaInherit) && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1.5">
            {errors.cha || errors.chaInherit}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
