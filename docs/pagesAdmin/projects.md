# 🛠 Projetos Conectados, Integrações e Chaves

**Objetivo:** central técnica para conectar ao admin as LPs, sites e formulários que a Kalidash lança, e para gerenciar as chaves e integrações.

> **Status (18/10/2026, WP2):** com `CRM_API=1` **e** `AUTH_API=1` a tela é **real**: projetos, formulários rastreados e chaves ficam gravados na API (`components/ProjectsLive.tsx`, `lib/connectSync.ts`; servidor em `apps/api/connect_projects.go` e `connect_ingest.go`), o aviso de exemplo some e só Admin/Gerente (`keys:manage`) veem e mexem. Sem as duas flags a tela segue como antes, com **dados de exemplo** (`mocks/projects.ts`) e o aviso. Não existe ainda: **visitas, conversão e origem** (analytics) nem `ads:read`: os escopos existem como gancho e a tela real mostra só envios. Já existiu como mock no site v1.0 (`.archive/v1.0_site/app/admin/`).

## ✅ Como funciona (versão real)

1. **Projetos → Conectar projeto:** nome, URL (só envios vindos dessa origem valem; `Outras origens` aceita `https://www…` e `https://*.vercel.app`), **funil + coluna de leads** (tipo Lead) em que o envio entra, **fonte do lead** (padrão: o nome do projeto).
2. **Formulários rastreados:** nome, seletor CSS (`#form-contato`), mapa opcional de campos (vazio = o `connect.js` acha por `name`/`id`/`type`) e caixa de consentimento opcional. O `connect.js` só observa o que está cadastrado.
3. **Chaves de API → Criar token → Tipo "Snippet de um projeto":** escolhe o projeto e o ambiente (`kld_live_` ou `kld_test_`). O token aparece **uma vez**, junto com a tag `<script src="…/connect.js" data-key="…" defer>`. É o mesmo painel de tokens de Configurações (WP1.1); aqui a aba mostra criador, ambiente (selo *Teste*), projeto e último uso, e **Revogar** vale na hora.
4. Cada envio vira um **lead** (não oportunidade) em Leads, com a fonte do projeto, as tags `Inbound`/projeto/formulário (e `Teste` para `kld_test_`) e a atribuição na ficha.
5. **Desconectar** o projeto arquiva: o `connect.js` e as chaves dele param de aceitar envios; os leads ficam. Revogue as chaves em seguida.
6. **D13:** em Configurações → Equipe, desativar uma pessoa lista os tokens ativos que ela criou e pede confirmação. Os tokens são da organização e **continuam valendo**; revogue o que não deve sobreviver.

---

## 📌 O que a página tem

### Projetos conectados
Cada **projeto conectado** é uma propriedade digital (LP, site, modal de inscrição) onde o Kalidash Connect está instalado. Cada projeto pode viver em uma stack diferente; o que padroniza é o snippet, não a tecnologia.

Na sidebar, cada projeto aparece em formato de apresentação (feed), com uma seta para expandir e ver as **métricas daquele projeto**: envios, conversão e origem.

Um projeto agrupa:
- **Formulários rastreados:** nome, seletor CSS que o Connect observa, campos mapeados, visualizações e envios.
- **Módulos ligados:** Formulário, Analytics e Ads, cada um com status (Ativo, Pendente, Erro).
- **Dados do site:** URL, favicon e descrição de SEO.

### Integrações
- O **integrador de formulário** fica em Integrações. Quando há uma integração ativa, ela aparece listada.
- Uma **página de exemplo**: o usuário cola o snippet num campo e vê o preview de uma página com formulário (com CSS próprio) já enviando ao admin. Não existe renderizador de formulário: o objetivo é **gerar um token**.
- Conexões com o Google (Meet, Gmail, Drive) e webhooks de entrada e saída também moram aqui. Ver [integrations-workspace.md](../integrations-workspace.md) e [crm-integrations.md](../crm-integrations.md).

### Chaves de API
O token do Connect e o de qualquer outra integração saem deste painel. O snippet não gera nada sozinho: ele só carrega uma chave emitida aqui, com escopo e ambiente definidos.

