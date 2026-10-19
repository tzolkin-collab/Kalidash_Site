# Blog como CMS — visão do PO, decisões e pacotes (BC)

> Dono: sessão "PO". Mesmas regras de worker e régua de nota de `admin-checklist.md` (seções 5 e 6). Base: `relatorios/blog-auditoria.md` (nota **9,2**: cobertura e evidência excelentes, só não testou escrita nem `AUTH_API`). Criado em 18/10/2026.

## 1. Objetivo

O admin vira um CMS de verdade para o blog: criar e editar **slugs livremente**, montar o artigo com os blocos existentes, **reposicionar, duplicar e trocar assets**, configurar **SEO por artigo** e escolher **tipos de visualização** (layout do artigo e variantes de bloco), sem o admin escrever CSS. O design melhora no site e é governado por valores enumerados (regra de ouro de `docs/blog-design-contrato.md`).

## 2. Decisões do PO (18/10/2026)

Abordagem **C (híbrida)** do relatório: `bodyJson` com blocos customizados e props enumeradas como fonte; renderizador no site a partir do JSON; `layout` JSON por artigo; colunas de SEO; `body` HTML vira derivado/legado (`legacyHtml` sanitizado para os artigos antigos). Pacote compartilhado de esquema (`packages/blog-schema`) entre admin, site e API.

| # | Pergunta do relatório | Decisão |
|---|---|---|
| Q1 | Artigo `artigo-teste-template` público | Vira a **página-modelo interna** (fixture dourada dos testes). Até haver `noindex` (BC-1), o Gustavo **despublica** em produção; não apagar |
| Q2 | Tema Galeria escura × Artigo claro | **Decisão do Gustavo/Carol** (pendente). Os pacotes de design (BC-5) não começam sem ela |
| Q3 | Templates de layout | Proposta inicial: `standard`, `wide`, `longform`; hero `cover-top`, `cover-wide`, `cover-side`, `none`. **Carol valida** no BC-3 |
| Q4 | Cor/fundo livre de texto no editor | **Remover.** Só variantes (regra de ouro) |
| Q5 | Quem edita/publica | Escopos `blog:read`/`blog:write` do WP1.1; Vendedor sem Blog. Versões e aprovação: BC-6, opcional |
| Q6 | URL | Mantém `/blog/[slug]`; troca de slug **sempre** gera 301 |
| Q7 | Idiomas | Só pt-BR |
| Q8 | Autor | De usuário real da equipe (depois do login ligado), não do mock |
| Q9 | CTA e relacionados | CTA padrão com sobrescrita opcional por artigo; relacionados automáticos por categoria, com opção manual |
| Q10 | Categorias | Tags livres por ora |
| Q11 | Mídia | Só imagem com upload; vídeo por embed (YouTube/Vimeo) como bloco; AVIF/WebP gerados no upload |
| Q12 | Domínio final e R2 | **Gustavo** |
| Q13 | Agendamento / "atualizado em" | "Atualizado em" entra no BC-1; agendamento fica para depois |
| Q14 | Galeria automática ou curada | **Híbrida**: ordem curada vem primeiro, todo artigo publicado fora da ordem entra depois, por data. Corrige o bug "artigo novo some" |
| Q15 | Métricas por artigo | Depois |

## 3. Pacotes (BC), ordem e donos

| Pacote | O quê | Toca em | Pode começar |
|---|---|---|---|
| **BC-0a** Hotfix API + admin | `slugify` com maiúsculas e outros alfabetos, PUT sem slug gera do título, slug reservado `blog-global` (409), `GET /api/blog/slug-available`, galeria não descarta artigo novo (lado da API/ordem), imagens relativas no admin | `apps/api/blog.go`, `apps/admin/src/pages/Blog.tsx`, `lib/blog.ts` | **Agora** |
| **BC-0b** Hotfix site | `/blog/blog-global` → 404, `flatMap` da galeria, hidratação do `ShareButtons`, título duplicado | `apps/site/src/app/blog/*` | Quando o site estiver commitado e a posse do site decidida |
| **BC-1** SEO e slugs | Colunas `ogImageUrl/canonicalUrl/noindex/updatedBy`, `ArticleSlugHistory` + 301, metadata completa, JSON-LD, sitemap sem `noindex`, painel SEO no admin, "atualizado em" | API, admin, site | Depois do BC-0a |
| **BC-2** Esquema + blocos + renderizador | `packages/blog-schema`, blocos `callout`, `cta`, `figure`, `embed`, `pullQuote`, `columns`; renderizador React no site pelo JSON; `legacyHtml`; sanitização; remoção de cor livre; fixture dourada | pacote novo, admin, site | Depois do BC-0a (paralelo ao BC-1 na parte admin/API) |
| **BC-3** Layout por artigo e por bloco | Coluna `layout`, seletores no admin, `data-*` no site, validação no servidor, CTA editável | API, admin, site, CSS | Depois do BC-2 e da decisão Q2/Q3 |
| **BC-4** Operações de bloco e assets | Duplicar/mover/substituir, biblioteca de assets, `next/image`, upload com sessão | API, admin, site | Depois do BC-2 |
| **BC-5** Design e Galeria | Correções P0/P1 da crítica visual, cartões, relacionados, tema | site + CSS | Depois de Q2 |
| **BC-6** Versões e rascunho por link | Opcional | API, admin | Depois |

**Posse do site.** Hoje `apps/site` e o CSS são território da sessão Antigravity, com árvore **não commitada**. Todo pacote que toca o site (BC-0b, BC-1 parte site, BC-2 renderizador, BC-3, BC-5) depende de o Gustavo decidir: (a) o Antigravity faz essas partes, ou (b) ele commita o que tem e um worker meu assume o site no checkout.

## 4. Checklist de aceite — BC-0a

- [x] `slugify("Éxito na Operação") == "exito-na-operacao"`; `"Öffnung"` → `"offnung"`; título só com símbolos ou outro alfabeto produz slug não vazio e determinístico (ex.: translitera ou cai em `artigo-<id curto>`), com testes.
- [x] `PUT` sem slug gera do título, como a tela promete; nunca grava slug vazio; conflito → 409 com mensagem clara.
- [x] Slug reservado (`blog-global` e uma lista curta configurável) → 409 em POST e PUT.
- [x] `GET /api/blog/slug-available?slug=&exceptId=` (autenticado quando `AUTH_API=1`) e o admin mostra disponibilidade ao digitar o slug.
- [x] Gerar a ordem da galeria na API de modo que artigo publicado novo nunca fique de fora (a regra Q14 documentada; a leitura no site é do BC-0b).
- [x] Imagens com URL relativa do template aparecem no admin (resolver contra `VITE_SITE_URL`).
- [x] Com `AUTH_API=1` o admin do blog continua funcionando (o auditor marcou 🟡 HIPÓTESE): provar com sessão e corrigir `lib/blog.ts` para enviar credenciais se preciso.
- [x] Testes novos, `go vet`, build e navegador (banco descartável); nada em produção.

## 5. Registro

| Pacote | Sessão | Nota | Situação |
|---|---|---|---|
| Auditoria | blog-auditoria | **9,2** | Aceita. Verifiquei por conta própria o bug do `flatMap` em `blog/page.tsx:54` e que `CNH-e.pdf.pdf` e o contrato estão em `apps/site/public/` (ignorados pelo git, mas **presentes no disco**: risco se um deploy for feito pelo CLI da Vercel) |
| BC-0a | Antigravity | **—** | Concluído. Testes em Go (`blog_test.go`) passando, `go vet` limpo, testes do admin (57/57) passando, `tsc -b` e Vite build limpos. |
