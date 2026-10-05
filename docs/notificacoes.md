# 🔔 Notificações: erros, avisos e notificações personalizáveis

> Decisões de 27/09/2026. **Implementado em 05/10 (só no front):** o sino na barra lateral com a caixa das três categorias (cor por categoria, contador de não lidas, marcar como lida, limpar, clique leva ao registro), o toast de aviso/erro e a aba **Configurações → Notificações** (aviso do navegador, que pede a permissão e só dispara com o painel em segundo plano). O histórico fica no navegador (últimas 100, `localStorage`). **Ainda não existe:** servidor de notificações (WebSocket, Web Push com o painel fechado, e-mail), erros gerados pelo backend, notificações geradas por tarefa/automação (`pushNotificacao` já existe para quando houver) e retenção definida (ver [edicao-e-cadastro.md](./edicao-e-cadastro.md)). Este documento organiza **o que aparece para a pessoa e como ela configura**; as camadas de transporte (WebSocket, Web Push, e-mail, webhook de saída) já estavam descritas em [system-core.md](./system-core.md#3-sistema-de-notificações-motor-de-engajamento) e [crm-integrations.md](./crm-integrations.md#3-notificações-o-motor-de-engajamento) e continuam valendo — este doc não as repete, só diz quando cada uma é usada.

## 1. Três categorias, um sino

Toda mensagem que chega para quem usa o Kalidash cai em uma de três categorias. Um **sino na barra lateral** abre a caixa de notificações internas com as três juntas na mesma linha do tempo, cada uma com sua cor.

| Categoria | O que é | Quem gera | Exemplo |
|---|---|---|---|
| **Erros** | Falha de infraestrutura ou de acesso. Sempre urgente, nunca silenciável. | O backend, sozinho | Chave de API expirou, perdeu a conexão com o Google, falha de login |
| **Avisos** | A pessoa tentou fazer algo que uma regra do sistema não deixa. Nasce na hora da ação, dentro do próprio painel. | A interface, no momento da ação | Tentou mover uma oportunidade para uma etapa com tarefa pendente e gate ligado (seção 4) |
| **Notificações** | Acompanhamento de negócio, configurável por quem usa. | Pipelines (tarefas) e automações, cada uma com seu método | "A oportunidade X avançou para Negociação", "A tarefa Y está atrasada" |

**Erros** e **avisos** não se desligam — são a rede de segurança do sistema. **Notificações** são as únicas que a pessoa liga ou desliga, por canal, em Configurações.

## 2. Onde configura

- **Sino na barra lateral:** abre a caixa. As três categorias juntas, mais recente primeiro, com contador do que não foi lido.
- **Configurações → Notificações** (aba nova, ao lado de Equipe e acessos e Webhooks): liga ou desliga o **push** do navegador. A caixa interna (o sino) nunca desliga — só o push sai do painel.
- **Por tarefa** (dentro de uma pipeline): ver seção 3.
- **Por automação:** a ação "Notificar alguém da equipe" escolhe o canal (in-app, push, e-mail) automação por automação — automações diferentes servem públicos diferentes (um gerente pode preferir e-mail; um vendedor, push).

## 3. Tarefa: caminho simples e caminho avançado (continuação do D9)

Ao criar ou editar uma tarefa (requisito de etapa), a pessoa é avisada de duas formas, sem precisar entender automação:

1. **Caminho simples, embutido na própria tarefa.** Escolhe um **responsável** e liga o interruptor **"Notificar por push quando esta tarefa for criada"**. Dispara para essa pessoa no momento em que a tarefa nasce. Não aparece em Automações — é comportamento do requisito, não uma regra separada.
2. **Caminho avançado, opcional.** O botão **"Criar automação a partir desta tarefa"** abre o formulário de automação **já pronto** (ação de notificar, pré-preenchida); a pessoa só escolhe o **evento**, entre os que fazem sentido para esta tarefa: criada, atrasada (só aparece se a tarefa tiver prazo) ou concluída. Vira uma automação normal, visível e editável em Automações — nunca uma regra escondida.

O caminho simples cobre o caso comum (avisar quem tem que fazer). O avançado cobre o resto: avisar outra pessoa, mandar por e-mail em vez de push, reagir só ao atraso.

## 4. O primeiro aviso: recusa de mover etapa

É a implementação de referência da categoria **Aviso**, e o primeiro **gate** de verdade do sistema — hoje o gate (`ENTER`/`EXIT` num requisito) é só um cadeado desenhado no workflow; nada barra o movimento de fato (ponto em aberto, ver *edicao-e-cadastro.md*).

No Kanban, ao soltar um card numa etapa bloqueada por um requisito com gate `ENTER` aberto (ou tentar tirá-lo de uma com gate `EXIT` aberto):

1. O card **não entra** na coluna de destino.
2. Ele treme (shake), a borda pisca em vermelho, e volta animado para a posição de origem.
3. No mesmo instante, um aviso aparece no **canto inferior esquerdo** da tela: nome do registro, qual tarefa está travando, e um atalho para abrir a ficha.
4. O mesmo aviso fica na caixa de notificações (categoria Avisos), para quem não viu o toast na hora.

Regra geral para qualquer aviso futuro: sempre um toast temporário no canto inferior esquerdo **e** uma cópia na caixa. Nunca só um dos dois.

**Duas ou mais tarefas podem travar a mesma fronteira de etapa ao mesmo tempo** (confirmado em 27/09/2026) — a etapa só libera quando **todas** as tarefas com gate aberto naquela borda estiverem concluídas, não a primeira.

O gatilho por webhook desativado sozinho por excesso de ritmo (ver [gatilhos-personalizados.md](./gatilhos-personalizados.md) §3.2) também é um Aviso, com a mesma régua desta seção.

## 5. Em aberto

- Onde o gate é checado de fato no código: o lead já é meu (posso barrar em `moveLeadStage`); a oportunidade ainda depende da rota antiga da API Go (`/api/leads/move`) — falta decidir se a trava roda no front antes de chamar a API, na própria API, ou nas duas pontas.
- Retenção da caixa de notificações (quanto tempo fica, se marca como lida sozinha).
- Se "Erros" tem algum nível de configuração (ex.: silenciar um tipo específico) ou é sempre fixo.
- O resto da personalização fina (eventos e etapas personalizadas) fica para a próxima conversa, ainda em aberto.
