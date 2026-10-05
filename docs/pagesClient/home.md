# 🏠 Home (Landing Page)

**Objetivo:** converter visitantes orgânicos e tráfego pago em leads, levando-os ao **Diagnóstico Estratégico Gratuito** (formulário no fim da página).

**Status (01/10/2026):** pronta para aprovação (Entrega 1). Implementada a partir do design [Home.pdf](../Home.pdf) (1920 px) e conferida contra ele: a altura total é idêntica (6241 px), as seções ficam a ±3 px e as larguras de texto a 1–2 %. Build de produção, lint dos arquivos da Home, sitemap, robots e Open Graph verificados. O que falta são conteúdos que só a Carol define (abaixo).

## Onde está

| O quê | Arquivo (`apps/site/src/app/home/`) |
|---|---|
| Estrutura (HTML) | `HomePage.tsx`, `HomeHeader.tsx` (menu), `Carousel.tsx`, `DiagnosticoForm.tsx` |
| Design (CSS) | `home.module.css` — variáveis de cor e largura no topo |
| Textos, links e imagens | `content.ts` |
| Ícones | `icons.tsx` |
| Imagens | `apps/site/public/home/` (extraídas do próprio PDF) |

Contrato de atributos (`data-block="home-…"`) em [blog-design-contrato.md](../blog-design-contrato.md#home-lp).

## Seções (na ordem do design)

1. **Cabeçalho** fixo: logo, menu (Para empresas, Sobre nós, Cases, Blog, Produtos, Contato) e "Fazer Diagnóstico".
2. **Hero:** título "Transforme dados, processos e tecnologia em eficiência operacional".
3. **Problema:** consultor recortado, cartão roxo "O problema raramente é falta de tecnologia…" e 4 colunas (dados dispersos, depoimento, sistemas desconectados, decisões sem visão).
4. **Depoimento** do CMO da Tô Garantido e faixa de logos de clientes.
5. **Do desafio à solução em operação:** cartão "Inteligência de dados" + foto (carrossel).
6. **Método validado:** foto + texto.
7. **Transformação que acontece de verdade:** carrossel de 5 fotos de eventos e imersões.
8. **Diagnóstico:** chamada e formulário.
9. **Rodapé:** links, política de privacidade, divulgação responsável e redes.
10. Botão flutuante de **WhatsApp**.

## Formulário do diagnóstico

Campos: nome e sobrenome, e-mail corporativo, WhatsApp com DDD e o maior desafio com dados. Valida no navegador e envia (`POST` JSON, com `source: "site-home-diagnostico"`) para `NEXT_PUBLIC_LEAD_ENDPOINT`.

> **Captura (02/10):** a API tem `POST /api/public/leads` (`apps/api/public_leads.go`): valida, limita 5 envios/min por IP, confere a origem (`ALLOWED_ORIGINS`/`SITE_URL`), descarta robôs pelo campo-isca `website` e grava **Contato + Oportunidade na coluna INBOUND + Nota** numa transação (reaproveita o contato pelo e-mail). Para ligar: definir `NEXT_PUBLIC_LEAD_ENDPOINT` no site e `ALLOWED_ORIGINS` na API. Recorte do contrato completo de [inbound-leads.md](../inbound-leads.md) (tokens por fonte, pipelines e `connect.js` entram com a fase de segurança).

## Pendências de conteúdo (precisam da Carol)

- [ ] Link do **WhatsApp** (`NEXT_PUBLIC_WHATSAPP_URL`). Hoje o botão leva ao formulário.
- [ ] URLs de **Facebook e YouTube** (o ícone só aparece se houver URL). O **Instagram** (`@kalidash.metrics`) foi tirado de um slide de foto: confirmar.
- [ ] **Legendas dos cases:** o design tinha lorem ipsum; troquei por legendas que descrevem o que cada foto mostra (a 1ª é do design). Confirmar ou trocar por cases reais (cliente, evento, resultado). A foto 4 é da Cooxupé.
- [ ] **Frentes 2 e 3 do carrossel "Do desafio à solução":** o design só trazia "Inteligência de dados". As outras duas (Automação de processos e IA aplicada) foram escritas com palavras da própria Kalidash (slide da imersão e texto de abertura). Aprovar ou trocar.
- [ ] **Autorização de uso** dos logos de clientes e dos depoimentos (André, Aline Motta). Há 8 vídeos de depoimento na pasta do Drive que **não** foram usados (~1,3 GB; se entrarem, hospedar fora do repositório e carregar no clique).
- [ ] Itens do menu com seta (**Para empresas**, **Produtos**): levam a uma seção da própria página; o design não define submenu.

## Pendências técnicas

- [ ] **Formulário do diagnóstico:** rota pronta; falta definir `NEXT_PUBLIC_LEAD_ENDPOINT` (site) e `ALLOWED_ORIGINS` (API) nos ambientes e testar um envio real.
- [x] SEO base: `sitemap.xml`, `robots.txt`, Open Graph e dados estruturados da organização.
- [x] Conferência de fidelidade desktop e revisão do celular (390 px, sem estouro horizontal).
- Lint: 2 erros **preexistentes** em `components/MobileMenu.tsx` e no splash (arquivos de outra sessão, fora da Home).

## Como conferir

Subir o site (`pnpm --filter @kalidash/site dev`) e abrir a Home em 1920 px de largura ao lado de [Home.pdf](../Home.pdf). O alvo é o PDF: títulos de 55 px, texto de 22 px, container de 1280 px.
