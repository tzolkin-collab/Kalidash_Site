# 👥 CRM (Pipeline, Dados de Clientes e Notificações)

> O coração operacional do Kalidash. Onde os vendedores passam 90% do seu tempo. Projetado para zero atrito, velocidade em tempo real e visualização consolidada.

---

## 1. Pipelines (Gestão Visual de Vendas)

O sistema oferece duas visualizações nativas e intercambiáveis (com persistência da preferência do usuário em `localStorage`):

### A. Visão Kanban (Arrastar e Soltar)
Focada no fluxo de trabalho individual do vendedor.
- **Estágios Padrão:** `NEW` (Novos) ➔ `CONTACTED` (Contatados) ➔ `NEGOTIATION` (Negociação) ➔ `WON` (Ganhos) ➔ `LOST` (Perdidos).
- **Regras de Negócio:**
  - Leads recém-chegados via `connect.js` caem automaticamente na coluna `NEW`.
  - Se um vendedor arrasta para `LOST`, um modal exige que ele marque o **Motivo da Perda** (Preço, Concorrência, Sem Interesse, Timing). Isso gera relatórios valiosos depois.
  - Se arrastado para `WON`, o sistema abre um campo rápido para preencher o **Valor do Contrato**.

### B. Visão Tabela (Data Grid)
Focada no gestor e ações em massa.
- Paginação, filtros avançados (ex: "Leads do projeto X criados nos últimos 7 dias que estão em Negociação").
- Exportação para CSV.
- Atribuição em massa ("Transferir esses 50 leads do Vendedor A para o Vendedor B").

---

## 2. Dados de Clientes (A "Ficha do Lead")

Quando o usuário clica em um card, a interface não muda de página. Um **Slide-over (painel lateral deslizante)** se abre à direita, mantendo o contexto do Kanban no fundo.

### Anatomia da Ficha do Lead
1. **Cabeçalho Fixo:** Nome, Estágio atual (dropdown para mudança rápida), Valor da Negociação e Botão Primário ("Agendar Call").
2. **Aba Principal: "Timeline (Histórico)"**
   - É a visão unificada (estilo feed de rede social) de tudo que aconteceu com esse lead, em ordem cronológica reversa:
     - *[10:45]* Lead preencheu o formulário (Origem: Google Ads / UTMs).
     - *[10:47]* Vendedor João enviou proposta via Email.
     - *[11:00]* Lead respondeu o email (lido via Pub/Sub).
     - *[11:30]* Reunião agendada para 14h.
   - Na base da Timeline há um input (tipo chat) para o vendedor adicionar Notas Manuais rápidas.
3. **Aba Secundária: "Dados Pessoais"**
   - Telefone, Email, e os campos customizados que vieram pelo `extra_data` (ex: Cargo, Empresa, Faturamento).
   - *Segurança:* Embora o Go armazene os dados criptografados, o painel Vite os recebe descriptografados na resposta da API e os exibe em texto claro (já que o vendedor tem permissão de leitura).

---

## 3. Notificações e Automações SLA

Vendas morrem se o lead esfriar. O CRM do Kalidash atua ativamente para impedir isso.

### Sistema de SLA (Service Level Agreement)
Gestores podem configurar regras de tempo de resposta.
- Exemplo: "Leads novos devem ser contatados em até 2 horas".
- **Visualização:** Se o SLA é quebrado, o card do lead no Kanban fica com uma borda vermelha e um ícone de `🔥 Fogo`, alertando a urgência.

### Notificações em Tempo Real (O Circuito)
Como os leads chegam o tempo todo pelo `connect.js`, o vendedor não pode ficar apertando `F5`.

1. O Lead converte no site.
2. O Backend Go salva no MySQL e dispara um evento **WebSocket** para o client Vite que está conectado.
3. **Reação do Vite (PWA):**
   - O card do novo lead **surge magicamente** no topo da coluna `NEW` com uma sutil animação verde de *highlight*.
   - Um toque sonoro suave (opcional) avisa o vendedor.
   - O selo de notificação na aba do navegador muda (ex: `(1) Kalidash`).
4. **Se o Painel estiver fechado/minimizado:**
   - O Service Worker intercepta um sinal Web Push do Go.
   - Uma notificação nativa do Windows/Mac salta na tela do vendedor: *"🚀 Novo lead capturado: João da Silva (Google Ads)"*. Ao clicar, a PWA foca na tela e abre a Ficha do Lead direto.

---

## 4. Roteamento de Leads (Atribuição)

Como decidir qual vendedor atende qual lead?
- **Manual (Padrão):** O lead cai em uma "Piscina Geral" (coluna NEW sem dono). Qualquer vendedor pode pegar o lead para si ("Claim").
- **Round-Robin (Automático):** Se ativado pelo gestor, o Backend Go distribui equitativamente: Lead 1 vai pro Vendedor A, Lead 2 pro Vendedor B, Lead 3 pro Vendedor C.
- Quando um lead é atribuído, os demais vendedores param de enxergá-lo no Kanban deles (se a regra de privacidade da empresa exigir que um vendedor só veja seus próprios leads). O Gestor (Owner) continua vendo tudo.
