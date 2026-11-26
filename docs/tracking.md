# Rastreamento (tracking) do Kalidash

> Fonte de verdade do rastreamento: UTMs, eventos, Meta (Pixel + API de Conversões), GA4, Clarity e conversões
> offline. Decisão de 26/11/2026: **GA4 e Meta Pixel ficam direto no código, não no GTM.**

## 1. Decisão: GA4 e Pixel direto no código, GTM só para extras

| O quê | Onde | Por quê |
|---|---|---|
| GA4 (gtag.js) | `apps/site/src/app/components/Analytics.tsx` (`NEXT_PUBLIC_GA_MEASUREMENT_ID`) | O código sabe, a cada envio, se o GA4 já saiu pelo servidor (`serverSide.ga4`) e não repete no navegador. |
| Meta Pixel | idem (`NEXT_PUBLIC_META_PIXEL_ID`) | O `event_id` de cada envio é gerado no código e precisa ser o mesmo no Pixel e na API de Conversões. |
| Microsoft Clarity | idem (`NEXT_PUBLIC_CLARITY_PROJECT_ID`) | Recebe as UTMs como tags e os eventos de conversão do código. |
| GTM | `NEXT_PUBLIC_GTM_ID` | **Só tags extras** (LinkedIn Insight, Google Ads remarketing, Hotjar etc.), lendo o dataLayer. |

**Regra:** nunca crie tag de GA4 (Configuração ou Evento) nem de Meta Pixel dentro do GTM. Com o código já carregando
os dois, cada visita e cada conversão contariam em dobro, e a deduplicação por `event_id` não vale para a tag do GTM.

## 2. Convenção de UTMs

Todos os links de campanha seguem esta convenção. A API grava as UTMs já normalizadas (minúsculas, espaço → `_`), mas
**o GA4 lê a URL como ela veio**: `Instagram` e `instagram` viram duas origens no GA4. Por isso a convenção vale na
criação do link, não só na gravação.

- Tudo em **minúsculas**, sem acento, sem espaço (use `_`) e sem caracteres especiais além de `_` e `-`.
- Os cinco parâmetros: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`.
- Ids de clique (`gclid`, `fbclid`, `gbraid`, `wbraid`) são colocados pelas plataformas: **não edite**.

| Canal | `utm_source` | `utm_medium` | `utm_campaign` | `utm_content` |
|---|---|---|---|---|
| Meta Ads (Instagram/Facebook) | `meta` | `paid_social` | `<tema>_<aaaamm>` ex.: `material_ia_202611` | `<anuncio>` ex.: `video_carol_01` |
| Google Ads | `google` | `cpc` | `<tema>_<aaaamm>` | `<grupo>` |
| LinkedIn Ads | `linkedin` | `paid_social` | `<tema>_<aaaamm>` | `<anuncio>` |
| Orgânico Instagram (bio, stories, "comente aqui") | `instagram` | `social` | `<tema>` | `bio` \| `stories` \| `comentario` \| `dm` |
| Orgânico LinkedIn | `linkedin` | `social` | `<tema>` | `post` \| `comentario` \| `perfil` |
| WhatsApp (lista, grupo, 1:1, status) | `whatsapp` | `messaging` | `<tema>` | `lista` \| `grupo` \| `direto` \| `status` |
| YouTube (descrição) | `youtube` | `social` | `<tema>` | `descricao` |
| TikTok (bio) | `tiktok` | `social` | `<tema>` | `bio` |
| Assinatura de e-mail | `email` | `email` | `<tema>` | `assinatura` |
| Newsletter (edições do admin) | `newsletter` | `email` | `<slug do artigo>` | — |

**Orgânico: não monte à mão.** Use o admin, **Links de divulgação** (seção 2.1): ele gera os links de todos os canais
orgânicos acima já na convenção. Para separar duas peças do mesmo tema, o campo "Peça" vira o fim do `utm_content`
(ex.: `stories_reels_01`).

Exemplo (link do "comente aqui" no Instagram que leva ao material):
`https://kalidash.com.br/blog/guia-ia?utm_source=instagram&utm_medium=social&utm_campaign=material_ia&utm_content=comentario`

