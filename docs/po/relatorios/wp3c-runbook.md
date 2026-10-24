# WP3c — Runbook de produção

> Runbook: `docs/runbooks/ligar-em-producao.md`. Nada foi executado contra produção; nenhum código tocado.

## (a) Itens
- ✅ §1 Pré-condições e quem faz o quê; bloqueios Docker/WP3a e WP3b registrados. Evidência: `admin-checklist.md` §4/§8.
- ✅ §2 Backup e teste de restauração (comandos prontos, não executados; nome de tabela 🟡).
- ✅ §3 Tabela única de variáveis. Evidência: `grep os.Getenv apps/api` (inclui `RESEND_API_KEY`, ausente do `.env.example`, e `CONNECT_RATE_*`); admin/site com 🟡 na URL da API.
- ✅ §4 `DATA_KEY`/`SESSION_SECRET` (efeito de perder a chave: CPFs ilegíveis, `crm_common.go`).
- ✅ §5 DSN sem `loc=`, troca da senha (sem valores reais; não li `.env` nem `scripts/test.go`).
- ✅ §6 Google Cloud e `AUTH_ROOT_ADMIN` (`auth_store.go`, relatórios WP1).
- ✅ §7 Ordem `AUTH_API` → `WORKFLOW_API` → `CRM_API`, smoke curl/telas, regra do cookie, token `kld_test_` e `connect.js`. Rotas confirmadas em `auth_middleware.go`/`connect_ingest.go`; comandos não executados.
- ⚠️ §8 CORS, Vercel Authentication, `NEXT_PUBLIC_LEAD_ENDPOINT` registrado como bloqueio (WP3b).
- ⚠️ §9 R2 resumido e apontado para `r2-setup.md`; vídeos de depoimento 🟡 sem suporte visto no código.
- ⚠️ §10 Retenção do IP: recomendação de 90 dias; não há job no código e a coluna é 🟡.
- ✅ §11 Rollback por flag e por deploy. ✅ §12 Checklist e monitoramento.

## (b) Arquivos
`docs/runbooks/ligar-em-producao.md`, `docs/po/relatorios/wp3c-runbook.md`, `docs/index.md` (link).

## (c) Commits
`git log --oneline --grep "docs(runbook)"`.

## (d) Fora / limites
Não li `auth-study.md` inteiro, `wp3a-mysql-real.md` e `blog-auditoria.md` (só as seções de riscos/(f) dos outros relatórios). Nada de WP3b descrito além de "a confirmar".

## (e) Riscos
MySQL real nunca exercitado (Docker ausente). Comandos do runbook não foram rodados. Sem job de retenção do IP.

## (f) Pontos a decidir
Domínio do admin no mesmo site da API; `AUTH_ROOT_ADMIN`; prazo do IP (90 dias sugeridos); Vercel Authentication depois do login; destino dos leads INBOUND; vídeos de depoimento no R2; acrescentar `RESEND_API_KEY` ao `.env.example` (código, fora do meu escopo).
