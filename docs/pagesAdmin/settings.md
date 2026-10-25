# ⚙️ Configurações e Integrações

**Objetivo:** Ajustes sensíveis, auditoria e ponte de saída de dados (Webhooks).

## 📌 Idealização e Fluxo
- **Webhooks (Outbound):** O Admin configura regras tipo "Sempre que um lead cair na coluna 'Ganho', envie um POST JSON para o HubSpot do cliente".
- **Logs de Auditoria:** Tabela de segurança rastreando "Quem fez o quê" (Ex: *Usuário X revogou a Chave Y às 14:00*).
- **Gestão de Equipe:** Adicionar vendedores, gerentes, definir os perfis (Admin, Gerente, Vendedor) e o que cada um vê. Ver [system-core.md](../system-core.md).
  - **Com `AUTH_API=1` (WP1, 18/10/2026):** a aba grava na API (`/api/team`). Só o **Admin** convida, troca o perfil e desativa (a lixeira desativa; dá para reativar). Gerente e Vendedor veem a lista sem botões. Ninguém muda ou desativa o próprio acesso, o último Admin não sai e a **conta raiz** (`AUTH_ROOT_ADMIN`, marcada "· raiz") não é rebaixada nem desativada pela tela. Quem entra é quem está na tabela, pelo e-mail exato; o primeiro vínculo com a conta Google acontece no primeiro login (`Convite enviado` vira `Ativo`).
  - **Sem a flag:** tudo em dados de exemplo, como antes (o admin abre sem login e o perfil é o de exemplo).
- **Permissões (WP1.1, 18/10/2026, só com `AUTH_API=1`):** o perfil virou um **preset de escopos** (Admin 24, Gerente 23, Vendedor 11 depois do WP3b: o Vendedor tem `leads:own` e `opportunities:own` no lugar de `leads:read`/`leads:write`, e só vê o que é dele) e cada pessoa pode ter escopos **extras** ou **removidos**. A aba tem a lista da equipe à esquerda (ponto roxo = tem ajustes) e, à direita: **perfil base** em três cartões (um clique troca o preset e descarta os ajustes), o resumo "O que fulano pode fazer" em português por área, e os **escopos agrupados por área** (CRM, Funis e tarefas, Conteúdo, Automação, Administração) com interruptor, descrição, o código da API e a marca *Extra* ou *Removida*. Uma barra fixa mostra "N alterações não salvas" com **Salvar permissões** e **Descartar**. Só quem tem `team:manage` (Admin) edita; ninguém edita o próprio acesso, a conta raiz mostra tudo ligado e travado, e o servidor recusa conceder o que quem edita não tem (a mensagem aparece na barra e como aviso). Detalhes em [auth-study.md](../auth-study.md#escopos-e-tokens-de-api-wp11-18102026).
- **Tokens de API (WP1.1, só com `AUTH_API=1`):** quem tem `keys:manage` (Admin e Gerente por padrão) cria tokens para sistemas e automações. **Criar token** abre um painel com nome, validade (**nunca expira** é o padrão; 30 dias, 90 dias, 1 ano ou uma data), atalhos (*Somente leitura*, *Leitura e escrita do CRM*, *Tudo que posso*) e os escopos por área (os que a pessoa não tem aparecem travados; `team:manage` e `keys:manage` nunca vão num token). O token completo aparece **uma única vez** num diálogo com **Copiar** e um exemplo de `curl`. A lista mostra nome, prefixo mascarado (`kld_live_Ab3x••••••••wXyZ`), escopos, último uso, validade e quem criou; **Revogar** pede confirmação e vale na hora. Revogados e expirados ficam numa seção recolhida. Sem permissão ou sem login ligado a aba explica por quê (estados vazio, carregando e erro com *Tentar de novo*). Sem a flag as duas abas mostram "Disponível com o login ligado".
- **Meu perfil e sessão:** com login ligado mostra a pessoa real e o botão **Sair** (revoga a sessão no servidor). Se um Admin mudar o perfil ou desativar o acesso, vale na próxima requisição; sessão revogada devolve à tela de entrada.
- **Notificações:** liga ou desliga o push do navegador (a caixa interna, aberta pelo sino da barra lateral, nunca desliga). Ver [notificacoes.md](../notificacoes.md).

## ⚠️ Problemas Antecipados & Soluções

1. **Problema: Falhas de Webhook e Bloqueio do Backend**
   - *O risco:* O sistema tenta mandar um webhook para a RD Station, mas a RD está fora do ar. Se o Go tentar enviar e ficar aguardando, pode travar recursos do nosso servidor, além do dado ser perdido.
   - *A Solução:* O envio de webhooks em Go não pode ser síncrono. Eles devem rodar em segundo plano (`Goroutines`) ou serem jogados numa fila. É obrigatório ter um mecanismo de *Retry com Backoff Exponencial* (tenta de novo em 1 min, depois 5 min, etc).

2. **Problema: Autenticação Segura no PWA**
   - *O risco:* Sessões durarem para sempre e alguém acessar o computador do admin.
   - *A Solução (implementada em 18/10/2026, atrás de `AUTH_API=1`):* sessão opaca no servidor em cookie `HttpOnly` (+ `Secure`, `SameSite=Lax`), 7 dias com renovação a cada uso, revogável no logout e na desativação. O JavaScript nunca vê o token (contra XSS) e o perfil é conferido a cada requisição. Ver [auth-study.md](../auth-study.md#implementação-wp1-18102026).

## 🔑 Entrar (login)

- Com `AUTH_API=1` o admin mostra a **tela de entrada** quando não há sessão: botão **Entrar com Google** (só e-mails convidados; outra conta recebe `403`) e, só em desenvolvimento, **Entrar (desenvolvimento)** sem Google.
- Sem a flag (ou com a API fora do ar) o admin abre direto, como antes: o `GET /auth/me` não existe e o admin segue o modo antigo.
- O **Blog** some do menu para o Vendedor (a API também responde `403`).

### Rodar localmente sem Google

1. Use um banco **descartável** (nunca o `.env` real). Na `.env` da API local: `AUTH_API=1`, `SESSION_SECRET` (32+ caracteres), `ALLOWED_ORIGINS=http://localhost:5173`, `ADMIN_URL=http://localhost:5173`, `AUTH_DEV_LOGIN=1`, `AUTH_COOKIE_INSECURE=1` e `AUTH_ROOT_ADMIN=voce@exemplo.com` (cria o Admin raiz).
2. No admin: `VITE_API_URL=http://localhost:8080` (padrão) no `.env.local`.
3. Abra o admin: a tela de entrada tem um campo de e-mail. Digite o do Admin criado. A entrada de desenvolvimento só aceita conexões do próprio computador e some quando `AUTH_DEV_LOGIN` não está ligada.
4. Convide as outras pessoas em Configurações → Equipe e acessos e entre com cada e-mail para ver os perfis.