### 2.1 Links de divulgação (tagueamento orgânico)

Admin > **Links de divulgação** (`apps/admin/src/pages/Links.tsx`, quem edita o blog). Escolha o conteúdo (página do
site ou artigo publicado), confira o tema (`utm_campaign`, vem do slug) e copie, por canal:

- **Link curto** `kalidash.com.br/l/<código>`: para bio, stories e WhatsApp. O site (`apps/site/src/app/l/[code]/route.ts`)
  pergunta à API (`GET /api/public/links/<código>`) e redireciona (302) para a página com as UTMs; o tracking do site
  guarda a atribuição normalmente e o referrer original (Instagram, LinkedIn) segue junto. Código desconhecido ou
  arquivado leva para a home. Robôs de prévia (WhatsApp, LinkedIn, Instagram) seguem o link mas não contam clique.
- **Link completo** com as UTMs: o mesmo destino, para onde o endereço não aparece (botão, e-mail).

Os links ficam na tabela `CampaignLink` (`apps/api/campaign_links.go`): o mesmo destino com as mesmas UTMs reaproveita
o mesmo código. A aba "Links criados" mostra cliques e leads (leads cuja última campanha bate com a do link). O destino é
sempre um caminho do próprio site, nunca um endereço externo (o link curto não vira redirecionamento aberto).

## 3. Atribuição (o que é guardado e quando)

Site (`apps/site/src/lib/tracking.ts`) e LPs (`apps/api/connect_script.js`) usam a mesma lógica, guardada no
`localStorage` do domínio (`kld_attr`) na primeira página vista, antes de qualquer navegação:

- **Último toque**: `utm_*` e ids de clique. Troca inteiro quando chega uma nova campanha; expira em 90 dias.
- **Primeiro toque**: `first_utm_source/medium/campaign`, `landing_page`, `first_seen_at`. Gravado uma vez, nunca muda.
- **Referrer externo** da sessão (`sessionStorage`, `kld_referrer`).
- No envio também vão `page_url`, `device`, `_fbp`, `_fbc` (cookie do Pixel ou montado do `fbclid` guardado),
  `ga_client_id` e `ga_session_id` (site).

A API guarda só as chaves conhecidas (`attributionKeys`, `apps/api/connect_ingest.go`) em `Lead.customData.attribution`,
e o IP, o navegador e o `event_id` do envio em `Lead.customData.match` (usados nas conversões offline).

## 4. Eventos

Cada envio de formulário tem um `event_id` (UUID gerado no navegador, repetido nas novas tentativas). A tabela
`TrackingEvent` garante **1 lead e 1 conversão por `event_id`** (clique duplo, nova tentativa, reenvio).

| Momento | Meta (Pixel + CAPI, mesmo `event_id`) | GA4 (uma camada só) | dataLayer | Clarity |
|---|---|---|---|---|
| Diagnóstico / contato no site | `Lead` | `generate_lead` | `lead_form_submitted` | `lead_submitted` |
| Formulário de LP (`connect.js`) | `Lead` | `generate_lead` | `lead_form_submitted` | `lead_submitted` |
| Newsletter do blog | `CompleteRegistration` (`content_category: newsletter`) | `sign_up` (`method: newsletter`) | `newsletter_signup` | `newsletter_signup` |
| Material gratuito dos guias | `CompleteRegistration` (`content_category: material`) | `sign_up` (`method: material`) | `material_signup` | `material_signup` |
| Lead qualificado no CRM (offline) | `QualifiedLead` (`system_generated`, valor estimado) | `qualify_lead` | — | — |
| Oportunidade em etapa Ganha (offline) | `Purchase` (`system_generated`, valor, BRL) | `close_convert_lead` | — | — |

- **GA4, uma camada só**: com `GA4_MEASUREMENT_ID` + `GA4_API_SECRET` na API, o evento sai do servidor (Measurement
  Protocol, com o `client_id` do navegador) e a resposta avisa o navegador para não repetir. Sem eles, sai do gtag.
- **`Lead` é só diagnóstico/contato**: inscrição não é Lead, para as campanhas que otimizam por Lead não se misturarem.
  Para campanhas de material, crie na Meta uma **conversão personalizada**: evento `CompleteRegistration` com o filtro
  `content_category` = `material`.
