# 📰 Blog Institucional & Site Cliente

**Objetivo:** Interface pública gerada pelo Next.js. Consome o próprio Banco do Kalidash.

## ⚠️ Problemas Antecipados & Soluções

1. **Problema: Sincronização de Conteúdo Estático (SSG)**
   - *O risco:* Como removemos o Sanity, o usuário escreve um post novo no Admin (salva no DB). Mas como o Next.js foi buildado de forma estática no deploy, a página do novo blog não existe na web, gerando erro 404 até alguém mandar rodar um novo Build na Vercel.
   - *A Solução:* Usar **ISR (Incremental Static Regeneration)** do Next.js. O Next gera a página na primeira vez que alguém acessa e depois salva no cache. Assim, garantimos SEO máximo sem precisar rodar build manual sempre que publicar um texto.

2. **Problema: Peso de Imagens no Blog**
   - *O risco:* Fazer upload de uma imagem de 5MB no Admin e o Next.js carregar isso no frontend, destruindo o SEO.
   - *A Solução:* O componente `next/image` já faz otimização. Mas na subida do arquivo no Admin, o Go deve cortar e comprimir (WebP) a imagem antes de jogar no S3/Supabase Storage.
