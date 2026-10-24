# 📰 Blog Institucional & Site Cliente

**Objetivo:** Interface pública gerada pelo Next.js. Consome o próprio Banco do Kalidash.

## ⚠️ Problemas Antecipados & Soluções

1. **Problema: Sincronização de Conteúdo Estático (SSG)**
   - *O risco:* Como removemos o Sanity, o usuário escreve um post novo no Admin (salva no DB). Mas como o Next.js foi buildado de forma estática no deploy, a página do novo blog não existe na web, gerando erro 404 até alguém mandar rodar um novo Build na Vercel.
   - *A Solução:* Usar **ISR (Incremental Static Regeneration)** do Next.js. O Next gera a página na primeira vez que alguém acessa e depois salva no cache. Assim, garantimos SEO máximo sem precisar rodar build manual sempre que publicar um texto.

2. **Problema: Peso de Imagens no Blog**
   - *O risco:* Fazer upload de uma imagem de 5MB no Admin e o Next.js carregar isso no frontend, destruindo o SEO.
   - *A Solução:* O componente `next/image` já faz otimização. Mas na subida do arquivo no Admin, o Go deve cortar e comprimir (WebP) a imagem antes de jogar no S3/Supabase Storage.

## Contrato da API do blog (BC-0a, 24/10/2026)

**Slug.** `slugify` (Go) passa a minúsculas antes de tirar acentos (`"Éxito na Operação"` → `exito-na-operacao`, `"Öffnung"` → `offnung`, `ß`→`ss`, `ł`→`l`…). Título ou slug sem nenhuma letra latina (só símbolos, emoji, outro alfabeto) vira `artigo-<8 hex de sha256>`, determinístico e nunca vazio. `POST` e `PUT` sem slug geram do título (no `PUT` sem título, mantém o atual). Slug repetido → **409** "Já existe um artigo com este endereço (slug)."; reservado → **409** "Este endereço (slug) é reservado pelo sistema." Reservados: `blog-global`, `novo`, `editar`, `preview`, `settings`, `feed`, `rss`, `categoria`, `tag`, `api` + o que vier em `BLOG_RESERVED_SLUGS` (vírgulas; só acrescenta). A Galeria que já existe com `blog-global` continua salvável; ninguém mais consegue criá-la nem renomear outro artigo para esse slug.

**`GET /api/blog/slug-available?slug=&exceptId=`** (exige `blog:read`, nunca pública): `{"available":bool,"slug":"<normalizado>","reason":"empty|reserved|taken"}` (`reason` só quando indisponível). O admin chama ao digitar (300 ms), mostra o aviso sob a barra e desabilita *Salvar* se indisponível.

**Ordem da galeria (Q14).** `GET /api/blog/articles?published=true` (pública) devolve: 1º os artigos cujos cartões (`articleCard`, `props.articleId`) estão salvos no `bodyJson` do `blog-global`, na ordem dos cartões (repetidos, rascunhos e ids apagados são ignorados); 2º **todo** artigo publicado fora dessa lista, do mais novo para o mais antigo (`publishedAt`, senão `createdAt`); por último o próprio `blog-global`. Se a Galeria nunca teve cartões salvos, vale a ordem de sempre (destaque, depois data). A lista do admin (sem `published=true`) não muda.

**O que o site precisa ler (BC-0b, quem faz o site):** usar a ordem da lista pública como a ordem final da grade, **sem** `flatMap`/filtro por cartões (hoje `blog/page.tsx` descarta o que não está nos cartões); tirar o `blog-global` da grade e dar 404 em `/blog/blog-global`; ler o `blog-global` por slug só para o hero. Capas de template chegam como caminho relativo (`/arquivo.png`): o site resolve na própria origem, o admin resolve contra `VITE_SITE_URL`.