- **Conversões offline** (`apps/api/offline_conversions.go`): só leads INBOUND e fora do modo de teste, uma vez por lead
  e por etapa (`qualified-<lead>`, `won-<oportunidade>`). Lead de projeto conectado só entra se o projeto tiver
  "Conversões de mídia" ligado. Oportunidade sem valor vai como `Purchase` com `value` 0 (a Meta recusa sem valor).
  `OFFLINE_CONVERSIONS=0` desliga.

## 5. Correspondência (nota de qualidade da Meta)

Todo evento da API de Conversões leva: `em` e `external_id` (hash do e-mail), `ph`, `fn`, `ln`, `country` (com hash),
`client_ip_address`, `client_user_agent`, `fbp` e `fbc`. O proxy do site (`apps/site/src/app/api/leads/route.ts`) repassa
o IP (`X-Forwarded-For`) e o navegador (`X-Client-User-Agent`) do visitante para a API.

Para subir a nota: pedir cidade/estado/CEP nos formulários (`ct`, `st`, `zp`) e conferir a nota no Gerenciador de Eventos
(Meta > Gerenciador de Eventos > conjunto de dados > Visão geral > evento > Qualidade da correspondência).

## 6. LPs conectadas (`connect.js`)

```html
<script src="https://API/connect.js" data-key="kld_live_..." defer></script>
```

- **Conversões de mídia (opt-in por projeto)**: em Projetos > Editar projeto, "Conversões de mídia". Ligado, cada lead
  do projeto vira `Lead` (e depois `QualifiedLead`/`Purchase`) no Pixel e no GA4 **do Kalidash** pelo servidor. Padrão
  desligado: LP de cliente com pixel próprio não pode cair nas campanhas do Kalidash. Desligado, a API não manda nada e
  responde `serverSide` vazio (o `connect.js` ainda dispara o Pixel/gtag que a própria página carregar).
- **Um evento por lead**: o mesmo formulário reenviado com os mesmos dados em até 10 minutos (clique duplo, nova
  tentativa) reaproveita o `event_id`; a API responde `duplicate` e não grava o 2º lead nem a 2ª conversão, e o Pixel
  não dispara de novo. Envio que a API recusaria (honeypot preenchido, sem nome, sem contato válido) não dispara Pixel.
- A LP **não deve disparar o próprio `Lead`** no envio do formulário: o `connect.js` já dispara o Pixel com o
  `event_id` e a API manda o mesmo evento pelo servidor. Disparar de novo conta em dobro.
- `data-pixel="off"` / `data-ga="off"` na tag desligam o disparo no navegador (o servidor continua mandando).
- Chave de teste (`kld_test_`) grava o lead com a tag *Teste* e não manda nada para a mídia.
- O Clarity só é usado se a LP já o carrega (o `connect.js` não instala).
- Evento para a página: `window` `kalidash:lead` com `{ ok, status, form, eventId }`.

## 7. Variáveis

