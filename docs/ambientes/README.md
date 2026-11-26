# 🌐 Documento Central: Arquitetura, Pipeline do Site e Gestão de Ambientes

> **Status:** Documento Oficial de Arquitetura e Engenharia de Ambientes  
> **Data:** 30 de Outubro de 2026  
> **Objetivo:** Estabelecer o pipeline completo do site, a arquitetura de tracking (Google Analytics 4, Google Ads e Meta Ads), o modelo do Workspace Kalidash via variáveis de ambiente e a convivência com Projetos Conectados.

---

## 1. Visão Geral da Arquitetura

O ecossistema Kalidash divide-se em duas esferas operacionais complementares:

```mermaid
graph TD
    subgraph "Mundo Externo (Tráfego & Anúncios)"
        GAds["Google Ads (gclid, UTMs)"] --> LP["Página de Destino (Site ou LP Conectada)"]
        MAds["Meta Ads (fbclid, UTMs)"] --> LP
        Org["Tráfego Direto / SEO / Orgânico"] --> LP
    end

    subgraph "Camada de Captura & Tracking (Frontend)"
        LP --> Tags["GA4 + Meta Pixel + Clarity (direto no código)"]
        LP --> GTM["GTM (só tags extras, lendo o dataLayer)"]
        LP --> Forms["Formulário (Site / connect.js)"]
    end

    subgraph "Camada de Ingestão & Negócio (Backend Go)"
        Forms -->|POST /api/public/leads ou /api/connect/leads| API["Kalidash API (Go)"]
        API --> DB[(MySQL / TiDB)]
        API -->|API de Conversões + GA4 Measurement Protocol, mesmo event_id| Midia["Meta / GA4 (servidor)"]
        API -.->|Google Analytics Data API (Leitura com Cache 30m)| GA4Server["Propriedade GA4 (Workspace Kalidash)"]
    end

    subgraph "Camada Operacional (Admin)"
        DB --> Admin["Kalidash Admin (PWA)"]
        GA4Server -.-> Admin
        Team["Colaboradores (@kalidash.com)"] -->|Google Workspace SSO| Admin
    end
```

---

## 2. Pipeline do Site: Da Origem ao Fechamento no CRM

O pipeline do site representa a esteira que transforma cliques de anúncios e visitantes orgânicos em clientes atendidos pela equipe:

### Etapa 1: Atribuição na Chegada
Quando o visitante acessa o site da Kalidash (`https://kalidash.com.br`) vindo de uma campanha de mídia:
- **Google Ads**: A URL recebe parâmetros como `?gclid=...&utm_source=google&utm_medium=cpc&utm_campaign=ai-culture`.
- **Meta Ads**: A URL recebe parâmetros como `?fbclid=...&utm_source=meta&utm_medium=paid_social&utm_campaign=capacitacao-ia`.
- **Persistência**: O site (`lib/tracking.ts`) e o `connect.js` guardam esses parâmetros no `localStorage` na primeira página vista (último toque por 90 dias e primeiro toque permanente), para que a atribuição não se perca entre páginas (ex: Home → Sobre nós → Diagnóstico) nem numa volta posterior. Convenção de UTMs e detalhes em [`docs/tracking.md`](../tracking.md).

### Etapa 2: Interação e Formulário de Diagnóstico
No site, a principal porta de entrada é o **Diagnóstico de IA** (rota `/diagnostico`):
1. O usuário preenche as respostas (desafios da empresa, estágio atual, área de interesse).
2. Na última etapa, preenche os dados de contato (Nome, E-mail, WhatsApp, Empresa, Cargo).
3. Ao clicar em enviar, o envio leva um `event_id` (um por envio):
   - **CRM / Ingestão**: `POST` com os dados do lead, respostas do diagnóstico, `event_id` e atribuição (`utm_*`, `gclid`, `fbclid`, `referrer`, `device`, `_fbp`, `_fbc`, ids do GA4) para a API em Go, que grava 1 lead por `event_id`.
   - **Mídia, servidor**: a API manda o `Lead` pela API de Conversões da Meta e o `generate_lead` pelo GA4 (Measurement Protocol), com o mesmo `event_id`.
   - **Mídia, navegador**: o Pixel dispara `Lead` com o mesmo `event_id` (a Meta junta os dois); o gtag só dispara o `generate_lead` se o servidor não o mandou; o dataLayer recebe `lead_form_submitted` para tags extras do GTM.
   - Taxonomia completa de eventos (newsletter, material, conversões offline) em [`docs/tracking.md`](../tracking.md).

