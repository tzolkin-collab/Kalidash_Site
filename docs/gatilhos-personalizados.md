# 🔌 Gatilhos personalizados: webhooks de entrada e eventos por pipeline

> Decisões de 27/09/2026, ainda em construção. Nada disto está implementado. Pesquisa de apoio: Zapier, Make e HubSpot (webhooks de entrada), Stripe e o padrão de mercado de mover negociação por webhook de pagamento — fontes na seção 6. Complementa [dominio.md](./dominio.md) §9, [benchmark-ciclo-de-vida.md](./benchmark-ciclo-de-vida.md) e [notificacoes.md](./notificacoes.md).

## 1. O que muda

Hoje uma pipeline só reage a eventos que o próprio Kalidash gera (`lead.criado`, `oportunidade.mudou_de_etapa`...). A liberdade que falta: **cada pipeline poder reagir a um evento de fora** — o exemplo concreto é um pagamento confirmado num gateway (Asaas, Stripe) movendo a oportunidade sozinha para "Ganho" — e poder **automatizar qualquer avanço de etapa**, não só o pagamento: mandar e-mail, notificar, criar tarefa, mudar responsável.

## 2. Princípio: automação nunca substitui o manual

Uma etapa nunca fica "só automática". O webhook de pagamento é **uma porta a mais** para chegar em "Ganho" — a pessoa continua podendo arrastar o card ou clicar em "Marcar como ganho" a qualquer momento, webhook nenhum configurado. A diferença é que **o caminho automático exige configuração que o manual não exige** (URL do webhook, mapear os campos, dizer qual oportunidade é aquela) — a pessoa monta isso uma vez, com calma; o vendedor no dia a dia nunca precisa saber que existe.

Vale para toda automação que move etapa: ela chama a **mesma ação** que o botão manual chamaria (`oportunidade.mover`, que já respeita os requisitos que impedem entrar ou sair). Nunca existe um caminho automático que ignore a regra que o manual obedece.

## 3. Webhook de entrada, passo a passo

Dentro de **Configurações da pipeline**, ao lado de "Conectar fonte" (que traz leads pra dentro), uma opção nova: **"Criar gatilho por webhook"**.

1. **Kalidash gera uma URL única** para aquela pipeline (ex.: `https://api.kalidash.com.br/gatilhos/9f2a1c...`).
2. A pessoa manda um **envio de teste** (o próprio Asaas/Stripe tem essa opção, ou cola um exemplo). O Kalidash lê o payload e mostra os campos que vieram — igual o "detectar estrutura" do Zapier e do Make.
3. A pessoa dá um **nome ao evento** (ex.: `pagamento.confirmado`). É esse nome que aparece no catálogo, na hora de montar um passo ou automação.
4. Escolhe **qual campo do payload identifica o registro** (o "de quem é isso?") — email, CPF/CNPJ, ou um campo personalizado tipo "ID no Asaas" guardado em `customData`. Sem casar com um registro existente, o evento **não dispara em nada** (mesma regra do HubSpot: webhook de entrada atualiza quem já existe, não inventa registro sozinho).
5. Opcionalmente, mapeia outros campos do payload para campos personalizados do registro (ex.: `valor_pago`, `metodo`).
6. Define o **responsável** por aquele gatilho — quem é avisado (categoria **Erros**, ver [notificacoes.md](./notificacoes.md)) se o webhook parar de chegar ou o payload mudar de formato.

**Sem registro correspondente, o gatilho não dispara nada** (decidido em 27/09/2026) — nunca cria um registro novo sozinho. É a mesma regra do HubSpot: webhook de entrada atualiza quem já existe.

### 3.1 Nome do evento: lista sugerida

O nome não é livre. Ao criar o gatilho, a pessoa escolhe de uma lista organizada por assunto (Pagamentos: `pagamento.confirmado`, `pagamento.falhou`, `pagamento.estornado`; Assinaturas: `assinatura.criada`, `assinatura.cancelada`; Documentos: `contrato.assinado`...), com uma opção **"outro"** para o que não está listado. Isso evita que uma pipeline tenha `pagamento_ok` e outra `PagamentoConfirmado` significando a mesma coisa.

