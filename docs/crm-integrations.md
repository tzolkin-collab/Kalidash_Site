# 🤝 CRM: Integrações e Comunicação

> Planejamento das integrações do CRM Kalidash com ferramentas de comunicação externa.
> O objetivo é manter o vendedor dentro do painel o máximo de tempo possível, reduzindo atrito.

---

## 1. Google Meet (Agendamento de Reuniões)

**Objetivo:** Permitir que o vendedor agende uma call com o Lead diretamente pela ficha do CRM, gerando o link do Meet automaticamente e disparando o invite.

### Como vai funcionar (Aproveitando o Google OAuth)
Como já decidimos usar o **Google OAuth + Workspace** para o login da equipe, nós já temos "meio caminho andado". 

1. **Permissão Extra:** Na hora do login (OAuth), pedimos o escopo `https://www.googleapis.com/auth/calendar.events`.
2. **Na Ficha do Lead (PWA):**
   - O vendedor clica em "Agendar Reunião".
   - Abre um modal com Data, Hora e Título (ex: *Apresentação Kalidash - [Nome do Lead]*).
   - Ao salvar, o nosso backend Go chama a API do Google Calendar do vendedor usando o token dele.
3. **O que acontece nos bastidores:**
   - Um evento é criado no Google Calendar oficial do vendedor.
   - O Google gera o link do Meet automaticamente (`meet.google.com/xxx-yyy-zzz`).
   - O Lead recebe o convite oficial do Google Calendar no email dele.
   - O link do Meet fica salvo na timeline da ficha do Lead no nosso CRM.

---

## 2. Emails (Follow-ups e Propostas)

**Objetivo:** Enviar e rastrear emails diretamente pelo CRM, sem precisar abrir uma aba do Gmail.

### A Estratégia (Gmail API vs SMTP Externo)

Temos duas rotas aqui. A Rota A é mais "poderosa", a Rota B é mais "simples".

**Rota A: Integração com a API do Gmail (Recomendado já que usamos Workspace)**
- O vendedor envia um email de dentro da ficha do lead.
- O Kalidash usa a API do Gmail (`https://www.googleapis.com/auth/gmail.send`) para enviar a mensagem **como se o vendedor estivesse no Gmail**.
- **Vantagem:** O email fica salvo na pasta "Enviados" do Gmail oficial do vendedor. A taxa de entrega (inbox) é de 100%, pois sai dos servidores do Google, não de um disparador em massa.
- **Leitura:** Podemos escutar respostas. Se o Lead responder, a API do Gmail avisa o Kalidash via Webhook (Google Pub/Sub) e a resposta aparece na timeline do CRM.

**Rota B: Disparo via AWS SES / Resend (Serviço Transacional)**
- Disparamos via uma API externa.
- **Desvantagem:** O email sai de um servidor de marketing (ex: `vendas@sistema.kalidash.com`). Respostas são mais difíceis de rotear de volta para o vendedor.

**Decisão sugerida:** Rota A (API do Gmail), mantendo o ecossistema Google Workspace super fechado e poderoso.

---

## 3. Notificações (O motor de engajamento)

**Objetivo:** Avisar o vendedor imediatamente quando uma ação importante acontece (Novo Lead, Lead abriu o email, Reunião em 10 min).

### Sistema Multicanal

1. **In-App (WebSocket):**
   - **Como:** Se o painel Vite PWA estiver aberto, um "toast" verde pula na tela: *"Novo lead da campanha Black Friday!"*.
   - **Tecnologia:** WebSockets nativos do Go. Latência zero.
2. **Push Notifications (PWA):**
   - **Como:** Se o painel estiver fechado (mas instalado no PC/Celular do vendedor), ele recebe uma notificação nativa do Windows/macOS/Android.
   - **Tecnologia:** Service Workers (Vite) + VAPID Keys no Go (Web Push API). Gratuito, sem passar por Apple/Google stores.
3. **Notificação por Email:**
   - **Como:** Um resumo diário ("Você tem 3 leads sem contato há mais de 24h") ou alerta de alta prioridade.
   - **Tecnologia:** Disparo simples pelo backend Go.
4. **Notificação Webhook (Integrações do Cliente):**
   - **Como:** Se o dono da Agência quiser, ele cadastra uma URL (ex: Zapier ou Make).
   - **Tecnologia:** O Go dispara um `POST` com os dados do lead, permitindo que a agência crie um alerta no Slack/Discord deles.

---

## 4. O Fluxo de Trabalho (A Ficha do Lead)

Quando o vendedor abre um lead em **"NEGOTIATION"**, a interface mostrará uma **Timeline (Histórico)** única:

- **10:00** — Entrou via *connect.js* (Origem: Google Ads)
- **10:02** — Vendedor enviou email: *"Olá, recebi seu contato..."* (via API Gmail)
- **11:30** — Reunião agendada para Amanhã às 14h (via API Calendar/Meet)
- **Amanhã 13:50** — Notificação Push PWA: *"Sua call com [Lead] começa em 10 min. [Entrar no Meet]"*

Isso transforma o Kalidash de um "banco de dados bonitinho" num **sistema operacional de vendas**.