### Etapa 3: Recepção no Funil do CRM
Na API em Go:
- O lead é saneado, passa pelas travas anti-spam (honeypot) e é gravado na tabela `Lead`.
- Ele entra automaticamente no funil designado (ex: **Funil Inbound**, na etapa inicial **Lead** com status `ACTIVE`).
- A equipe de vendas recebe a notificação no Admin e visualiza o histórico completo na ficha do lead (inclusive de qual campanha e anúncio específico ele veio).

---

## 3. Workspace Kalidash (GA4 como Key Type ENV)

Ao contrário dos **Projetos Conectados** (que possuem múltiplos clientes e usam o snippet `connect.js` com chaves públicas `kld_live_`), a operação central da Kalidash utiliza o modelo de **Workspace**:

1. **Configuração via Variáveis de Ambiente (`.env`)**:
   - As credenciais de acesso ao GA4 moram exclusivamente no `.env` da API (`GA4_PROPERTY_ID`, `GA4_CLIENT_EMAIL`, `GA4_PRIVATE_KEY`).
   - Não há necessidade de cadastros manuais nem interfaces administrativas para "conectar o GA4 da Kalidash": o servidor Go lê as chaves na inicialização.
2. **Segurança via Google Cloud Service Account**:
   - Uma Service Account dedicada é criada no projeto Google Cloud da Kalidash.
   - O e-mail da Service Account recebe permissão de **Leitor** dentro da Propriedade do GA4.
   - A API em Go usa a biblioteca oficial para autenticar via chave privada RSA e fazer requisições à **Google Analytics Data API (v1beta)**.
3. **Cache Inteligente de Métricas**:
   - Para não consumir as quotas diárias do Google (limite de tokens da API gratuita) e garantir tempo de resposta de milissegundos no Admin, a API Go mantém um cache em memória de **30 a 60 minutos** para os relatórios de sessões e tráfego.
4. **Acesso dos Colaboradores**:
   - Colaboradores com e-mail corporativo (`@kalidash.com`) autenticam no Admin via **Google Workspace SSO** (`GOOGLE_HD=kalidash.com`).
   - Os mesmos colaboradores podem ter acesso direto à interface web do Google Analytics e Google Ads com suas contas corporativas do Google Workspace.

---

## 4. Convivência com Projetos Conectados

O ecossistema foi projetado para que o tracking central da Kalidash e os Projetos Conectados convivam sem conflito:

- **Projetos Conectados** são propriedades digitais de terceiros ou páginas de campanhas isoladas.
- Eles utilizam o snippet `connect.js` com uma chave pública de projeto (`kld_live_...`).
- O `connect.js` já captura automaticamente as origens, referrers e parâmetros de campanha, entregando o lead diretamente no funil configurado daquele projeto no CRM da Kalidash. Conversões pelo servidor no Pixel/GA4 do Kalidash só saem se o projeto tiver "Conversões de mídia" ligado (padrão desligado; ver [`docs/tracking.md`](../tracking.md)).
- Cada envio do `connect.js` leva um `event_id`: a API grava 1 lead por id e manda o `Lead` pela API de Conversões (chave `kld_live_`; a `kld_test_` não manda nada). No navegador, o `connect.js` dispara o Pixel com o mesmo id, o `generate_lead` do gtag quando o servidor não manda o GA4 e `dataLayer.push({ event: 'lead_form_submitted', ... })` para o GTM da própria LP. A LP não deve disparar o próprio `Lead` no envio (ver [`docs/tracking.md`](../tracking.md), seção 6).

---

## 5. Decisão de Esteira de E-mails: Resend vs. Gmail API

O Kalidash CRM possui capacidade de disparar e-mails para contatos de oportunidades e enviar testes de modelos visuais. Apresentamos abaixo o comparativo para orientar a tomada de decisão:

