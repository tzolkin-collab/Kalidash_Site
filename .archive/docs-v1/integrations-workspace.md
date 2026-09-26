# 🧬 Ecossistema Google Workspace (Meet, Email e Drive)

> Como o Kalidash usa o Google Workspace como motor de produtividade do time, conectando o CRM às ferramentas do dia a dia.

---

## 1. Integração Google Meet (Agendamento Automático)

**Problema:** Sair do CRM para ir no Google Calendar, criar o evento, adicionar o link do Meet, copiar, colar no WhatsApp/Email do Lead.
**Solução Kalidash:** Um clique dentro da Ficha do Lead.

### Fluxo Técnico
1. **O Gatilho:** Na timeline do Lead (Kanban), o vendedor clica em `Agendar Call`.
2. **A Ação:** O backend Go, usando o token OAuth do vendedor, chama a `Google Calendar API`.
3. **O Resultado:**
   - Cria o evento no calendário do vendedor.
   - Gera a sala do Google Meet automaticamente (`meet.google.com/xyz`).
   - Adiciona o email do Lead como convidado (disparando o invite oficial do Google).
   - Salva o link do Meet na timeline do CRM. No horário da reunião, um botão verde "Entrar na Call" aparece no card.

---

## 2. Integração Gmail (Comunicação 1-para-1)

**Problema:** Emails transacionais via SMTP (SendGrid/AWS) costumam cair na aba de Promoções ou Spam, e as respostas não voltam para o CRM.
**Solução Kalidash:** O vendedor envia o email pelo CRM, mas o disparo acontece diretamente pelo Gmail dele.

### Fluxo Técnico
1. **Envio:** O vendedor redige a proposta no CRM. O Go aciona a `Gmail API` (`gmail.users.messages.send`) usando o token do vendedor.
2. **Entrega Perfeita:** O email sai dos servidores do Google. Ele aparece na pasta "Enviados" do Gmail do vendedor e cai na Caixa de Entrada principal do Lead.
3. **Tracking de Resposta (Pub/Sub):**
   - Registramos um Webhook no Google Cloud Pub/Sub.
   - Quando o Lead responde o email, o Google avisa o Kalidash.
   - A resposta do Lead aparece dentro da Timeline do CRM, abaixo da proposta. O vendedor nunca precisou abrir o [gmail.com](http://gmail.com/).

---

## 3. Google Drive vs Cloudflare R2 (Gestão de Assets e CMS)

**Conceito Central:** O Drive é o "ateliê" (Draft/Rascunho). O R2 é a "vitrine" (Produção).

O Google Drive é imbatível para colaboração humana (pastas, edição ao vivo, comentários). Mas é péssimo e caro para servir imagens em um site público. Cloudflare R2 é o inverso: péssimo para editar, mas perfeito, rapidíssimo e gratuito (até 10GB/mês) para servir assets em produção via CDN.

### Como funciona o Workflow Híbrido

#### Fase 1: Criação (Google Drive)
- **Designers e Redatores** trabalham no Google Drive (Docs para rascunho de blog posts, Pastas de Imagens para assets pesados, Figma/Draw).
- O Kalidash tem acesso de leitura à pasta raiz do projeto no Drive via API.
- No painel do CMS (Kalidash Admin), o usuário pode clicar em *"Importar do Drive"*. Ele navega pelas pastas diretamente pelo painel e seleciona as fotos ou o rascunho do Google Docs.

#### Fase 2: Publicação (Go + Cloudflare R2)
- Quando o usuário clica em **"Publicar Post"** ou **"Ativar Landing Page"**, o backend Go entra em ação.
- **Processamento:** O Go faz o download da imagem do Drive original (ex: PNG de 5MB).
- **Otimização:** O Go converte para `.WebP` e gera 3 tamanhos (Mobile, Tablet, Desktop), reduzindo o peso para 80KB.
- **Upload Prod:** O Go sobe essas imagens otimizadas para o **Cloudflare R2**.
- **Entrega (CDN):** O site (Next.js) passa a carregar as imagens do R2 (`https://cdn.kalidash.com/assets/img.webp`), garantindo nota 100 no Google PageSpeed.

**Benefício de negócio:** A equipe de marketing continua usando a ferramenta que já ama e domina (Drive) para rascunhos. O site carrega na velocidade da luz porque em produção (R2) só existem assets hiper-otimizados servidos na Edge.
