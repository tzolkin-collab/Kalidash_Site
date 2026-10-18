# 🛠 Projetos Conectados, Integrações e Chaves

**Objetivo:** central técnica para conectar ao admin as LPs, sites e formulários que a Kalidash lança, e para gerenciar as chaves e integrações.

> **Status (18/10/2026):** a tela existe no admin com **dados de exemplo** (mock em memória: `mocks/projects.ts`); a API de projetos, chaves e `connect.js` ainda **não existe** (WP2) e a chave "emitida" na tela não vale no servidor. Já existiu como mock no site v1.0 (`.archive/v1.0_site/app/admin/`: `projects.ts`, `connect.ts`, `apikeys.ts`, `IntegrationsSettings.tsx`).

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

- **Formato:** `kld_live_<32 hex>` ou `kld_test_<32 hex>`.
- **O token completo aparece uma única vez**, no momento da emissão. Depois fica só o prefixo (18 caracteres) e um hash SHA-256.
- Cada chave mostra ambiente, projeto, escopos, criação, último uso e status (Ativa ou Revogada). Revogar uma chave não afeta as demais.

| Escopo | Para quê | Pode ir no HTML? |
|---|---|---|
| `forms:write` | Criar leads a partir do Connect (o mínimo do snippet) | Sim |
| `analytics:write` | Pageview, sessão e origem para as métricas do projeto | Sim |
| `ads:read` | Sincronizar custo e CPL da conta de anúncios | Não |
| `leads:read` | Consultar a base pelo servidor | **Nunca** |

---

## ⚠️ Problemas Antecipados & Soluções

1. **Problema: Chave Exposta no Frontend (O Dilema do Snippet)**
   - *O risco:* O snippet `connect.js` é um script front-end (HTML). Se a chave da API estiver no HTML, qualquer um inspecionando o código pode vê-la.
   - *A Solução:* A chave colocada no snippet **NÃO** pode ser uma "Secret Key". Deve ser uma "Publishable Key" (Chave Pública) com um escopo rigidamente bloqueado apenas para escrita (`forms:write` e `analytics:write`). Ela não tem poder de deletar ou ler dados do banco.

2. **Problema: Spoofing (Forjar a origem do site)**
   - *O risco:* O Go valida a origem da requisição (`Origin` header). Porém, hackers podem usar scripts/Postman para forjar o cabeçalho `Origin` e flodar a API de lixo simulando que vem do site verdadeiro.
   - *A Solução:* A barreira CORS protege usuários comuns no navegador, mas para proteger o backend de fato, implementaremos *Rate Limiting* (Limite por IP, ex: 5 leads por minuto) e integração com reCAPTCHA invisível/Cloudflare Turnstile no snippet nativo.

3. **Problema: Chave vazada ou de um projeto desativado**
   - *O risco:* Uma chave que continua válida depois que a LP saiu do ar continua aceitando leads.
   - *A Solução:* Revogação por chave, com efeito imediato, e o "último uso" visível no painel para achar chaves esquecidas. Só Admin e Gerente acessam esta página.
