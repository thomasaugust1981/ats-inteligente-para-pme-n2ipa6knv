// Etapa "Integração ERP" do funil: define os dados admissionais/documentais
// que o RH preenche nesta etapa e que alimentam a exportação Goldway
// (layout "Cadastro Profissional"). Os dados ficam em `candidates.erp_data`
// (JSON, migração 0022) — chaves = keys abaixo.
import type { Candidate, Job } from '@/types/ats'

export const ERP_STAGE_ID = 'erp_integration'

export type ErpIntegrationData = Record<string, string>

export interface ErpIntegrationFieldDef {
  key: string
  label: string
  essential?: boolean
  type?: 'text' | 'date' | 'number' | 'select'
  options?: string[]
  placeholder?: string
}

/** Campos que o ATS não coleta e o layout Goldway precisa (ordem do layout). */
export const ERP_INTEGRATION_FIELDS: ErpIntegrationFieldDef[] = [
  { key: 'pis', label: 'PIS', essential: true, placeholder: 'Ex.: 123.45678.90-1' },
  { key: 'ctps', label: 'CTPS (nº e série)', placeholder: 'Ex.: 12345678 / 000-1' },
  { key: 'data_admissao', label: 'Data de admissão', essential: true, type: 'date' },
  {
    key: 'vinculo',
    label: 'Tipo de vínculo',
    essential: true,
    type: 'select',
    options: ['Prazo Indeterminado', 'Prazo Determinado', 'Temporário', 'Estágio', 'Contrato PJ'],
  },
  {
    key: 'salario_contratado',
    label: 'Salário contratado (R$)',
    essential: true,
    type: 'number',
    placeholder: 'Ex.: 3500.00',
  },
  {
    key: 'cargo',
    label: 'Cargo (como registrado no ERP)',
    placeholder: 'Ex.: Auxiliar Administrativo',
  },
  { key: 'lotacao', label: 'Lotação / Departamento', placeholder: 'Ex.: Administrativo' },
  { key: 'data_nascimento', label: 'Data de nascimento', type: 'date' },
  {
    key: 'sexo',
    label: 'Sexo',
    type: 'select',
    options: ['Masculino', 'Feminino', 'Prefiro não informar'],
  },
  {
    key: 'estado_civil',
    label: 'Estado civil',
    type: 'select',
    options: ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'],
  },
  { key: 'nr_contrato', label: 'Nº do contrato de trabalho', placeholder: 'Ex.: 12345' },
  { key: 'banco', label: 'Banco', essential: true, placeholder: 'Ex.: 001 — Banco do Brasil' },
  { key: 'agencia', label: 'Agência', essential: true, placeholder: 'Ex.: 1234-5' },
  {
    key: 'tipo_conta',
    label: 'Tipo de conta',
    essential: true,
    type: 'select',
    options: ['Corrente', 'Poupança'],
  },
  { key: 'conta_digito', label: 'Conta / dígito', essential: true, placeholder: 'Ex.: 98765-4' },
  { key: 'cep', label: 'CEP', placeholder: 'Ex.: 01310-100' },
  { key: 'bairro', label: 'Bairro', placeholder: 'Ex.: Bela Vista' },
]

/** Lista dos campos essenciais (usada no aviso de avanço e no export). */
export const ERP_ESSENTIAL_FIELDS = ERP_INTEGRATION_FIELDS.filter((f) => f.essential)

/** Campos essenciais ainda vazios nos dados gravados do candidato. */
export function getMissingEssentialFields(
  data: ErpIntegrationData | null | undefined,
): ErpIntegrationFieldDef[] {
  const d = data || {}
  return ERP_ESSENTIAL_FIELDS.filter((f) => !(d[f.key] || '').trim())
}

const toInputDate = (iso?: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

const VINCULO_BY_EMPLOYMENT_TYPE: Record<string, string> = {
  clt: 'Prazo Indeterminado',
  pj: 'Contrato PJ',
  internship: 'Estágio',
  temporary: 'Temporário',
}

/**
 * Pré-preenche o formulário: dados já gravados na etapa + sugestões vindas da
 * vaga (cargo, lotação, vínculo, salário) e da candidatura (data de admissão =
 * entrada na etapa). Só sugere quando o campo está vazio.
 */
export function buildErpFormDefaults(
  candidate: Pick<Candidate, 'erp_data'> | null | undefined,
  job: Pick<
    Job,
    'title' | 'department' | 'employment_type' | 'salary_max' | 'salary_disclosed'
  > | null,
  admissionIso?: string,
): ErpIntegrationData {
  const saved = (candidate?.erp_data || {}) as ErpIntegrationData
  const out: ErpIntegrationData = {}
  for (const f of ERP_INTEGRATION_FIELDS) out[f.key] = String(saved[f.key] || '')
  if (!out.cargo) out.cargo = job?.title || ''
  if (!out.lotacao) out.lotacao = job?.department || ''
  if (!out.vinculo)
    out.vinculo = VINCULO_BY_EMPLOYMENT_TYPE[String(job?.employment_type || '')] || ''
  if (!out.salario_contratado && job?.salary_disclosed && job?.salary_max) {
    out.salario_contratado = String(job.salary_max)
  }
  if (!out.data_admissao) out.data_admissao = toInputDate(admissionIso)
  return out
}

/** Resumo somente-leitura dos dados que o ATS já possui do candidato. */
export function candidateKnownFields(candidate: Candidate): { label: string; value: string }[] {
  return [
    { label: 'Nome completo', value: candidate.name || '' },
    { label: 'CPF', value: candidate.cpf || '' },
    { label: 'Telefone', value: candidate.phone || '' },
    { label: 'E-mail', value: candidate.email || '' },
    { label: 'Endereço', value: candidate.location || '' },
  ].filter((f) => f.value)
}