- **Formato:** `kld_live_<32 caracteres>` ou `kld_test_<32 caracteres>`. O texto abaixo sobre escopos vale como está; a chave do snippet tem **só** `forms:write` (o servidor recusa misturar com leitura).
- **O token completo aparece uma única vez**, no momento da emissão. Depois ficam só o prefixo, os 4 últimos caracteres e um hash SHA-256 (o formato real é `kld_live_`/`kld_test_` + 32 caracteres base64url).
- Cada chave mostra ambiente, projeto, escopos, criação, último uso e status (Ativa ou Revogada). Revogar uma chave não afeta as demais.

| Escopo | Para quê | Pode ir no HTML? |
|---|---|---|
| `forms:write` | Criar leads a partir do Connect (o mínimo do snippet) | Sim |
| `analytics:write` | Pageview, sessão e origem para as métricas do projeto | Sim |
| `ads:read` | Sincronizar custo e CPL da conta de anúncios | Não |
| `leads:read` | Consultar a base pelo servidor | **Nunca** |

---

## 🔗 Fonte do funil e projeto conectado (WP4-0, 25/10/2026)

Com `WORKFLOW_API=1` e `CRM_API=1`, o vínculo entre um funil e o que o alimenta é **só o projeto conectado** (`ConnectedProject.pipelineId`, `stageId`, `sourceName`). O painel **Conectar fonte** (Configurações do funil → Fontes, ou o workflow) lista os projetos reais de `GET /api/projects` (com os formulários de cada um) e, ao conectar, grava no projeto o funil escolhido, a **primeira etapa do tipo Lead** do funil e o nome da fonte. As fontes de formulário que aparecem no funil são **derivadas** dos projetos na leitura (`lib/sourceLink.ts`, `lib/projectSources.ts`) e **não** são gravadas em `Pipeline.config.sources`; só cadastro manual, importação e API ficam no `config`. O funil mostra "Sem fonte" apenas se nenhum projeto aponta para ele (quem não tem `keys:manage` não lê os projetos: a tela diz "Fontes indisponíveis" em vez de "Sem fonte"). Um projeto alimenta um só funil: conectar a outro move o vínculo (a tela avisa). **Limite conhecido:** a API recusa projeto sem funil (`422`), então desconectar o projeto do funil não está disponível; troque o funil do projeto ou desconecte o projeto inteiro (arquiva) em Projetos conectados. Sem a API, "Conectar fonte" segue com os formulários de exemplo e uma automação de exemplo que só vive no navegador.

## ⚠️ Problemas Antecipados & Soluções

1. **Problema: Chave Exposta no Frontend (O Dilema do Snippet)**
   - *O risco:* O snippet `connect.js` é um script front-end (HTML). Se a chave da API estiver no HTML, qualquer um inspecionando o código pode vê-la.
   - *A Solução:* A chave colocada no snippet **NÃO** pode ser uma "Secret Key". Deve ser uma "Publishable Key" (Chave Pública) com um escopo rigidamente bloqueado apenas para escrita (`forms:write` e `analytics:write`). Ela não tem poder de deletar ou ler dados do banco.

2. **Problema: Spoofing (Forjar a origem do site)**
   - *O risco:* O Go valida a origem da requisição (`Origin` header). Porém, hackers podem usar scripts/Postman para forjar o cabeçalho `Origin` e flodar a API de lixo simulando que vem do site verdadeiro.
   - *A Solução (implementada):* `Origin` conferido por projeto, limite de **10 tentativas/min por IP** e **60 envios/min por chave** (`429`), honeypot (campo `website`) e corpo ≤ 16 KB. Quem forja o `Origin` com `curl` só consegue criar leads, sob esses limites. Turnstile/reCAPTCHA ficou de fora.

3. **Problema: Chave vazada ou de um projeto desativado**
   - *O risco:* Uma chave que continua válida depois que a LP saiu do ar continua aceitando leads.
   - *A Solução:* Revogação por chave, com efeito imediato, e o "último uso" visível no painel para achar chaves esquecidas. Só Admin e Gerente acessam esta página.
