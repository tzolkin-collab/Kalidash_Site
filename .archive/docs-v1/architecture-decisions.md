# 🏗️ Decisões Arquitetônicas — Justificativas Técnicas Detalhadas

Este documento explica **por que** cada tecnologia foi escolhida para cada camada do Kalidash,
com comparações práticas, números reais e referências de mercado.

---

## 1. Por que Vite (e não Next.js) para o Painel Admin?

### O que o Admin faz
O painel administrativo é um **aplicativo interativo pesado**: tabelas com drag-and-drop,
Kanban com arrastar cards, gráficos em tempo real, modais empilhados, WebSockets abertos,
formulários complexos com validação instantânea. Nenhuma dessas telas precisa aparecer no Google.

### O que o Next.js faz que atrapalha aqui
O Next.js foi construído em torno de um conceito chamado **Server Components** e **SSR/SSG**
(renderização no servidor). Isso significa que, por padrão, toda página do Next.js passa por
um servidor Node.js antes de chegar no navegador. Para o site público, isso é uma benção
(o Google recebe HTML pronto). Para o admin, isso é peso morto:

| Aspecto | Next.js no Admin (Problema) | Vite no Admin (Solução) |
|---|---|---|
| **Build** | ~30-60s (precisa compilar rotas server-side, middleware, API routes) | ~2-4s (compila apenas JS/CSS estático, zero servidor) |
| **Bundle** | Inclui o runtime do Next.js (~85KB gzipped), React Server Components, router com prefetch | Inclui apenas React (~44KB gzipped) + seu código. Nada mais. |
| **Dev Server (HMR)** | Reinicia o módulo e o servidor Node a cada mudança. Em projetos grandes, leva 1-3s para refletir | Usa ESModules nativos do navegador. A mudança reflete em <50ms, instantâneo |
| **Hospedagem** | Precisa de um servidor Node.js rodando (Vercel faz isso, mas consome recursos do plano gratuito) | Gera uma pasta `dist/` com HTML+JS+CSS estático. Joga em qualquer CDN/bucket por custo zero |
| **Complexidade** | Você precisa decidir: essa página é Server Component ou Client Component? `"use client"` em todo canto? Middleware? API Route? | Tudo é client-side. Sem ambiguidade. Um `fetch()` direto para a API em Go |
| **PWA** | Possível, mas conflita com o Service Worker do Next.js e exige configuração manual complexa | Plugin `vite-plugin-pwa`: adiciona 3 linhas no config e está pronto |

### Referência de mercado
- **Vercel Dashboard** (o painel da própria criadora do Next.js): É construído em Next.js, mas
  eles têm uma equipe de 300+ engenheiros otimizando performance. Nós não temos esse luxo.
- **Supabase Dashboard**, **Railway Dashboard**, **PlanetScale Dashboard**: Todos usam
  **Vite + React** (ou equivalente SPA). Eles sabem que num painel, SSR é overhead desnecessário.

**Veredicto:** Next.js no admin é como usar um caminhão de mudança para ir ao mercado.
Funciona, mas você está carregando peso que não precisa.

---

## 2. Por que Next.js (e não Vite) para o Site Público?

### O que o Site Público faz
O site público existe para **ser encontrado no Google**, carregar em menos de 1 segundo,
e converter visitantes em leads. Cada milissegundo de carregamento que você perde, você
perde 7% de conversão (dado do Google).

### O que o Vite NÃO consegue fazer aqui
Um SPA puro (Vite) envia um HTML vazio para o navegador:
```html
<div id="root"></div>
<script src="app.js"></script>
```
O Google precisa **executar o JavaScript** para ver o conteúdo. Embora o Googlebot faça isso,
ele coloca sua página numa fila de renderização que pode demorar **dias ou semanas**
para ser processada. Enquanto isso, sua página é invisível no Google.

### O que o Next.js entrega
O Next.js renderiza o HTML **completo no servidor** e entrega para o Google uma página pronta:
```html
<h1>Kalidash — Capture Leads Automaticamente</h1>
<p>Conecte qualquer formulário ao seu CRM...</p>
```
O Google indexa isso instantaneamente. Sem fila, sem espera.

