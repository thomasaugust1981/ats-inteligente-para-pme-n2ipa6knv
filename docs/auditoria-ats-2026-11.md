# Relatório de Auditoria — ATS Inteligente (v0.0.45)

**Data:** 2026-11-16 · **Tipo:** auditoria de revisão (nenhuma alteração de código de aplicação nesta rodada)

**Método:** inspeção do esquema live do backend (coleções + regras de API), hooks em `pocketbase/hooks/`, migrações e leitura integral das telas/serviços principais.

---

## 🔴 CRÍTICO

### C1. Atualização de cadastro de candidato por qualquer pessoa (suplantação de identidade)

- **Onde:** página de candidatura pública (`JobApplicationPage`) + `candidatesService.updateCandidate`.
- **Problema:** ao enviar a candidatura, o sistema busca o candidato pelo e-mail e, se já existe, **sobrescreve os dados dele** (nome, telefone, CPF, currículo) sem nenhuma autenticação. Qualquer pessoa que saiba o e-mail de um candidato pode substituir o currículo e os dados dele por outros — corrompe o Banco de Talentos, permite fraude em processos seletivos e fere a integridade exigida pela LGPD.
- **Sugestão:** exigir verificação de posse (link mágico/código por e-mail) antes de atualizar um cadastro existente; sem verificação, criar apenas um novo registro ou um "update pendente" para o candidato aprovar.

### C2. Dados sensíveis de DISC e organograma legíveis publicamente

- **Onde:** regras de API das coleções `disc_results`, `org_nodes` e `org_versions` (listagem pública no backend live).
- **Problema:** resultados de avaliação comportamental (dado sensível segundo LGPD) e a estrutura organizacional completa (nomes, cargos) de **todas** as organizações estão legíveis sem login — inclusive entre organizações concorrentes. O organograma público (`public/organograma.html`) não justifica regra pública na coleção inteira: ele deveria consumir apenas a versão publicada da empresa correta.
- **Sugestão:** travar list/view para usuários autenticados da mesma organização; expor um endpoint/hook só com os campos da versão publicada (nome, cargo, foto) para a página pública.

### C3. Exclusão LGPD deixa dados para trás

- **Onde:** `deleteCandidateRealLGPD` em `src/services/candidates.ts` (botões "Exclusão LGPD" no perfil e na lista).
- **Problema:** a rotina apaga candidaturas e o candidato (com o arquivo do currículo), mas **não apaga** `ai_scores`, `disc_results` nem `audit_logs` do titular — e esses permanecem legíveis por regras públicas (C2). O app mostra "Todos os registros pessoais foram removidos", o que não é verdade.
- **Sugestão:** estender a exclusão às coleções vinculadas (scores, DISC) e anonimizar/substituir a trilha de auditoria por um registro mínimo de conformidade ("titular solicitou exclusão em X"), sem o conteúdo pessoal.

### C4. Qualquer pessoa pode consultar dados pessoais pelo e-mail

- **Onde:** preenchimento automático ao sair do campo e-mail no formulário público de candidatura (`findByEmail` sem autenticação).
- **Problema:** a busca automática de "Bem-vindo(a) de volta" devolve nome, telefone, **CPF**, LinkedIn e localização de qualquer candidato existente para quem digitar o e-mail — enumeração e vazamento de PII, sem consentimento do titular para esse acesso.
- **Sugestão:** remover o pré-preenchimento público ou substituí-lo por link mágico por e-mail; no mínimo, devolver só o nome e pedir confirmação.

---

## 🟠 IMPORTANTE

### I1. Isolamento multi-empresa frágil nas telas de candidato

A lista filtra por empresa ativa, mas o **perfil** carrega qualquer candidato por ID da URL (sem filtro de organização), e as regras de API de `candidates`/`audit_logs` não reforçam org_id no servidor (a regra de update de `candidates` passa sem exigir autenticação coerente). Usuário de uma org consegue ver/alterar candidatos de outra via URL direta. Corrigir no servidor (regra por relação org→empresa), não só na UI.

### I2. Configuração do agente de score é global, não por organização

A coleção de configuração (`ai_agent_settings`) guarda um único registro; o hook resolve os pesos por vaga, mas o provedor/chave/régua global são compartilhados entre todas as orgs — uma org afeta o comportamento de IA das outras.

