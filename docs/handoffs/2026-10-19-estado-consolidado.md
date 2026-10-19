# Handoff consolidado — 19/10/2026

> Junta três fontes: o handoff do Antigravity (site, Home, editor do blog), a trilha do PO do /admin (`docs/po/`) e o estado real do git. Onde há conflito, vale o que está no código (conferido em 19/10). Substitui `2026-10-14-estado-e-proximos-passos.md` nos itens que ele cobria.

## 1. Onde estamos

`main` e `origin/main` em `39679c5` (repositório `tzolkin-collab/Kalidash_Site`). Árvore limpa quanto ao código; `docs/po/` e este arquivo ainda **não commitados**.

| Frente | Quem | Estado |
|---|---|---|
| Home, depoimentos pareados, TestimonialCard, FlickeringGrid, Diagnóstico (contato antes do questionário) | Antigravity | Commitado (`877309b`, `7917422`, `39679c5`) |
| Menu conforme o diagrama de estrutura + 5 páginas internas (`/sobre-nos`, `/treinamento-corporativo-ia`, `/advisory`, `/execucao`, `/solucoes`) com a copy do Google Doc | Claude (sessão principal) | Commitado (`73e122a`). As páginas ainda sem revisão visual mobile |
| Admin do blog: estúdio de corte de foto, blocos `splitMedia` e `twoColumns`, canvas fiel ao site, correção de z-index | Antigravity | Commitado (`877309b`). **Nota 9,2–9,8 é autoavaliação**, ver §4 |
| Auditoria do admin (WP0) | worker | **8,8** |
| Login Google e perfis no servidor (WP1) | worker | **8,6** |
| Escopos por pessoa e tokens de API (WP1.1) | worker | **9,0** |
| Estabilização do núcleo (WP-B) | worker | **9,0** |
| Projetos conectados, `connect.js` e Lead v2 (WP2) | worker | **9,0** |
| Auditoria do blog | worker | **9,2** |
| WP3a (suíte em MySQL real) | worker | **Bloqueado**: Docker não instalado |
| WP3b (núcleo CRM v2), WP3c (runbook), BC-0a (hotfix de slugs) | workers | **Não executados**: bateu o limite de uso da conta antes de qualquer arquivo; limite renova às 23h |

Tudo do admin novo (`AUTH_API`, `WORKFLOW_API`, `CRM_API`) continua **desligado em produção**. A API de produção segue aberta (CORS `*`, sem login) até as flags serem ligadas.

## 2. Decisões do PO (resumo; detalhe em `docs/po/admin-checklist.md` §8 e `docs/po/blog-cms.md` §2)

- Primeiro Admin: o Gustavo (`AUTH_ROOT_ADMIN`). Token de API é da organização e sobrevive à desativação de quem criou, com aviso na tela.
- O formulário do site deve criar **Lead v2**. Até o WP3b migrar `POST /api/public/leads`, **não ligar `NEXT_PUBLIC_LEAD_ENDPOINT` com tráfego real** (a captura hoje cria Oportunidade INBOUND, tabela antiga).
- Ficha da oportunidade edita prioridade e tags; contato, empresa e responsável ligam ao CRM v2 e à equipe; Vendedor passa a ver só o que é dele (escopo próprio).
- Teste de e-mail só para o e-mail de quem está logado. `/api/emails/send` limitado a Admin/Gerente no WP4.
- Blog: abordagem híbrida (`bodyJson` com blocos e props enumeradas + renderizador no site pelo JSON + `layout` por artigo). Cor livre de texto sai do editor. Slug trocado sempre com 301. Galeria híbrida (curada primeiro, o resto por data).
- **A frente do site e do CSS do blog é do Antigravity**; os workers só mexem em API e admin.

## 3. Pendências por dono

**Gustavo**
1. Instalar Docker (destrava o WP3a e a validação em MySQL real).
2. Criar o OAuth Client ID no Google Cloud e definir `AUTH_ROOT_ADMIN`, `SESSION_SECRET`, `ALLOWED_ORIGINS` (passos em `docs/po/relatorios/wp1-auth.md` §f).
3. **Segurança de produção**: ligar a Vercel Authentication no admin enquanto o login não está ligado; trocar a senha do banco (a credencial está em `apps/api/scripts/test.go` e `scratch/*`, locais, e a API na porta 8080 desta máquina aponta para produção).
4. Despublicar o artigo `artigo-teste-template` em produção (está público, na galeria e no sitemap); tirar `CNH-e.pdf.pdf` e o contrato `.docx` de `apps/site/public/` (ignorados pelo git, mas presentes no disco).
5. Decidir com a Carol: tema Galeria escura × Artigo claro; templates de layout do blog; domínio final; quando ligar o R2 real.

**Antigravity (site e CSS)**
- Itens de site do hotfix do blog: `blog/page.tsx` (`flatMap` descarta artigo novo depois de salvar a galeria), `/blog/blog-global` público, `ShareButtons` (hidratação), título duplicado, `og:image`, canonical, JSON-LD, tabela cortada no celular, lista de verificação (ver `docs/po/relatorios/blog-auditoria.md` §3 e §5).
- Revisão visual mobile das 5 páginas internas novas e do menu lateral.
- Esclarecer o handoff: ele cita um menu "Soluções, Diagnóstico, Blog, Equipe", mas o código atual (`content.ts`) tem **Para empresas, Sobre nós, Cases, Blog, Produtos + Diagnóstico**, como no diagrama aprovado.

**PO / workers (quando o limite renovar)**
1. WP3b (D6, D9, D10, D4, Dashboard) e WP3c (runbook) — os cards seguem prontos.
2. BC-0a (slug e galeria na API e no admin). Rebasear o BC-2 nos blocos que o Antigravity já criou (`splitMedia`, `twoColumns`, `PhotoCropModal`): reaproveitar, não refazer.
3. WP3a assim que houver Docker.

## 4. Conflitos e ressalvas

- `docs/po/relatorios/blog-admin-controles-*.md` e `handoff-avancos-blog-editor.md` vieram do Antigravity. As notas deles (9,2 a 9,8) são autoavaliação e **não passaram pela régua do PO**; os testes que citam (57 do admin, build, `go test`) conferem com o que rodei em 18/10 (54 a 57).
- O editor do blog ganhou blocos novos **depois** da auditoria do blog. A matriz de paridade (§2.3 da auditoria) precisa ser refeita para `splitMedia` e `twoColumns` antes do BC-2.
- `docs/po/` ainda não foi commitado. Commitar só `docs/po/` e `docs/handoffs/2026-10-19-estado-consolidado.md`.