| Critério de Decisão | Opção A: Resend (Implementada / Recomendada) | Opção B: Gmail API Direto (Google Workspace) |
| :--- | :--- | :--- |
| **Como Funciona** | Disparo transacional via API HTTP com domínio `kalidash.com.br` autenticado por DKIM/SPF. | Disparo via OAuth 2.0 saindo fisicamente da caixa pessoal de cada vendedor (`@kalidash.com`). |
| **Complexidade de Setup** | **Muito Baixa:** Apenas 1 chave central no servidor (`RESEND_API_KEY`) e 3 registros DNS no Cloudflare. | **Alta:** Exige aprovação de escopo restrito no Google Workspace e gestão de tokens por usuário. |
| **Pasta "Itens Enviados"** | Não aparece no Gmail pessoal do vendedor (fica registrado na Timeline da Oportunidade no CRM). | Aparece fisicamente na pasta "Enviados" do Gmail/Outlook do colaborador. |
| **Limites e Risco de Bloqueio** | **Zero risco às contas Google:** suporta milhares de envios com alta entregabilidade. | **Risco Médio:** Limite diário de 500-2.000 envios. Risco de suspensão da conta Google por denúncia de spam. |
| **Status no Código Hoje** | **100% implementado e testado** no backend em Go (`/api/emails/send` e `/api/emails/test`). | **Não implementado:** exige desenvolvimento de novas rotas OAuth e gestão de `refresh_token`. |
| **O que é necessário providenciar** | 1. Criar conta no [resend.com](https://resend.com) e gerar chave `re_...`<br>2. Adicionar 3 registros DNS (DKIM/SPF) no Cloudflare de `kalidash.com.br`. | 1. Habilitar Gmail API no Google Cloud.<br>2. Delegar autoridade no painel Workspace.<br>3. Homologar tela de consentimento. |

> [!TIP]
> **Recomendação da Engenharia:** Subir com **Resend** no Go-Live. O sistema já está pronto e testado, o domínio fica protegido contra bloqueios e o setup técnico exige apenas os registros DNS. A Gmail API pode ser adotada na Fase 2 para mensagens 1 a 1 específicas caso a equipe comercial julgue mandatório ter a mensagem na pasta "Enviados" pessoal.

---

## 6. Mapa Central de Variáveis de Ambiente

Nesta pasta (`docs/ambientes/`), cada aplicação possui seu modelo documentado:

| Arquivo | Aplicação | Descrição |
| :--- | :--- | :--- |
| [`site.env.example`](./site.env.example) | `apps/site` | Configurações do Next.js, endpoints de API e IDs de GTM, GA4, Meta Pixel e Clarity. |
| [`api.env.example`](./api.env.example) | `apps/api` | Banco de dados, segurança de sessões, Google Workspace SSO, Service Account do GA4, Resend e limites do Connect. |
| [`admin.env.example`](./admin.env.example) | `apps/admin` | URL pública da API Go para o painel Vite PWA. |
| [`studio.env.example`](./studio.env.example) | `apps/studio` | Conexão direta Prisma para inspeção do banco e migrações. |
| [**`pre-producao.md`**](./pre-producao.md) | **Staging / VPS** | **Guia prático e Runbook de Pré-produção na VPS e MySQL do Gustavo.** |

---

## 7. Documento de Solicitação de Acessos

Para solicitar as credenciais, IDs de medição e permissões de acesso aos responsáveis pela infraestrutura e contas de mídia da Kalidash, utilize os documentos gerados nesta mesma pasta:
- **Formato DOCX (Word editável):** [`solicitacao-acessos-kalidash.docx`](./solicitacao-acessos-kalidash.docx)
- **Formato PDF (Pronto para envio):** [`solicitacao-acessos-kalidash.pdf`](./solicitacao-acessos-kalidash.pdf)

---

## 8. Subida em Pré-Produção (Staging na VPS do Gustavo)

Durante a fase de homologação, o banco de dados MySQL e a VPS (EasyPanel / Docker) rodam sob a infraestrutura do desenvolvedor (Gustavo). Consulte o roteiro operacional completo em [**`pre-producao.md`**](./pre-producao.md) para subir a API Go, configurar o banco limpo, cadastrar o callback OAuth no Google Cloud e executar os smoke tests de validação ponta a ponta.
