# Home

**Objetivo:** apresentar a Kalidash como aceleradora de eficiência operacional e converter visitantes em pedidos de diagnóstico.

**Status (09/10/2026):** nova copy implementada no site Next.js, com layout responsivo revisto e build de produção validado. A página preserva a identidade visual existente e usa apenas imagens, logos, resultados e depoimento já disponíveis no projeto.

## Onde está

| Responsabilidade | Arquivo (`apps/site/src/app/home/`) |
|---|---|
| Estrutura da página | `HomePage.tsx` |
| Cabeçalho e menu mobile | `HomeHeader.tsx` |
| Formulário | `DiagnosticoForm.tsx` |
| Copy, links e imagens | `content.ts` |
| Estilos responsivos | `home.module.css` |

As imagens permanecem em `apps/site/public/home/`. O título e a descrição para busca e compartilhamento ficam em `apps/site/src/app/page.tsx`.

## Seções publicadas

1. **Cabeçalho:** O desafio, O que fazemos, Experiência, Cases, Blog e Contato, com CTA para o diagnóstico.
2. **Hero:** “Prepare sua operação para a era dos agentes”, dois CTAs, resultados e faixa de logos.
3. **O desafio:** três sintomas operacionais e a proposta de preparar dados, processos e pessoas para IA.
4. **O que fazemos:** AI Culture, Advisory e Execução, em blocos editoriais alternados.
5. **Experiência:** histórico em grandes operações e atuação em educação e formação de profissionais.
6. **Depoimento:** relato aprovado de André, CMO da Tô Garantido.
7. **Cases e encontros:** mosaico com imagens reais já presentes no projeto.
8. **Diagnóstico:** chamada, formulário e microcopy de retorno em até 24 horas.
9. **Rodapé** (copy da Carol, 20/10/2026; igual nas 7 páginas internas): assinatura, Para empresas (Cultura de IA, Governança, Execução, Diagnóstico), Produtos (Kognis, Spectra AI), Contato (`mailto:comercial@kalidash.com`, Belo Horizonte, MG em texto), Termos de uso (Privacidade, Divulgação responsável) e redes configuradas. Os rótulos de "Para empresas" aguardam confirmação da Carol.

O botão flutuante de WhatsApp só aparece quando `NEXT_PUBLIC_WHATSAPP_URL` estiver configurada. Isso evita exibir um contato que não leva a um canal real.

## Formulário do diagnóstico

Campos obrigatórios:

- nome e sobrenome;
- empresa;
- cargo;
- e-mail corporativo;
- WhatsApp com DDD;
- número de colaboradores na operação;
- pelo menos um objetivo.

O campo aberto sobre o principal desafio é opcional. Enquanto a API aceitar apenas o contrato atual, empresa, cargo, tamanho da operação, objetivos e desafio são consolidados no campo `challenge`. O envio continua sendo um `POST` JSON para `NEXT_PUBLIC_LEAD_ENDPOINT`, com `source: "site-home-diagnostico"` e o campo-isca `website`.

A API em `apps/api/public_leads.go` valida origem e limite por IP, descarta robôs e cria Contato, Oportunidade INBOUND e Nota em uma transação. Para ativar o formulário, é necessário configurar `NEXT_PUBLIC_LEAD_ENDPOINT` no site e `ALLOWED_ORIGINS`/`SITE_URL` na API.

## Conteúdo ainda necessário

- [ ] URL pública do WhatsApp (`NEXT_PUBLIC_WHATSAPP_URL`).
- [ ] URLs confirmadas de Facebook e YouTube, se esses canais devem aparecer.
- [ ] Vídeo principal aprovado para a dobra de prova social.
- [ ] Dois depoimentos adicionais aprovados, caso a composição final de três relatos seja mantida. O site não inventa depoimentos ausentes na copy recebida.
- [ ] Confirmação de autorização para uso público dos logos, fotos e depoimento existentes.

## Validação de 09/10/2026

- lint do site concluído sem erros;
- build de produção do Next.js concluído sem erros;
- revisão em 1440×900 e 390×844, sem overflow horizontal;
- nenhum erro de console ou exceção de página durante a navegação automatizada;
- menu mobile abriu e o CTA navegou para `#diagnostico`;
- formulário vazio exibiu as sete validações obrigatórias;
- CLS sintético local `0`; LCP local abaixo de 200 ms nos dois tamanhos testados.

Essas métricas servem apenas como regressão local. A aprovação de Web Vitals depende do ambiente publicado e de dados reais de rede e dispositivo.

## Como conferir

Execute `pnpm --filter @kalidash/site dev` e abra a rota `/`. Revise a versão desktop e uma viewport móvel de 390 px. Para validar a integração, configure as variáveis de ambiente e faça um envio de teste identificável, confirmando o registro no Core.

## AI Culture V2 (`/treinamento-corporativo-ia`, 20/10/2026)

Blocos novos em `institucional/pages.ts` + `SitePage.tsx` + `Motion.tsx`: `heroMedia`, `proofBar`, `formats`, `testimonials` (a seção "O que muda" foi removida; metodologia ganhou animação de entrada).

- **Barra de prova:** `+10 mil` e `170` no ar. NPS 97 e logos têm `confirmed: false` e **não são renderizados** até a Carol responder as perguntas 1 e 5 do brief (`docs/po/briefs/ai-culture-v2-carol.md`).
- **Depoimentos:** lista `{nome, cargo, empresa, embedUrl, posterUrl, status}`. Só `status: "approved"` com embed `youtube-nocookie.com/embed/` ou `player.vimeo.com/video/` aparece em produção; itens `pending` só aparecem em `next dev`. Player carrega no clique. Nenhum vídeo no repositório.
- **Animação:** `Reveal` (IntersectionObserver, só opacity/transform, respeita `prefers-reduced-motion`).

## Home V2 (feedback da Carol, 20/10/2026, parcial)

Aplicado: hero (título, texto, números 10 mil / 170 / 64), bloco "O problema", três frentes (título, subheadlines, "Para quem é", links para `/treinamento-corporativo-ia`, `/advisory`, `/execucao`) e WhatsApp `wa.link/v9grih`.

Pendente (decisão ou material da Carol): selos Parceira Anthropic e Finalista Inovativos (alt. 1), seção "Case em destaque" CBA com rota `/cases/cba` inexistente (alt. 6), troca do CTA "Fale com a Kalidash" (alt. 7, sem indicar qual), alt. 8 e 9 (dependem de prints), logos (ok de uso) e as trocas de imagem do doc "V3 - Imagens" (sem mapa de slots).