### 3.2 Ritmo (sem limite de quantidade, mas com freio automático)

Não há limite de quantos gatilhos uma pipeline pode ter. O que existe é um **freio por ritmo**: se um gatilho disparar num volume muito acima do normal (looping, fonte mal configurada, abuso), o Kalidash **desativa ele sozinho** e gera um **Aviso** (ver [notificacoes.md](./notificacoes.md)) com uma recomendação do que checar. A pessoa reativa depois de resolver.

### 3.3 Reaproveitar um gatilho

Gatilho é por pipeline, sem opção "vale para todas" — para usar o mesmo webhook em outra pipeline, **duplica e renomeia**, o mesmo princípio dos templates de ciclo de vida (cópia, não vínculo). O Kalidash já nasce com **gatilhos padrão prontos** (ex.: "Pagamento confirmado (Asaas)") que servem de ponto de partida para duplicar; esses padrões podem ser **desativados, nunca apagados**, para continuarem servindo de espelho.

## 4. Onde o evento aparece

O catálogo de eventos (hoje fixo, ~19 entradas) ganha um grupo **Personalizados**, por pipeline: os gatilhos por webhook daquela pipeline aparecem ali, junto dos eventos do sistema, no mesmo seletor que já existe para passos e automações. Um evento personalizado só aparece nas automações **daquela pipeline** — não é global.

## 5. Avanço de etapa como gatilho (já existe, só confirmando)

Isso já está coberto pelo motor de eventos de hoje e continua valendo: `oportunidade.mudou_de_etapa` já pode disparar `email.enviar` (mandar um e-mail) e `notificar.equipe` (avisar alguém). O gatilho por webhook só acrescenta **de onde** um avanço pode vir — não muda o que um avanço pode disparar.

## 6. Segurança (fica para a fase de segurança, combinada por último)

Webhook de entrada é uma porta aberta para fora — precisa de assinatura (verificar que quem mandou é mesmo o Asaas/Stripe, não qualquer um que descobriu a URL), limite de tamanho e de frequência, e um jeito de trocar a URL se vazar. Nada disso é resolvido aqui, só fica marcado para não esquecer.

## 7. Decidido em 27/09/2026 (resumo)

| Pergunta | Decisão |
|---|---|
| Sem achar o registro? | Não dispara nada. Nunca cria sozinho (§3). |
| Limite de gatilhos por pipeline? | Nenhum; freio automático por ritmo em vez de teto (§3.2). |
| Nome do evento livre? | Lista sugerida por assunto, com "outro" como escape (§3.1). |
| Vale para "Todas" as pipelines? | Não; duplica e renomeia para reaproveitar (§3.3). |

## 8. Fontes

Zapier — [Trigger Zaps from webhooks](https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zaps-from-webhooks), [comunidade sobre o Catch Hook](https://community.zapier.com/code-webhooks-52/setting-up-webhooks-by-zapier-trigger-catch-hook-48913). Make — [guia de webhooks](https://help.make.com/webhooks). HubSpot — [gatilhos de webhook em workflows](https://knowledge.hubspot.com/workflows/set-when-a-webhook-is-received-workflow-triggers) (é a fonte do padrão "campo identificador único" usado na seção 3). Stripe — [lidando com eventos de pagamento](https://docs.stripe.com/webhooks/handling-payment-events). Padrão de mover negociação por webhook de pagamento, via automações prontas do Zapier para Pipedrive: [exemplo 1](https://zapier.com/automations/sales/pipeline-management/deal-tracking/set-deal-stage-to-delivered-when-purchase-completes), [exemplo 2](https://zapier.com/automations/sales/pipeline-management/deal-tracking/update-deal-status-and-add-payment-notes-from-webhook).

*Pesquisa feita em páginas de ajuda e exemplos de terceiros, sem testar nenhuma ferramenta.*