### I3. Chave de provedor de IA sem onde morar

O hook de provedor lê `settings.ai_api_key`, campo que não existe na coleção → a chave nunca persiste e o score pode operar sem provedor configurável (só nativo/env). Sintoma: usuário configura provedor em /agente-score e o valor se perde.

### I4. Promessa falsa de notificação ao candidato

A tela de confirmação de candidatura diz "Você receberá notificações a cada mudança de etapa", mas o hook de notificação avisa o **dono da etapa** (recrutador), nunca o candidato. Expectativa frustrada em produto.

### I5. E-mails com fallback global/hardcoded

No hook de notificação de etapas, quando não há configuração, o destinatário cai num e-mail padrão global e o remetente/nome citam "Tecnobrasil" fixo — e-mails de uma org podem sair com a marca de outra.

### I6. Consentimento LGPD apresentado como garantido quando não é

O card "Conformidade LGPD" do perfil exibe "Consentimento legal: Concedido e registrado" mesmo quando não há data de consentimento (faz fallback para a data de criação). O texto do termo é fixo no formulário, sem link para política de privacidade e com versão hardcoded ("LGPD-v1.0-2025") — renovar o termo exige deploy.

### I7. Dados órfãos e leitura crua de IDs no perfil

O perfil mostra "Fase atual: erp_integration" e "Canal de Origem: direct_link" (IDs brutos), enquanto o funil mostra rótulos bonitos — os mapas de rótulos existem duplicados em várias telas. E `ai_scores`/`disc_results` de candidaturas apagadas ficam órfãos (contagem de histórico distorce o painel de IA).

### I8. Sem paginação em todas as listas

`getFullList` em candidatos, candidaturas, auditoria e logs: com alguns milhares de registros o funil e o Banco de Talentos vão degradar visivelmente (mobile sofre primeiro).

### I9. Pontos cegos confirmados

Todos reais no código: agendamento de entrevista é client-side via Calendar do usuário, sem checagem de conflito server-side; botões WhatsApp/entrevista dependem de etapas padrão (vagas antigas sem "Integração ERP" não exibem o botão de dados admissionais); contagens do superadmin usam fallback quando o agregado falha; CTPS é coletado no formulário mas não sai no CSV Goldway.

---

## 🟡 MELHORIA

- **M1.** Validação de CPF/telefone inexistente no formulário público (aceita qualquer texto) — risco de dado inútil na Integração ERP/exportação.
- **M2.** Confirmação de exclusão LGPD inconsistente: `window.prompt` nativo no perfil vs. AlertDialog bonito na lista — padronizar no diálogo.
- **M3.** Fallback "Vanguard Soluções" hardcoded como nome de empresa na página de candidatura — usar a marca real ou vazio.
- **M4.** Rótulos de etapa/origem/senioridade duplicados em 4+ arquivos — extrair para um módulo único de rótulos.
- **M5.** Retenção de dados sem política: reprovados ficam no banco de talentos indefinidamente; falta prazo/limpeza automática configurável.
- **M6.** Duplo envio de candidatura: a checagem "já aplicou" é feita depois de salvar o candidato; uma corrida pode criar duas candidaturas — validar unicidade (candidate+job) no servidor.
- **M7.** Texto do consentimento menciona compartilhamento/revogação, mas não há canal do titular (link de exclusão self-service) — o "direito de exclusão" hoje só existe dentro do app do cliente.

---

## 🎯 Os 5 pontos que eu atacaria primeiro

1. **C1 — bloquear atualização de cadastro por terceiros** (perda de integridade de dados em produção hoje, com um e-mail qualquer).
2. **C2 — travar as regras públicas de `disc_results`/`org_nodes`/`org_versions`** (mudança pequena de regra de API e elimina o maior risco de vazamento entre orgs).
3. **C4 — tirar a consulta pública de PII por e-mail** (mesma superfície de ataque do C1, correção barata).
4. **C3 + I1 — exclusão LGPD completa e regras server-side por organização** (jurídico: o app afirma conformidade que não tem).
5. **I3 + I2 — persistir a chave de IA e escopar a configuração por organização** (a régua calibrável — diferencial comercial do produto — está parcialmente quebrada e compartilhada).
