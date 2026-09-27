# 📊 Bench dos dois admins: features e filosofia

> Data: 26/09/2026. Compara o **admin v1.0** (arquivado, em `.archive/v1.0_site/app/admin/`) com o **admin novo** (`apps/admin` + `apps/api`) e os dois contra o mercado.
>
> **Leitura do pedido:** interpretei "os dois sistemas" como o admin v1.0 e o admin novo. Se você se referia a outros dois, o mercado abaixo pode ser trocado. A referência "SOLYD" do `ARCHITECTURE.md` não foi localizada em pesquisa e ficou de fora.
>
> **Método:** leitura do código dos dois admins e consulta à documentação oficial de Pipedrive, HubSpot e RD Station. Nada foi executado. As linhas de mercado sem fonte são conhecimento geral, sem teste prático.

---

## 1. Resumo

1. **O v1.0 tem amplitude sem dados; o novo tem dados sem amplitude.** O v1.0 desenha quase tudo que o produto precisa (captura, atribuição, funil, clientes, chaves, blog), mas é mock. O novo funciona de verdade (API, banco, arrastar e soltar, notas), mas cobre uma fração.
2. **O novo perdeu justamente o que é diferente no Kalidash:** captura por script, atribuição de origem, projetos conectados e métricas de conversão. Ficou um CRM genérico e bonito.
3. **A "Filosofia 2" foi decidida com uma premissa errada.** A sessão do Antigravity disse que o Pipedrive "abole a tabela de Lead". O Pipedrive tem uma **Leads Inbox separada** dos negócios. E o HubSpot não é "modelo Salesforce": usa um contato único com fase do ciclo de vida. Ver seção 4.
4. **Mesmo assim, a decisão serve ao Kalidash.** O formulário do site é de diagnóstico B2B, com poucos leads e já semi-qualificados. Uma coluna de entrada resolve, desde que o **registro do envio** e uma **visão Leads** existam. É o que os docs v2.0 já descrevem.
5. **Há botões e telas que aparentam funcionar e não funcionam** (busca, filtro, Perdido, equipe, tarefas, funis). Estão listados na seção 3.

---

## 2. Os dois sistemas em uma página