| Aspecto | Vite (SPA) no Site Público | Next.js no Site Público |
|---|---|---|
| **SEO** | HTML vazio. Google precisa executar JS. Indexação lenta/incerta | HTML completo entregue ao crawler. Indexação imediata |
| **Core Web Vitals (LCP)** | O "Largest Contentful Paint" depende do JS carregar + executar + buscar dados da API. Típico: 2-4s | O HTML já vem com o conteúdo. LCP típico: 0.5-1.2s |
| **Open Graph / Redes Sociais** | Quando alguém compartilha o link no WhatsApp/LinkedIn, aparece uma caixa branca sem preview | O servidor injeta as meta tags corretas. O preview aparece com título, descrição e imagem |
| **Blog com ISR** | Impossível. Você precisaria de um servidor separado para gerar HTML | Nativo. O Next.js gera a página na primeira visita e cacheia automaticamente |

### Referência de mercado
- **Shopify Storefront**, **Notion.so/blog**, **Linear.app** (site público): Todos usam
  Next.js ou framework SSR equivalente para o site que o público vê.
- O blog deles? Next.js com ISR. O painel deles? SPA separado.

**Veredicto:** Vite no site público é como abrir uma loja sem vitrine. O produto está lá dentro,
mas ninguém na rua consegue ver.

---

## 3. Por que Go (e não Node.js/Python/Java) para o Backend?

### O cenário real do Kalidash
O backend do Kalidash é uma **API de ingestão de eventos**: centenas (ou milhares) de sites
de clientes diferentes vão mandar `POST /api/logs` simultaneamente, 24 horas por dia.
Cada requisição precisa: validar a API Key, checar o domínio de origem, salvar no banco,
e (opcionalmente) disparar um webhook para o CRM do cliente. Tudo isso em milissegundos.

### Go vs Node.js (a comparação mais justa)

| Aspecto | Node.js (Express/Fastify) | Go (net/http) |
|---|---|---|
| **Modelo de Concorrência** | Single-threaded com Event Loop. Funciona bem até um certo ponto, mas operações CPU-bound (hashing de API Keys, compressão de imagens) bloqueiam a thread e atrasam TODAS as outras requisições | Goroutines: threads ultra-leves gerenciadas pelo runtime. O Go pode ter 100.000 goroutines simultâneas consumindo ~200MB de RAM. Cada requisição roda em paralelo real, sem bloquear nada |
| **Consumo de Memória** | Um servidor Express básico consome ~50-80MB de RAM parado. Com 1000 conexões simultâneas: ~300MB+ | Um servidor Go básico consome ~8-12MB de RAM parado. Com 1000 conexões simultâneas: ~50MB |
| **Latência de Resposta** | Típico: 5-15ms por request simples | Típico: 0.5-2ms por request simples |
| **Deploy na VPS** | Precisa instalar Node.js, npm, gerenciador de processos (PM2), manter versões atualizadas | Compila para um único binário. Você copia o arquivo para o servidor e roda. Não precisa instalar nada. |
| **Custo na VPS** | Uma VPS de $5 (512MB RAM) aguenta ~500 req/s antes de engasgar | A mesma VPS de $5 aguenta ~5.000-10.000 req/s tranquilamente |
| **Tipagem e Bugs** | JavaScript é dinâmico. Erros de tipo aparecem em produção. TypeScript ajuda, mas é uma camada extra que precisa transpilar | Go é estaticamente tipado e compilado. Se o código compila, os tipos estão corretos. Sem surpresas em runtime |
| **Webhooks (Disparo assíncrono)** | Você precisa de uma fila externa (Redis/BullMQ) para não bloquear o event loop | Goroutines nativas resolvem isso com `go dispararWebhook()`. Zero dependência extra |

### Por que NÃO Python (Django/FastAPI)?
Python é ~10-50x mais lento que Go em throughput bruto. Para uma API que recebe eventos
de centenas de sites simultaneamente, Python exigiria uma VPS muito mais cara para aguentar
a mesma carga. Além disso, o deploy em Python envolve gerenciar virtualenvs, pip, Gunicorn, etc.

### Por que NÃO Java (Spring Boot)?
Java consumiria ~200-500MB de RAM só para iniciar a JVM. Na nossa VPS de $5 com 512MB,
sobraria quase nada para o MySQL. Go inicia em <100ms e consome 10MB.

### Referência de mercado
- **Shopify** migrou serviços críticos de Ruby para Go por questões de performance.
- **Cloudflare**, **Uber**, **Twitch**: Backends de alta ingestão em Go.
- **Docker**, **Kubernetes**, **Terraform**: Ferramentas de infraestrutura escritas em Go.