| App | Variável | Para quê |
|---|---|---|
| site | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 no navegador |
| site | `NEXT_PUBLIC_META_PIXEL_ID` | Pixel no navegador |
| site | `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Clarity |
| site | `NEXT_PUBLIC_GTM_ID` | GTM, só para tags extras (seção 1) |
| api | `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` | API de Conversões |
| api | `META_TEST_EVENT_CODE` | Validar na aba "Testar eventos" (apague depois) |
| api | `GA4_MEASUREMENT_ID`, `GA4_API_SECRET` | GA4 pelo servidor (Measurement Protocol) |
| api | `OFFLINE_CONVERSIONS` | `0` desliga as conversões offline |

**Ambiente local:** use ids de GA4/Pixel de teste (ou deixe vazio) no `.env.local` do site; com os de produção, as
visitas de `localhost` entram nos relatórios reais.

## 8. Como verificar

1. **Navegador**: abra o site com UTMs, envie um formulário e confira em DevTools > Application > Local Storage
   (`kld_attr`) e na aba Network o corpo do `POST /api/leads` (`event_id` e `attribution`).
2. **Meta**: preencha `META_TEST_EVENT_CODE` na API e veja o evento chegar em "Testar eventos", com "Navegador" e
   "Servidor" deduplicados.
3. **GA4**: DebugView (Admin > DebugView) ou o relatório Tempo real.
4. **Banco**: `SELECT name, source, metaStatus, ga4Status, lastError FROM TrackingEvent ORDER BY createdAt DESC LIMIT 20;`
   (`sent` = entregue, `skipped` = camada sem configuração, `failed` = ver `lastError`).

## 9. Analytics (admin, `/analytics`)

Página só de leitura: nenhuma tabela nova e nenhum evento ou página vista gravado. Canais, campanhas e receita são
calculados no admin a partir dos leads e oportunidades (`apps/admin/src/lib/channels.ts` e `acquisitionMetrics.ts`);
a saúde das conversões vem de `GET /api/analytics/tracking-health` (SELECT agregado em `TrackingEvent`, escopo
`leads:read`).

**O que cada número conta**

- **Coorte**: leads criados no período (arquivados ficam fora) e tudo o que geraram depois, mesmo que a venda feche
  fora da janela. A oportunidade do lead vem de `convertedOpportunityId` ou do `leadId` da oportunidade.
- **Pipeline gerado**: soma do valor das oportunidades da coorte. **Receita ganha**: só as em etapa ganha.
- **Qualificados**: lead com status `QUALIFIED` ou com oportunidade fora da etapa de lead.
- **Ciclo**: mediana de dias entre a criação do lead e o ganho.
- **Taxas** só aparecem com 5 casos ou mais; abaixo disso, "—". Comparação: mesma duração imediatamente antes.

**Regra de canais** (primeira que bater): Outbound → Projeto conectado → Google Ads (`gclid`/`gbraid`/`wbraid` ou
`cpc`) → Meta Ads (`paid_social`) → Orgânico · rede (`social`; `fbclid` sozinho também é orgânico, porque a Meta o
põe em links de post) → WhatsApp (`messaging`) → E-mail e newsletter (`email`) → Busca orgânica (referrer de
buscador) → Indicação (outro referrer) → Direto / sem origem.

- **Primeiro toque** (padrão) usa `first_utm_*` e `landing_page`; se a descoberta foi sem campanha e a campanha veio
  depois, o lead conta como Direto. Lead antigo sem primeiro toque gravado usa o último.
- **Último toque** usa as UTMs do momento do formulário.
- **Sem origem acima de 30%** dos leads do site liga o aviso: a leitura por canal deixa de ser confiável.

**Investimento em mídia** (`GET /api/analytics/spend?from=AAAA-MM-DD&to=AAAA-MM-DD`, `apps/api/analytics_spend.go`):
gasto por campanha lido na hora da Meta (Marketing API, insights por campanha) e do Google Ads (Google Ads API,
GAQL em `googleAds:searchStream`), com cache de 15 minutos em memória e nada gravado. Cada plataforma entra sozinha
quando as variáveis dela existem (lista em `apps/api/.env.example`); uma que falha mostra o erro e não derruba a
outra.

- A campanha da plataforma casa com o `utm_campaign` do lead pelo nome normalizado (sem acento, minúsculo, `_` no
  lugar de espaço). Por isso o nome da campanha no gerenciador precisa ser o mesmo do `utm_campaign`, ou o anúncio
  usa a UTM dinâmica do nome da campanha.
- Com investimento, o resumo ganha **Investimento** e **Custo por lead qualificado** (com o retorno, receita ÷
  investimento); canais e campanhas ganham investimento, custo por qualificado e retorno.
- Campanha ou canal com gasto e nenhum lead no período aparece com zero leads e o aviso "Gastou sem trazer lead".
- Versões: Marketing API `v26.0` e Google Ads API `v26` por padrão (`META_ADS_GRAPH_VERSION`,
  `GOOGLE_ADS_API_VERSION`). As duas plataformas aposentam versões; ao ver erro de versão, suba o número.

**Próxima etapa**: o campo opcional "Como você conheceu a Kalidash?" para comparar a origem declarada com a
rastreada.
