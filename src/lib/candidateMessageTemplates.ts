// Mensagens prontas para o candidato. Variáveis substituídas antes do envio;
// nenhuma variável fica sem valor (usa-se um texto neutro quando falta dado).

export interface MessageTemplateContext {
  candidateName: string
  jobTitle: string
  stageLabel: string
}

export interface MessageTemplate {
  id: string
  label: string
  body: string
}

export const FREE_TEXT_TEMPLATE_ID = 'free'

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'interview',
    label: 'Convite para entrevista',
    body: 'Olá, {nome}! Tudo bem? Gostaríamos de convidar você para uma entrevista referente à vaga de {vaga}. Podemos combinar o melhor horário? Obrigado!',
  },
  {
    id: 'status',
    label: 'Atualização de status',
    body: 'Olá, {nome}! Passando para atualizar: sua candidatura para a vaga de {vaga} está na etapa "{etapa}". Qualquer novidade entraremos em contato.',
  },
  {
    id: 'approval',
    label: 'Aprovação',
    body: 'Olá, {nome}! Temos uma ótima notícia: você foi aprovado(a) na etapa "{etapa}" do processo para a vaga de {vaga}. Em breve enviaremos os próximos passos.',
  },
  {
    id: 'rejection',
    label: 'Reprovação',
    body: 'Olá, {nome}! Agradecemos muito o seu interesse na vaga de {vaga}. Infelizmente, neste momento não seguiremos com a sua candidatura. Desejamos sucesso!',
  },
]

const firstName = (name: string): string => name.trim().split(/\s+/)[0] || ''

/** Substitui {nome}, {vaga} e {etapa} pelos dados atuais do candidato. */
export function renderTemplate(body: string, ctx: MessageTemplateContext): string {
  const values: Record<string, string> = {
    nome: firstName(ctx.candidateName) || 'candidato(a)',
    vaga: ctx.jobTitle.trim() || 'a vaga',
    etapa: ctx.stageLabel.trim() || 'atual',
  }
  return body.replace(/\{(nome|vaga|etapa)\}/g, (_, key: string) => values[key])
}
