# Handoff — preview do blog, Home e contrato (01/10/2026)

**Status:** blog com preview real e publicação instantânea (commitado e pushado até `d98b0e6`; `d71c106` commitado, **sem push**); **Home pronta para aprovação** (conferida contra o PDF; não commitada); contrato v2 pronto para assinatura (fora do repositório).

## Resumo do que mudou

### 1. Blog (commits `d98b0e6` e `d71c106`)
- **Cartões de artigo editáveis na Galeria Principal.** Novo bloco do BlockNote (`articleCard`) que aponta para um artigo real: título, resumo e capa editáveis, ordem = ordem no `/blog`, 1º cartão = destaque. As edições dos cartões são gravadas nos artigos ao salvar a galeria.
- **O preview agora é o site real**, num iframe (`/preview/blog` e `/preview/article`), recebendo o rascunho por `postMessage`. O admin deixou de importar CSS do site e os hacks de `!important` saíram.
- **Contrato de design** (`data-block` / `data-variant` / `data-role` / `data-focus`): o visual vive só em `apps/site`; o admin só escolhe conteúdo e ordem. Documentado em [blog-design-contrato.md](../blog-design-contrato.md).
- **Clique no preview foca o campo** correspondente no editor (cartão, título, resumo, texto).
- **Publicação na hora:** a API (`revalidate.go`) avisa o site ao criar, editar ou excluir artigo e `/blog` regenera em ~2 s (antes, até 60 s). Sem `SITE_URL` e `REVALIDATE_SECRET` volta ao comportamento antigo.
- **Segurança do iframe:** só `NEXT_PUBLIC_ADMIN_ORIGINS` embute as rotas e troca mensagens; as rotas de preview são `noindex` e sem cache; `/api/revalidate` exige segredo e só aceita `/blog*`.
- Verificado: estilos do site real idênticos ao baseline (artigo 0 diferenças; `/blog` só ruído de 0,03 px).

