import pb from '@/lib/pocketbase/client'
import { withFreshToken } from '@/lib/pocketbase/freshToken'

/**
 * Carta de proposta (coleção "offer_letters", migração 0055): o texto gerado
 * na etapa "Proposta" do pipeline, editável, por candidatura. API padrão do
 * SDK com withFreshToken (rotas /backend/v1/* dão 401 em runtime). Isolamento
 * por org garantido pelas regras da coleção.
 */

export interface OfferLetter {
  id: string
  org_id?: string
  application_id: string
  content: string
  sent?: boolean
  created: string
  updated: string
}

export interface OfferLetterInput {
  application_id: string
  content: string
  sent?: boolean
}

/** Fallback quando a organização não tem template próprio (campo da mig 0053). */
export const DEFAULT_PROPOSAL_LETTER = `{{empresa}}

Brasil, {{data}}.

À candidato(a) {{candidato}},

Temos grande satisfação em formalizar nossa proposta para a posição de {{cargo}} em nossa empresa. Após todas as etapas do processo seletivo, ficamos muito felizes em convidá-lo(a) a fazer parte do nosso time.

Detalhes da proposta:

• Cargo: {{cargo}}
• Remuneração: {{salario}}
• Data de início prevista: {{data_inicio}}

Acreditamos que suas competências e experiências serão valiosas para alcançarmos nossos objetivos, e esperamos que esta proposta represente o início de uma parceria de sucesso e crescimento mútuo.

Solicitamos, gentilmente, uma resposta até {{prazo}}, confirmando seu aceite.

Estamos à disposição para esclarecer qualquer dúvida.

Atenciosamente,

Equipe de Recrutamento e Seleção
{{empresa}}`

/** Substitui os placeholders do modelo pelos dados reais da candidatura. */
export function renderProposalLetter(
  template: string,
  data: {
    candidato: string
    cargo: string
    empresa: string
    salario: string
    dataInicio?: string
    prazo?: string
  },
): string {
  const hoje = new Date().toLocaleDateString('pt-BR')
  const map: Record<string, string> = {
    candidato: data.candidato,
    cargo: data.cargo,
    empresa: data.empresa,
    salario: data.salario || 'a definir',
    data_inicio: data.dataInicio || 'a combinar',
    prazo: data.prazo || 'a combinar',
    data: hoje,
  }
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => map[key] ?? `{{${key}}}`)
}

export const offerLettersService = {
  /** Carta mais recente da candidatura (ou null). */
  async findForApplication(applicationId: string): Promise<OfferLetter | null> {
    const rows = await withFreshToken(() =>
      pb.collection('offer_letters').getList<OfferLetter>(1, 1, {
        filter: `application_id = "${applicationId}"`,
        sort: '-updated',
      }),
    )
    return rows.items[0] || null
  },

  /** Texto-base: template da organização (mig 0053) ou o default acima. */
  async getTemplate(orgId: string): Promise<string> {
    try {
      const org = await withFreshToken(() =>
        pb.collection('organizations').getOne<{ proposal_letter_template?: string }>(orgId),
      )
      const tpl = org?.proposal_letter_template
      if (typeof tpl === 'string' && tpl.trim()) return tpl
    } catch (_) {
      // sem permissão/erro de rede — cai no default
    }
    return DEFAULT_PROPOSAL_LETTER
  },

  /** Cria ou atualiza a carta da candidatura (uma por candidatura). */
  async save(input: OfferLetterInput, existingId?: string): Promise<OfferLetter> {
    const user = pb.authStore.record as (Record<string, unknown> & { org_id?: string }) | null
    if (!pb.authStore.isValid || !user?.org_id) {
      throw new Error('Autenticação necessária.')
    }
    const payload = { org_id: user.org_id, ...input }
    if (existingId) {
      return await withFreshToken(() =>
        pb.collection('offer_letters').update<OfferLetter>(existingId, payload),
      )
    }
    return await withFreshToken(() => pb.collection('offer_letters').create<OfferLetter>(payload))
  },
}
