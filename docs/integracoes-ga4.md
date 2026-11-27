# Conectar o Google Analytics 4 à Dashboard do Kalidash

A Dashboard lê as métricas do site (visitantes, sessões, páginas, canais) pela API do Kalidash. A API usa uma **conta de serviço** do Google. Ela é um "robô" com um e-mail próprio que só tem permissão de leitura no GA4. Não precisa de secret, client ID nem login de pessoa: a credencial é o arquivo JSON da conta de serviço.

São duas variáveis no `.env` da API (`apps/api/.env`):

| Variável | O que é |
|---|---|
| `GA4_PROPERTY_ID` | Número da propriedade do GA4 (ex.: `563815358`). **Não** é o código `G-XXXX`. |
| `GA4_SERVICE_ACCOUNT` | Conteúdo inteiro do JSON da chave da conta de serviço (pode ser em base64). |

---

## 1. Pegar o ID da propriedade (GA4)

1. Abra o [analytics.google.com](https://analytics.google.com) e escolha a propriedade do site no seletor do topo.
2. Clique em **Admin** (engrenagem, canto inferior esquerdo).
3. Na coluna **Propriedade**, abra **Detalhes da propriedade**.
4. Copie o **ID da propriedade**, que é só números, no canto superior direito.

> O `G-XXXXXXX` que aparece em *Fluxos de dados* é o ID de medição. Ele serve para o site **enviar** dados e não funciona aqui.

## 2. Criar a conta de serviço (Google Cloud)

1. Abra o [console.cloud.google.com](https://console.cloud.google.com) e crie ou escolha um projeto.
2. Vá em **APIs e serviços → Biblioteca**, procure **Google Analytics Data API** e clique em **Ativar**.
3. Vá em **IAM e administrador → Contas de serviço → Criar conta de serviço**.
   - Nome: por exemplo `kalidash-analytics`.
   - Pule as etapas de papel e de acesso. Ela não precisa de papel no Cloud, só no GA4.
4. Abra a conta criada, vá na aba **Chaves → Adicionar chave → Criar nova chave → JSON**. Um arquivo `.json` é baixado.
5. Anote o e-mail da conta, que é o campo `client_email` do JSON e termina em `@<projeto>.iam.gserviceaccount.com`.

> Guarde o JSON como uma senha: não mande por chat ou e-mail e não suba para o git.

## 3. Dar acesso de Leitor no GA4 (passo que mais costuma falhar)

1. No GA4, confira no seletor do topo se está **na mesma propriedade** do ID do passo 1.
2. **Admin → Gerenciamento de acesso à propriedade**. Na coluna *Propriedade*, não na *Conta*.
3. Clique em **+ → Adicionar usuários**.
4. Cole o `client_email` da conta de serviço, escrito exatamente igual.
5. Desmarque **Notificar novos usuários por e-mail**, porque o robô não tem caixa de entrada.
6. Papel: **Leitor**. Clique em **Adicionar**.
7. Confirme que o e-mail aparece na lista de usuários da propriedade.

Também vale dar o acesso no nível da **Conta**: ele é herdado por todas as propriedades dela.

## 4. Colocar as variáveis na API

- **Local:** peça ao Claude para abrir o cofre de envs. Ele grava `GA4_PROPERTY_ID` e `GA4_SERVICE_ACCOUNT` no `apps/api/.env` sem exibir os valores.
- **Produção:** cadastre as mesmas duas variáveis no painel do servidor onde a API roda e reinicie a API.

## 5. Conferir

Na Dashboard, os blocos do grupo **Site** (Site · resumo, Visitantes por dia, Origem do tráfego) mostram os números. Se der erro, o bloco mostra a mensagem do Google, com o ID da propriedade e o e-mail da conta que a API está usando.

| Mensagem | Causa | Correção |
|---|---|---|
| "Google Analytics não conectado" | Falta uma das variáveis | Passo 4 |
| "…parece um ID de medição (G-…)" | Colou o `G-XXXX` | Passo 1 |
| "A Google Analytics Data API está desativada…" | API não ativada no projeto do Cloud | Passo 2.2 e espere uns minutos |
| "…não tem acesso a esta propriedade…" | E-mail não adicionado, adicionado em **outra** propriedade, ou ID errado | Passo 3. Compare o ID e o e-mail mostrados no erro |
| Erro ao pegar o token (`invalid_grant`) | JSON incompleto, chave apagada ou relógio do servidor errado | Gere uma chave nova (passo 2.4) |

Os números ficam em cache por 10 minutos, então uma mudança no GA4 pode levar esse tempo para aparecer.