### 2. Home / LP (não commitada)
- Refeita **do zero** a partir de [Home.pdf](../Home.pdf), substituindo o rascunho `HomeLayout.tsx` (backup no scratchpad da sessão). Código em `apps/site/src/app/home/`; documentação em [pagesClient/home.md](../pagesClient/home.md).
- **As imagens foram extraídas do próprio PDF** (fotos, logos de clientes e o consultor recortado), em `apps/site/public/home/`. Medidas, cores e fontes também vêm do PDF (design de 1920 px, container de 1280 px, Inter, roxo `#462f4f`, acento `#b6644d`).
- Os PDFs de política em `apps/site/public/` (`politica-privacidade.pdf`, `politica-vulnerabilidades.pdf`) eram placeholders de texto e foram **substituídos pelos documentos reais** (as cópias originais com nome acentuado seguem lá).
- **Estado final:** conferida contra o PDF a 1920 px. A altura total é idêntica (6241 px), as seções ficam a ±3 px e as larguras de texto a 1–2 %. Celular (390 px) sem estouro horizontal; carrosséis, menu e formulário testados. Também entraram: `sitemap.xml`, `robots.txt`, Open Graph e JSON-LD da organização. `next build` passa; o lint dos arquivos da Home está limpo (2 erros preexistentes em `MobileMenu.tsx` e no splash, de outra sessão).
- **Conteúdo que eu completei e precisa de aprovação da Carol:** legendas dos cases (o design tinha lorem ipsum) e as frentes 2 e 3 do carrossel. Estão em `content.ts`.
- **Pendente de conteúdo/ligações:** ver a lista em [pagesClient/home.md](../pagesClient/home.md#pendências-de-conteúdo-precisam-da-carol).

### 3. Contrato v2 (fora do repositório)
Os valores, CNPJs e endereços ficam só no documento (pasta `Carol/`, ao lado do repositório). O que mudou em relação à versão anterior:
- **Prazo:** 2 meses de execução com o sistema **testado e em produção ao final**; até **1 mês de acompanhamento** (extensão opcional, sem custo adicional); **2 meses de garantia** (antes eram 3). O código, as credenciais e a documentação são entregues aos 2 meses.
- **SOLYD** definido como o nome de referência da arquitetura (Anexo I passou à versão 2.0, "em execução").
- **Specs atualizadas:** BlockNote no lugar de Tiptap; **multi-projeto** no lugar de multi-tenant; upload de imagem redimensionado e guardado no Cloudflare R2 (incluído na lista de serviços de terceiros); o HTML do blog é gerado do documento estruturado do editor.
- **Painel de permissões por perfil agora é escopo** (perfis Admin, Gerente e Vendedor); saiu da lista de exclusões.
- **Hospedagem:** Vultr SP ou DigitalOcean, escolhida pela Kalidash **na hora de subir**.
- **NFS-e:** uma nota do sinal e outra do saldo, nos valores base.
- **Correções de texto:** 4 referências cruzadas erradas, datas recalculadas a partir do início em 02/10 e capa em "Outubro de 2026".

### 4. Ambiente de visualização na Vercel (para a Carol aprovar a Entrega 1)
- **URL:** https://kalidash-site-one.vercel.app (projeto `kalidash-site`, conta `brtzolkin-2570's projects`). Acesso público, **sem login**, e com `X-Robots-Tag: noindex` em qualquer `*.vercel.app` (o canonical e o sitemap apontam para o domínio final).
- **Projeto novo e separado.** O `kalidash-landing` existente está ligado a **outro repositório** (`Kalidash_LandingPage_01_-evento-`) e não foi alterado; o `kalidash-site-admin` é o admin.
- Configuração: raiz `apps/site`, Next.js, Node 24, instalação pelo `vercel.json` da raiz (`pnpm install --frozen-lockfile`). O projeto ficou **conectado ao repositório `Kalidash_Site`**: um push na `main` passa a gerar deploy sozinho (desconectar em Settings → Git, se não quiser).
- **Como republicar a partir do código commitado** (evita levar alterações soltas de outras sessões): `git worktree add --detach <pasta> HEAD`, depois `vercel link --yes --project kalidash-site` e `vercel deploy --prod --yes` dentro da pasta; por fim remover a pasta. Cuidado: rodar `vercel link` na raiz do repositório cria `.vercel/`, um `.env.local` com token e linhas no `.gitignore` (já aconteceu uma vez por engano e foi desfeito).
- **Sem API no ar:** o blog aparece vazio (fallback) porque `API_URL` não aponta para nada; a Home não depende dela.
- O plano Hobby da Vercel é de **uso não comercial**; serve para a aprovação, mas o site de produção vai para o EasyPanel.
- **Correção que o deploy exigiu:** o `package.json` (raiz e site) estava sem commit enquanto o lockfile já tinha as dependências, e `pnpm install --frozen-lockfile` falhava (`ERR_PNPM_OUTDATED_LOCKFILE`). Alinhado no commit `3086260`; sem ele o deploy no EasyPanel a partir do git falharia do mesmo jeito.

## Decisões desta data
1. O design do blog e da Home fica no site; o admin não escreve CSS (preview = iframe do site).
2. O preview começa em "editor neutro + site real ao lado" (a edição direto na página fica como fase 2).
3. Painel de permissões entra no escopo; hospedagem decidida na implantação.
4. Specs que mudaram foram **atualizadas no contrato**, não tratadas como defeito (BlockNote, multi-projeto, sanitização do HTML do blog).

## Riscos e avisos
- **Segurança continua por último** (decisão de 26/09), mas o contrato agora promete tudo até a Entrega 4: login Google, perfis, sanitização/limites, firewall e backups. Hoje a API está aberta (CORS `*`), sem login, e o site renderiza o HTML do artigo sem sanitizar.
- **Banco:** ainda no EasyPanel de outro domínio, acessível de fora; precisa migrar para a VPS da Kalidash antes da Entrega 4. Há credenciais em arquivos locais (`apps/api/.env`, `scratch/reseed_blog.js`, `apps/api/scripts/test.go`): trocar a senha.
- **Portas em dev:** durante a sessão, `3000` e `3100` chegaram a ser ocupadas por **outros projetos** (um `serve` estático e um `server.mjs`); a entrada temporária do `launch.json` foi **desfeita** e o site voltou à 3000. Se a porta estiver ocupada de novo, confira com `Get-NetTCPConnection -LocalPort 3000` antes de matar qualquer coisa. O iframe do admin usa `VITE_SITE_URL` (padrão `http://localhost:3000`).
- **Arquivo do contrato antigo** ainda em `apps/site/public/` (PDF com extensão `.docx`): seria publicado no deploy. Mover ou apagar.
- Segredos locais: `REVALIDATE_SECRET` foi gerado e gravado em `apps/site/.env.local` e `apps/api/.env` (ignorados pelo git). Em produção, gerar outro.
- Arquivos de outras sessões que **não** entraram nos commits: `drawer.css`, `package.json`, `layout.tsx`, `globals.css`, a landing Motion (`MotionView` etc.), `BlogSettings` em `lib/blog.ts`, `30-09/`.

## Marca (logo e favicons)
- O logo vetorial foi extraído da `Home.pdf` (não havia os arquivos "new" avulsos): `apps/site/public/brand/` (`logo`, `logo-white`, `symbol`, `symbol-white` em SVG + `icon-512.png`). **Se existir outro arquivo oficial, trocar os SVGs e regerar os ícones.**
- Site: `app/icon.svg`, `app/favicon.ico` (16/32/48), `app/apple-icon.png` (convenção de arquivos do Next). Atenção: o `layout.tsx` não commitado de outra sessão tem `icons: { icon: "/kalidash-symbol.svg" }`, que sobrepõe esses arquivos — remover esse bloco quando aquele trabalho for resolvido.
- Header da Home: `components/BrandLogo.tsx` (SVG inline) com animação de entrada (faixas douradas, chevron, letras em sequência) e de hover (onda nas letras; ativa em link com `data-logo-hover`). Respeita `prefers-reduced-motion`.
- Admin: `public/` atualizado (logos, ícones 192/512, `icon-maskable-512.png`, `favicon.svg/.ico`); modo escuro usa a versão branca em vez de `invert`.

## Próximos passos
1. Commitar e dar push da Home e dos docs (hoje só local), e publicar o ambiente de visualização para a aprovação da Entrega 1.
2. Pedir à Carol os conteúdos pendentes da Home (WhatsApp, redes, cases, frentes do carrossel, autorizações).
3. ~~Rota pública de captura de lead~~ feita em 02/10 (`apps/api/public_leads.go`); falta definir `NEXT_PUBLIC_LEAD_ENDPOINT` e `ALLOWED_ORIGINS` nos ambientes e testar um envio real.
4. Fase de segurança: sanitização, login, perfis, CORS restrito, banco fora da exposição pública.
