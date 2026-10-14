# Handoff — estado do projeto e próximos passos (14/10/2026)

> Pauta de **amanhã (15/10), no core**: os itens 1 a 3 abaixo. Eles vêm antes de qualquer funcionalidade nova.

## Onde estamos

- **Entrega 1 (site + blog):** Home refeita e publicada para aprovação (`kalidash-site-one.vercel.app`), blog com editor e pré-visualização funcionando **em produção** (ver [blog-design-contrato.md](../blog-design-contrato.md), seção "Pré-visualização em produção").
- **Home em reescrita por outra sessão** (não commitada): a copy nova de 09/10 (`content.ts`, `HomePage.tsx`, `DiagnosticoForm.tsx`, `home.module.css`, `page.tsx`, `docs/pagesClient/home.md`). Não mexer nesses arquivos daqui sem combinar.
- **Admin/CRM com API pronta e desligada por padrão**, tudo na `main`: funis e tarefas (`WORKFLOW_API=1`), pessoas, empresas, leads e histórico (`CRM_API=1`), captura pública de lead, valor das oportunidades, upload de imagem (R2). O admin sincroniza com a API quando ligada e segue com dados de exemplo quando não.
- **Notificações e tarefas:** sino com a caixa, notificações de tarefa (criada com "notificar", atrasada), eventos `tarefa.criada`/`tarefa.atrasada` para as automações, editar e excluir tarefa na ficha, aba Tarefas na oportunidade, galeria de funis responsiva (sem o fluxo dentro do card) e correções de sincronização (reload na fila de gravações, recarga em HMR, trava de notificação repetida) estão commitados em 14/10.
- **Em produção hoje:** a API responde (artigos e oportunidades), mas com funis e CRM **desligados** (404 em `/api/pipelines` e `/api/crm/*`). Variáveis na Vercel já criadas: `VITE_SITE_URL` (admin) e `NEXT_PUBLIC_ADMIN_ORIGINS` (site).

## Pauta de amanhã, em ordem

1. **Segurança mínima antes de entrar dado real.** Verificado em 12/10: o admin publicado abre **sem login** e a API devolve oportunidades e artigos a qualquer um (CORS `*`, sem autenticação). Decidir: (a) ligar a *Vercel Authentication* no projeto do admin agora (protege a tela, não a API) e (b) quando entra o login com Google (Entrega 4). **Trocar a senha do banco:** a credencial de produção está em arquivos locais (`apps/api/.env`, `scratch/reseed_blog.js`, `apps/api/scripts/test.go`) e o banco é acessível de fora.
2. **Ligar o formulário do diagnóstico:**
   - Corrigir o `ALLOWED_ORIGINS` na API (EasyPanel). Estava com a origem do **admin**; precisa ser a do **site** (`https://kalidash-site-one.vercel.app`, mais o domínio final). Com o valor errado a API devolve 403 ao formulário.
   - Definir `NEXT_PUBLIC_LEAD_ENDPOINT` no projeto do site na Vercel (`https://systembots-apika.rzkso2.easypanel.host/api/public/leads`) e redeployar. Cada envio cria contato + oportunidade reais no banco.
3. **Fechar a Home com o que a Carol mandou em 02/10** (a outra sessão já cuida da copy): WhatsApp `wa.link/9b5sl1`, Instagram `kalidash.ai` (o site publicado ainda tem `kalidash.metrics`), LinkedIn, YouTube, vídeos do Daniel e da Larissa, brand guide novo. Faltam dela: textos das 5 fotos, as outras 2 frentes de "Do desafio à solução", ok de uso dos logos de clientes e dos depoimentos (André e Aline Motta). A mensagem para ela está pronta (ver a conversa de 05/10); revisar a data antes de enviar. A próxima entrega cai por volta de 16/10 se o cronograma quinzenal desde 02/10 se mantiver.
4. **R2 (upload de imagem do blog):** criar o bucket e o token, definir as 5 variáveis `R2_*` na API. Passo a passo em [r2-setup.md](../r2-setup.md) (~10 min).
5. **Antes de ligar `WORKFLOW_API` / `CRM_API` em produção:** backup do banco; gerar e guardar a `DATA_KEY` (sem ela os CPFs gravados ficam ilegíveis); rodar os testes de integração (`workflow_integration_test.go`, `crm_integration_test.go`, `crm_history_integration_test.go`) num MySQL ou MariaDB **de verdade** (até agora só passaram num MySQL em memória); confirmar que o DSN de produção não tem `loc=` (a API lê datas em UTC); definir a retenção do IP guardado no histórico (LGPD). Não ligue antes do item 1.
6. **Organização:** commitar as notificações de tarefa (lista acima) e decidir o destino do trabalho solto de outras sessões: `TaskWorkflow.tsx` (~1000 linhas), botões "Novo funil" em `Tasks.tsx`, `index.css`, `drawer.css`, landing Motion, `30-09/`.

## O que deixar para depois dos itens acima

Kanban com vários funis ao mesmo tempo; tags de contato e contatos por oportunidade na API; evento "tarefa concluída" e "criar automação a partir da tarefa"; Web Push com o painel fechado (precisa de servidor e login); limpeza de imagens órfãs no bucket.

## Como subir o projeto para ver tudo junto

Site e admin: `preview_start` com `kalidash-site` (3000) e `kalidash-admin` (5173). Para ver o CRM, funis e tarefas funcionando sem tocar no banco real, a API roda sobre um MySQL em memória (`go-mysql-server`, fora do repositório) com `WORKFLOW_API=1 CRM_API=1 DATA_KEY=<chave de teste>`. **Nunca** rodar a API local com o `.env` real e esses flags: ela alteraria o banco de produção.
