/**
 * Modelos prontos de cargo com CHA pré-preenchido — PME brasileira.
 * Estrutura alinhada com ChaData (src/lib/cha.ts): cada bloco tem itens
 * { description, required, weight 1-5 }. É SUGESTÃO editável: o formulário
 * sempre deixa revisar antes de gravar.
 */
import type { ChaBlockKey, ChaData, ChaItem } from '@/lib/cha'
import { CHA_BLOCK_KEYS, chaItem } from '@/lib/cha'

export interface CargoTemplate {
  id: string
  title: string
  area: string
  level: string // ChaLevel ou ''
  mission: string
  salaryMin: number | null
  salaryMed: number | null
  salaryMax: number | null
  cha: ChaData
}

type Block = { description: string; required: boolean; weight: number }

/** Converte um item de template (sem id) em ChaItem com id. */
const item = (b: Block): ChaItem => ({ ...b, id: chaItem().id })

const t = (
  id: string,
  title: string,
  area: string,
  level: string,
  mission: string,
  salary: [number | null, number | null, number | null],
  conhecimentos: Block[],
  habilidades: Block[],
  atitudes: Block[],
): CargoTemplate => ({
  id,
  title,
  area,
  level,
  mission,
  salaryMin: salary[0],
  salaryMed: salary[1],
  salaryMax: salary[2],
  cha: {
    conhecimentos: { items: conhecimentos.map(item) },
    habilidades: { items: habilidades.map(item) },
    atitudes: { items: atitudes.map(item) },
  },
})