| | **Admin v1.0** (arquivado) | **Admin novo** |
|---|---|---|
| Stack | Next.js 15 dentro do site | Vite + React 18, API em Go, MySQL |
| Estado | **Mock.** Dados no navegador; `data.ts` hoje tem as listas de leads e clientes vazias. O blog era real (Sanity). | **Real.** Lê e grava no MySQL pela API. |
| Módulos | Inbound/Leads, Pipelines, Clientes, Projetos conectados, Integrações, Chaves de API, Blog, Configurações (Equipe), página de docs para devs | CRM (Kanban e tabela), E-mails (editor e automações), Configurações (modal) |
| Objeto central | **Lead**, com origem, score e valor. Ao fechar, vira **Cliente** e mantém o vínculo com o lead que o originou. | **Oportunidade** (com empresa e contato opcionais) |
| Etapas | 5 fixas: Novo, Qualificado, Em contato, Em negociação, Convertido | `INBOUND`, `QUALIFICATION`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST` no schema; a tela mostra 3 |
| Filosofia | **Captação primeiro.** Tudo nasce de um envio com origem e atribuição; a conta é um segundo objeto com saúde e próxima ação. | **Funil primeiro.** Sem tabela de Lead; cada envio já cria pessoa, empresa e oportunidade na primeira coluna. |
| Visual | Editorial, em CSS Modules | Estilo Linear/Stripe: modo escuro, gaveta lateral, transições |

---

## 3. Bench de features

**Legenda:** *Mock* = existe só como interface, sem backend. *Real* = grava no banco. *Parcial* = existe, com partes que não funcionam. *Não tem*.
**Prioridade:** Alta, Média ou Baixa, para o escopo do Kalidash (site institucional + admin interno).

| Feature | Admin v1.0 | Admin novo | Como o mercado faz | Prioridade |
|---|---|---|---|---|
| **Captura por script e token** (o "integrador") | Mock: gerador de snippet, contrato do payload, escopos, página de exemplo | Não tem | HubSpot: formulários e código de rastreamento. Pipedrive: Web Forms. Pipefy: formulário público que abre um card. | **Alta**: é o motivo do integrador |
| **Origem e atribuição** (canal, landing, UTM) | Mock: canal de entrada, origem clicável, landing, UTM source/medium/campaign | Não tem | HubSpot guarda a origem original do contato automaticamente | **Alta** |
| **Projetos conectados** e métricas por LP | Mock: feed de projetos, formulários rastreados, métricas por projeto | Não tem | Sem equivalente direto; é o diferencial do Kalidash | **Alta** |
| **Chaves de API com escopo** | Mock: live/test, prefixo visível, revogação, escopos | Não tem (só o rótulo "Integrações (API)" nas Configurações) | Padrão em ferramentas de integração | **Alta** |
| **Estagnação** (dias na etapa e alerta) | Mock: dias na etapa, alerta acima de 14 dias, média por etapa | Não tem | Pipedrive marca negócios parados como "rotting" | **Alta**: barato e útil |
| **Funil de conversão e métricas** | Mock: funil por alcance de etapa, matriz de ocupação, conversão %, dias até virar cliente | Não tem | Relatórios e dashboards são padrão em todos | **Alta** |
| **Busca, filtros, ordenação, CSV** | Mock: filtro por etapa e extras, ordenação, exportar CSV | **Só aparência**: o campo de busca e o botão Filtro não têm lógica ligada | Filtros salvos e importação/exportação CSV são padrão | **Alta** |
| **Ganho e Perdido com motivo** | n/d | Parcial: "Marcar como ganho" grava no banco; **"Marcar como perdido" não faz nada** e não há motivo da perda nem coluna LOST | HubSpot e Pipedrive registram o motivo da perda | **Alta** |
| **Próxima atividade / tarefas** | Mock: "próxima ação" na ficha do cliente | Placeholder: a aba Tarefas está vazia | Pipedrive gira em torno de sempre haver uma atividade agendada por negócio | **Alta** |
| Kanban com arrastar e soltar | Board por etapa na visão Pipelines (não confirmei se move cards) | **Real**: 3 colunas, arrastar e soltar, total por coluna | Padrão | Média: faltam `PROPOSAL`, `NEGOTIATION` e `LOST` na tela |
| Etapas e funis configuráveis | 5 etapas fixas | Parcial: 3 funis escritos no código; o construtor **não persiste** e o banco não tem campo de funil | Pipedrive e HubSpot: vários funis, etapas editáveis. Pipefy: fases e campos por pipe. | Média |
| Valor da oportunidade e totais | Mock: valor por lead, por etapa e médio | **Real**: valor editável inline e total por coluna (campo `Float`) | Pipedrive e HubSpot: previsão ponderada | Média |
| Ficha da oportunidade | Mock: painel lateral redimensionável | **Real**: gaveta com abas Visão Geral, Anotações, Tarefas, E-mails; edição inline; notas por tipo (nota, ligação, e-mail, reunião) | HubSpot: linha do tempo unificada | Média |
| **Clientes** (contas) | Mock: ficha por slug (serviço, responsável, valor, próxima ação, saúde), ligada ao lead de origem | Só empresa e contato dentro do card; sem tela | HubSpot Companies; Salesforce Accounts | Média: derivável da Empresa com `WON` |
| E-mail | Não tem | Parcial: editor visual, templates e regras **só em memória**; o envio de teste usa um contrato que a API não aceita | Pipedrive e HubSpot sincronizam a caixa e rastreiam abertura. RD Station envia e-mail por automação. | Média: fora do escopo original |
| Automações (regra → ação) | Não tem | Só a interface de regras, em memória | RD Station CRM: criar tarefa, enviar e-mail, trocar responsável, mover no funil | Média |
| Blog / CMS | **Real** (Sanity, descartado) | Não tem (Tiptap instalado, sem telas) | — | Média |
| Equipe e perfis | Mock | Tela **estática**, com 1 usuário fixo (Administrador), sem login | Padrão | Alta, mas é segurança, que ficou para o fim |
| Score do lead | Mock: coluna de score | Não tem | HubSpot pontua em planos Professional+. RD Station prioriza negociações com IA. | Baixa: volume pequeno |
| **WhatsApp** | Não tem | Não tem | RD Station CRM opera negociações pelo WhatsApp | **Decisão:** entra ou fica fora do escopo? |
| Duplicidade e mesclagem, importação CSV | Não tem | Não tem | Padrão nos CRMs | Média |
| Persistência | Dados no navegador | **MySQL via API** | — | — |

**Telas que parecem funcionar e não funcionam no admin novo:** busca da tabela, botão Filtro, "Marcar como perdido", seletor de funis (os dois últimos funis não têm dados, porque o banco não guarda o funil), construtor de funil, equipe, aba Tarefas, regras de automação de e-mail e o envio de teste.

---

## 4. Bench de filosofia

### O que o mercado faz (o espectro real)

| Produto | Filosofia | Como trata o lead | Lição para o Kalidash |
|---|---|---|---|
| **Pipedrive** | Venda por **atividades**: o funil é o produto, e cada negócio deve ter sempre a próxima atividade agendada. | **Leads Inbox separada** dos negócios. O lead é convertido em negócio, escolhendo funil, valor e data prevista. Ele não abole o lead. | Tornar a **próxima atividade** obrigatória evita cards esquecidos. |
| **HubSpot** | **Contato no centro**: marketing, vendas e atendimento no mesmo registro. | Não há lead separado no núcleo: o contato muda de **fase do ciclo de vida** (Lead → MQL → SQL → Oportunidade → Cliente). | Casa com "lead é o cliente que ainda não virou cliente", que foi sua pergunta. |
| **Salesforce** | **Configurável e empresarial**: muito ajuste, muito processo. | **Objeto Lead separado**, convertido em Conta + Contato + Oportunidade. | É o que a sessão anterior chamou de "Filosofia 1": pesado demais para o volume do Kalidash. |
| **Pipefy** | **Processo, não venda**: cards atravessam fases de um fluxo com formulários e regras, para qualquer área. | Todo item é um card em uma fase. | Base do "tudo é card". Vale para o fluxo do formulário, menos para vendas. |
| **RD Station CRM** | CRM brasileiro **integrado ao marketing**: funil, automações e WhatsApp. | Negociações no funil, alimentadas pelos leads da RD Marketing. | É o mais próximo do contexto de vocês (os fundadores vêm da RD Station). |

### As duas filosofias do Kalidash

| | **v1.0: captação primeiro** | **Novo: funil primeiro** |
|---|---|---|
| Pergunta central | "De onde veio e o que ele fez?" | "Em que etapa está e quanto vale?" |
| Lead | Objeto próprio, com origem, score e dias parado | Não existe: o envio vira pessoa, empresa e oportunidade |
| Cliente | Objeto próprio, com saúde e próxima ação | Empresa com uma oportunidade ganha |
| Ponto forte | Atribuição e leitura de campanha; o integrador é o produto | Simplicidade e velocidade: bate o olho no Kanban e vê tudo |
| Ponto fraco | Mais objetos e telas, e nada ligado a dados reais | Mistura quem só deixou o e-mail com negociação real no mesmo Kanban. Os cards sem valor puxam para baixo o "valor em pipeline". Perde o histórico de cada envio. |

### Veredito

- A **Filosofia 2 é adequada ao volume e ao perfil do Kalidash** (formulário de diagnóstico B2B, poucos leads, alguns campos já qualificam). Não vale trocar por um objeto Lead separado.
- O que a decisão ignorou e precisa voltar: o **registro de cada envio** (payload, origem, UTM, página) e uma **visão Leads** (oportunidades em `INBOUND`, sem dono), que era o seu pedido de 01/09. Os docs v2.0 já descrevem isso com `LeadSubmission`.
- O "valor em pipeline" deve **excluir `INBOUND`** ou tratar valor vazio como zero, para os cards recém-chegados não distorcerem a previsão.
- O v1.0 acerta na **leitura de campanha**; o novo acerta na **operação diária**. O produto certo junta os dois: o funil do novo com a captura e a atribuição do v1.0.

---

## 5. O que trazer de cada lado

**Portar do v1.0 (as especificações já existem):**
1. Connect, chaves com escopo e projetos conectados (`connect.ts`, `apikeys.ts`, `projects.ts`).
2. Origem e atribuição em cada oportunidade.
3. Estagnação: dias na etapa, alerta e média por etapa.
4. Funil de conversão e métricas do dashboard.
5. Filtros, ordenação e exportação CSV.
6. Visão de Clientes derivada da Empresa com oportunidade ganha.

**Aproveitar do mercado:**
1. **Próxima atividade** em toda oportunidade aberta (Pipedrive).
2. **Motivo da perda** e a coluna LOST, com o botão Perdido funcionando.
3. Automação simples (criar tarefa, mover etapa, trocar responsável), no estilo RD Station, quando o núcleo estiver estável.
4. Decidir se **WhatsApp** entra no escopo.

**Consertar antes de mostrar a alguém:** busca e filtro sem lógica, botão Perdido, funis que não existem no banco, tela de equipe estática, aba Tarefas vazia.

---

## Fontes

- [Pipedrive — Leads Inbox](https://support.pipedrive.com/en/article/leads-inbox)
- [Pipedrive — Leads vs. deals](https://support.pipedrive.com/en/article/leads-vs-deals)
- [HubSpot — Lifecycle stages](https://knowledge.hubspot.com/records/use-lifecycle-stages)
- [HubSpot Community — Contacts e Leads no HubSpot vs Salesforce](https://community.hubspot.com/t5/Sales-Hub-Onboarding/How-do-Contacts-and-Leads-work-in-HubSpot-compared-to-Salesforce/td-p/723913)
- [RD Station CRM](https://www.rdstation.com/produtos/crm/), [automação de vendas](https://www.rdstation.com/produtos/crm/vendas/automacao/) e [WhatsApp](https://www.rdstation.com/produtos/crm/vendas/vender-pelo-whatsapp/)
- Sessão anterior: `kalidash_ux_ui_benchmark.md` (Antigravity), que comparou apenas a gaveta da oportunidade.
