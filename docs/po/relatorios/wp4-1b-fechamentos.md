# WP4-1b — Fechamentos (D40, D41, D42)

> Banco de prova: MySQL em memória (go-mysql-server, `memmysql.exe` no scratchpad, fora do repositório; portas 3371 e 3372). Nada de produção tocado; `apps/api/.env` não foi lido; a API da 8080 não foi chamada. API de prova compilada de um `git archive HEAD` (porque `main.go` do WP4-2 estava em edição e não compilava) e rodada na 8108; admin na 5208.

## D40 — Desconectar fonte — ✅
- API: `ConnectedProject.pipelineId/stageId` viram NULL (`ensureConnectSchema` afrouxa tabelas antigas só se ainda forem NOT NULL; idempotente). `PUT /api/projects/{id}` aceita ambos nulos (200, devolve `null`); só um dos dois = 422. `POST /api/connect/leads` de projeto sem funil = 422 "projeto sem funil: reconecte…" (antes de honeypot/validação, sem gravar nada); `IngestLead` também recusa.
- Admin: botão "Desconectar fonte" (aba Fontes das Configurações e painel da fonte) com `window.confirm` e o aviso; `disconnectBody` em `sourceLink.ts` (puro, testado).
- Provas: `TestIntegrationConnect` (estendido) e `TestIntegrationConnectLegacyNotNull` passam com e sem `parseTime=true`; admin: `tests/sourceLink.test.ts`. Navegador: confirmação com o texto do aviso, `GET /api/projects` devolveu `pipelineId:null, stageId:null`, a aba Fontes mostrou "Este funil está sem fonte".