export const CARGO_TEMPLATES: CargoTemplate[] = [
  t(
    'vendedor-loja',
    'Vendedor de Loja',
    'Comercial',
    'operacional',
    'Atender clientes no balcão, demonstrar produtos e fechar vendas com metas mensais.',
    [1512, 1800, 2200],
    [
      { description: 'Técnicas de vendas e negociação', required: true, weight: 5 },
      { description: 'Conhecimento do mix de produtos da loja', required: true, weight: 4 },
      { description: 'Noções de PDV e fechamento de caixa', required: false, weight: 3 },
      { description: 'Matemática básica para troco e descontos', required: true, weight: 3 },
    ],
    [
      { description: 'Abordagem e demonstração de produto', required: true, weight: 5 },
      { description: 'Contorna objeções e fecha a venda', required: true, weight: 5 },
      { description: 'Organização de vitrine e estoque de loja', required: false, weight: 2 },
      {
        description: 'Comunicação clara com diferentes perfis de cliente',
        required: true,
        weight: 4,
      },
    ],
    [
      { description: 'Simpatia e vontade de atender bem', required: true, weight: 5 },
      { description: 'Orientação a meta e resultado', required: true, weight: 5 },
      { description: 'Pontualidade e assiduidade', required: true, weight: 4 },
      { description: 'Trabalho em equipe', required: true, weight: 3 },
    ],
  ),
  t(
    'analista-administrativo',
    'Analista Administrativo',
    'Administrativo',
    'pleno',
    'Dar suporte às rotinas administrativas: contas a pagar/receber, compras e relatórios.',
    [2400, 3000, 3800],
    [
      { description: 'Rotinas de contas a pagar e receber', required: true, weight: 5 },
      { description: 'Excel intermediário (tabelas e filtros)', required: true, weight: 5 },
      { description: 'Emissão e conferência de notas fiscais', required: false, weight: 3 },
      { description: 'Legislação trabalhista básica', required: false, weight: 2 },
    ],
    [
      { description: 'Organização de documentos e prazos', required: true, weight: 5 },
      { description: 'Uso de planilhas e sistemas internos (ERP)', required: true, weight: 4 },
      { description: 'Conciliação bancária e fechamento mensal', required: false, weight: 3 },
      { description: 'Redação clara de e-mails e relatórios', required: true, weight: 3 },
    ],
    [
      { description: 'Atenção a detalhes', required: true, weight: 5 },
      { description: 'Proatividade para resolver pendências', required: true, weight: 4 },
      { description: 'Discrição com dados confidenciais', required: true, weight: 4 },
      { description: 'Organização pessoal', required: true, weight: 3 },
    ],
  ),
  t(
    'atendente',
    'Atendente',
    'Atendimento',
    'operacional',
    'Atender clientes por telefone/WhatsApp, registrar solicitações e encaminhar ao time correto.',
    [1412, 1600, 1900],
    [
      { description: 'Técnicas de atendimento ao cliente', required: true, weight: 5 },
      { description: 'Operação de sistemas de atendimento (CRM)', required: false, weight: 3 },
      { description: 'Português correto para escrita no chat', required: true, weight: 4 },
    ],
    [
      { description: 'Escuta ativa e clareza na explicação', required: true, weight: 5 },
      { description: 'Resolução de problemas no primeiro contato', required: true, weight: 4 },
      { description: 'Registro correto da solicitação no sistema', required: true, weight: 3 },
      { description: 'Gerenciamento de fila de atendimentos', required: false, weight: 2 },
    ],
    [
      { description: 'Paciência e cordialidade', required: true, weight: 5 },
      { description: 'Autocontrole sob pressão', required: true, weight: 4 },
      { description: 'Empatia com o cliente', required: true, weight: 5 },
      { description: 'Comprometimento com prazos', required: true, weight: 3 },
    ],
  ),
  t(
    'auxiliar-administrativo',
    'Auxiliar Administrativo',
    'Administrativo',
    'operacional',
    'Apoiar rotinas de escritório: arquivo, digitalização, agendamentos e apoio ao time.',
    [1412, 1600, 1900],
    [
      { description: 'Rotinas de escritório e arquivo', required: true, weight: 5 },
      { description: 'Pacote Office básico (Word e Excel)', required: true, weight: 4 },
      { description: 'Noções de atendimento telefônico', required: true, weight: 3 },
    ],
    [
      { description: 'Organização e controle de documentos', required: true, weight: 5 },
      { description: 'Digitação e preenchimento de planilhas', required: true, weight: 4 },
      { description: 'Apoio em rotinas de RH e compras', required: false, weight: 2 },
      { description: 'Comunicação com fornecedores e clientes', required: true, weight: 3 },
    ],
    [
      { description: 'Organização e método', required: true, weight: 5 },
      { description: 'Simpatia no contato com pessoas', required: true, weight: 4 },
      { description: 'Vontade de aprender', required: true, weight: 4 },
      { description: 'Assiduidade e pontualidade', required: true, weight: 4 },
    ],
  ),
  t(
    'motorista',
    'Motorista',
    'Logística',
    'operacional',
    'Dirigir veículo da empresa nas entregas/rotas, conferindo cargas e cumprindo o cronograma.',
    [1600, 1900, 2400],
    [
      {
        description: 'Legislação de trânsito (CNH na categoria exigida)',
        required: true,
        weight: 5,
      },
      { description: 'Rotas e malha viária da região', required: true, weight: 4 },
      { description: 'Noções de carga/descarga e conferência', required: false, weight: 3 },
      { description: 'Manutenção preventiva básica do veículo', required: false, weight: 2 },
    ],
    [
      { description: 'Direção defensiva', required: true, weight: 5 },
      { description: 'Conferência de notas e cargas', required: true, weight: 4 },
      { description: 'Registro de quilometragem e abastecimento', required: true, weight: 3 },
      { description: 'Comunicação com a base durante a rota', required: true, weight: 3 },
    ],
    [
      { description: 'Responsabilidade com o veículo e a carga', required: true, weight: 5 },
      { description: 'Calma no trânsito', required: true, weight: 4 },
      { description: 'Pontualidade nas entregas', required: true, weight: 5 },
      { description: 'Honestidade', required: true, weight: 5 },
    ],
  ),
  t(
    'professor',
    'Professor',
    'Educação',
    'pleno',
    'Planejar e ministrar aulas conforme a proposta pedagógica, avaliando e acompanhando alunos.',
    [2200, 3000, 4000],
    [
      { description: 'Didática e planejamento de aula', required: true, weight: 5 },
      { description: 'Domínio do conteúdo da disciplina', required: true, weight: 5 },
      { description: 'Metodologias ativas de aprendizagem', required: false, weight: 3 },
      { description: 'Normas da LDB e da instituição', required: false, weight: 2 },
    ],
    [
      { description: 'Comunicação didática com turmas variadas', required: true, weight: 5 },
      { description: 'Elaboração de avaliações e correção', required: true, weight: 4 },
      { description: 'Gestão de sala de aula', required: true, weight: 5 },
      { description: 'Uso de recursos digitais em aula', required: false, weight: 2 },
    ],
    [
      { description: 'Paciência e sensibilidade com alunos', required: true, weight: 5 },
      { description: 'Comprometimento com a aprendizagem', required: true, weight: 5 },
      { description: 'Abertura para feedback', required: true, weight: 3 },
      { description: 'Pontualidade e presença', required: true, weight: 4 },
    ],
  ),
  t(
    'coordenador-pedagogico',
    'Coordenador Pedagógico',
    'Educação',
    'senior',
    'Coordenar a equipe docente, o plano pedagógico e a qualidade do ensino da instituição.',
    [4000, 5000, 6500],
    [
      { description: 'Gestão pedagógica e currículo escolar', required: true, weight: 5 },
      { description: 'Legislação educacional (LDB, BNCC)', required: true, weight: 4 },
      { description: 'Formação e desenvolvimento de professores', required: true, weight: 4 },
      { description: 'Indicadores de desempenho escolar', required: false, weight: 3 },
    ],
    [
      { description: 'Liderança e mentoria de professores', required: true, weight: 5 },
      { description: 'Planejamento acadêmico anual', required: true, weight: 5 },
      { description: 'Mediação de conflitos com pais e alunos', required: true, weight: 4 },
      { description: 'Análise de resultados e planos de melhoria', required: true, weight: 3 },
    ],
    [
      { description: 'Liderança inspiradora', required: true, weight: 5 },
      { description: 'Escuta e diálogo com a equipe', required: true, weight: 5 },
      { description: 'Organização e visão de longo prazo', required: true, weight: 4 },
      { description: 'Compromisso com a qualidade do ensino', required: true, weight: 5 },
    ],
  ),
  t(
    'gerente-comercial',
    'Gerente Comercial',
    'Comercial',
    'senior',
    'Liderar a equipe de vendas, definir metas e estratégias e ser responsável pelo resultado da área.',
    [5000, 7000, 9500],
    [
      { description: 'Gestão comercial e metas (funil, pipeline)', required: true, weight: 5 },
      { description: 'Ferramentas de CRM e indicadores', required: true, weight: 4 },
      { description: 'Precificação e margem por produto', required: false, weight: 3 },
      { description: 'Mercado e concorrência do setor', required: true, weight: 4 },
    ],
    [
      { description: 'Liderança de equipe de vendas', required: true, weight: 5 },
      { description: 'Planejamento comercial e previsão', required: true, weight: 5 },
      { description: 'Negociação com grandes clientes', required: true, weight: 4 },
      { description: 'Análise de indicadores e planos de ação', required: true, weight: 4 },
    ],
    [
      { description: 'Orientação a resultado', required: true, weight: 5 },
      { description: 'Liderança com exemplo', required: true, weight: 5 },
      { description: 'Resiliência sob pressão', required: true, weight: 4 },
      { description: 'Espírito de dono', required: true, weight: 4 },
    ],
  ),
]

export const templateTitles = () => CARGO_TEMPLATES.map((tpl) => tpl.title)

/** Aplica um template sobre os valores de CHA atuais (substitui os 3 blocos). */
export const applyTemplateCha = (tpl: CargoTemplate): ChaData => {
  const out = {} as ChaData
  for (const key of CHA_BLOCK_KEYS as unknown as ChaBlockKey[]) {
    out[key] = {
      items: (tpl.cha[key]?.items || []).map((it) => ({ ...it })),
    } as never
  }
  return out
}