**Veredicto:** Go é a linguagem que foi literalmente projetada pelo Google para resolver
o problema exato que o Kalidash tem: receber muitas requisições HTTP simultâneas
com o menor custo de hardware possível.

---

## 4. Por que MySQL sem Redis? (O Modelo Shopify)

### O que o Redis faz (e por que parece tentador)
Redis é um banco de dados **em memória** (RAM). Ele é absurdamente rápido (~0.1ms por leitura)
porque não toca no disco. As pessoas o usam como "cache" — uma camada intermediária entre
a aplicação e o banco de dados principal para evitar consultas repetidas ao MySQL.

### Por que NÃO precisamos dele agora

**1. Go já é o nosso "Redis"**
A maioria dos projetos que precisam de Redis usam linguagens lentas (Python, Ruby, PHP).
Eles colocam Redis na frente do MySQL para compensar a lentidão da linguagem.
Go é tão rápido que uma query simples ao MySQL (`SELECT * FROM leads WHERE project_id = 5`)
retorna em ~1-3ms. Com Redis, retornaria em ~0.1ms. A diferença de 2ms é **imperceptível**
para o usuário humano. Não justifica a complexidade adicional.

**2. Complexidade de Invalidação de Cache (O Problema Nº 1 da Computação)**
Se usarmos Redis como cache, toda vez que um lead novo entrar no MySQL, precisamos:
- Invalidar o cache do dashboard daquele projeto
- Invalidar o cache da lista de leads
- Invalidar o cache do contador de leads
- Invalidar o cache do gráfico de inbound

Se esquecermos de invalidar UM desses, o painel mostra dado antigo. O vendedor acha que não
tem lead novo. O cliente reclama. Isso é o famoso ditado: *"As duas coisas mais difíceis
da computação são: invalidação de cache e dar nome às coisas."*

**3. Mais uma peça para quebrar (e pagar)**
Redis na VPS = mais um processo rodando, consumindo RAM que poderia estar no MySQL.
Redis gerenciado (ex: Upstash) = mais uma fatura mensal, mais uma credencial para gerenciar,
mais um ponto de falha. Se o Redis cair e a aplicação não tiver fallback, tudo para.

**4. MySQL com índices bem feitos é absurdamente rápido**
O MySQL com InnoDB, quando tem os índices certos, responde queries de
`SELECT` em <5ms mesmo com 1 milhão de registros. Para o volume inicial do Kalidash
(centenas a milhares de leads por mês), MySQL sozinho aguenta sem suar.

### O Modelo Shopify
A Shopify processa **bilhões de dólares** em transações e operou por anos com uma
arquitetura MySQL-first sem Redis nos caminhos críticos. A filosofia deles:

> *"Não adicione complexidade para resolver um problema que você ainda não tem."*

Eles usam MySQL com **sharding horizontal** (dividir as tabelas em múltiplos servidores
quando necessário) e só adicionam cache onde mediram que existe um gargalo real.

### Quando adicionaremos Redis (no futuro)?
- **Quando tivermos métricas provando** que uma query específica está lenta (>100ms)
  e é chamada centenas de vezes por segundo.
- **Para sessões de WebSocket**, se o número de conexões simultâneas justificar.
- **Para filas de webhook**, se as Goroutines do Go não forem suficientes
  (improvável antes de ~10.000 webhooks/minuto).

**Veredicto:** Redis é uma ferramenta extraordinária, mas adicioná-la hoje seria
engenharia prematura. Cada camada extra no sistema é uma camada que pode quebrar,
que precisa de monitoramento e que custa dinheiro. O MySQL com Go é mais do que
suficiente para levar o Kalidash do zero aos primeiros milhares de clientes.

---

## Resumo Visual da Filosofia

```
┌─────────────────────────────────────────────────────────┐
│                    PRINCÍPIO KALIDASH                    │
│                                                         │
│   "Cada peça no sistema precisa justificar sua          │
│    existência. Se ela não resolve um problema            │
│    que já existe, ela É o problema."                     │
│                                                         │
│   ✅ Vite Admin  → Leve, rápido, sem servidor           │
│   ✅ Next.js Site → SEO obrigatório, ISR nativo         │
│   ✅ Go Backend  → 10x menos RAM, 10x mais throughput   │
│   ✅ MySQL puro  → Simples, confiável, barato           │
│   ❌ Redis       → Problema que ainda não temos         │
│   ❌ Sanity      → Dependência que não precisamos       │
└─────────────────────────────────────────────────────────┘
```
