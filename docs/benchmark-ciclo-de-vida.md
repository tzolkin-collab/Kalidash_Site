# 🔁 Benchmark: eventos padronizados, templates de ciclo de vida e tarefas por evento

> Pesquisa de 27/09/2026 em documentação oficial e, quando indicado, em fontes de terceiros. **Sem uso real das ferramentas.** Serve para decidir o D4 de [edicao-e-cadastro.md](./edicao-e-cadastro.md) e complementa [benchmark.md](./benchmark.md) e [benchmark-dados.md](./benchmark-dados.md).

## 1. A ideia a validar

1. Um **catálogo padronizado de eventos** do sistema (`lead.criado`, `oportunidade.ganha`, `tarefa.concluida`…).
2. **Templates prontos de ciclo de vida**: uma lista ordenada de **passos**, cada passo ligando um evento a tarefas e automações. O time **edita depois**, adicionando, removendo e reordenando passos.
3. O **ciclo de vida** de pessoa, empresa e oportunidade **resulta dos eventos**, em vez de ser um campo escolhido à mão, e o mesmo mecanismo cria as tarefas comuns.

## 2. O que cada ferramenta faz

| Ferramenta | Vocabulário de eventos | Templates prontos | Edição do template | Ciclo de vida | Tarefa ligada ao evento | Bloqueio de etapa |
|---|---|---|---|---|---|---|
| **HubSpot** | Gatilhos de workflow por evento e por dados; 8 estágios de ciclo de vida padrão | Modelos de sequência prontos | Sequência: mover para cima ou baixo, editar, excluir passo; salvar ou **fazer cópia** | Muda sozinho: formulário, negócio criado (Oportunidade), negócio ganho (Cliente). Só avança; voltar exige limpar o valor. Edição manual permitida | Passo de tarefa na sequência (ligação, e-mail manual ou geral) | Não |
| **Pipedrive** | Eventos *adicionado, atualizado, excluído* em 6 entidades, mais gatilhos por data | Modelos citados por guias de terceiros; a página oficial consultada não os descreve | Condições, "esperar até" e se/senão | Não há ciclo de vida separado | "Mover para Proposta enviada → criar atividade 'follow-up' em 3 dias"; "ganho → onboarding" | Não |
| **Zoho CRM (Blueprint)** | Estados e transições | Não | Editor de processo | O campo do processo fica **travado** para edição manual enquanto o registro está nele | "Depois" da transição: tarefa, reunião, e-mail, atualização de campo | **Sim**: campos, notas, anexos e checklist obrigatórios na transição |
| **Salesforce (Path)** | Estágios do funil | Não | Por tipo de registro | Status do lead | Orientações e campos-chave por estágio (o Kanban mostra os mesmos) | Não (só orienta) |
| **Pipefy** | "Um card entra ou sai de uma fase", campo atualizado, alerta | Galeria com milhares de modelos de processo | Personaliza o modelo ou cria do zero | Não | Ações: criar card, mover, e-mail, atualizar campo | **Sim**: campo obrigatório por fase |
| **Bitrix24** | Regras por etapa, imediatas ou com atraso; *gatilhos* reagem a mudanças e podem mover a etapa | Regras agrupadas pelo problema que resolvem | Por etapa e por funil | Não | Criar tarefa, planejar atividade, notificar o supervisor, **vigiar a tarefa e mover a etapa quando concluir** | Não descrito |
| **Kommo (Digital Pipeline)** | Gatilhos por etapa, com condições | Salesbot com modelo padrão | Por etapa | Não | Gatilho "adicionar tarefa"; opção **aplicar aos leads que já estão na etapa** | Não |
| **RD Station CRM** | Negociação criada ou movida, campo customizado atualizado, **tempo sem contato** | **13 modelos prontos** (Pro, até 50 automações); personalizadas no Advanced (até 100) | Escolhe o modelo e ajusta | Não | Criar tarefa, trocar responsável, e-mail ou WhatsApp, mover etapa | Não |
| **ActiveCampaign** | Gatilhos múltiplos, se/então, caminhos divididos | **Receitas**: de 750 a mais de 900, filtradas por setor, caso de uso e nível | A receita importada chega com todos os passos e **qualquer elemento pode ser mudado** | Não | Ações de e-mail, atualização de contato e outras | Não |
| **Attio** | *Registro criado, registro atualizado, valor de atributo mudou* (dispara também na criação), adicionado a lista, entrada de lista atualizada, tarefa criada, nota criada, agenda, webhook | Blocos de workflow | Editor de blocos | Não | Bloco de ação | Não |
| **Stripe** (só para nomes) | Padrão `objeto.ação` (`customer.created`); o evento carrega uma referência ao objeto | — | — | — | — | — |

## 3. O que se repete

1. **Nome de evento no formato `objeto.ação`** (Stripe, Attio, Pipedrive). É o mesmo formato que o Kalidash já usa (`lead.criado`).
2. **Gatilho por etapa é o padrão dos CRMs** (Bitrix24, Kommo, Pipefy, RD Station). Configura-se dentro da etapa; o Kalidash faz isso nos requisitos.
3. **Template é uma receita copiada, não um vínculo.** HubSpot oferece "fazer cópia"; o ActiveCampaign importa com todos os passos editáveis. Editar a cópia não muda o modelo nem o que já roda em outro lugar.
4. **Aplicar aos que já estão lá** é uma necessidade real (Kommo tem uma caixa para isso). Sem ela, criar uma regra hoje só vale para registros novos.
5. **Tarefa concluída também é evento**: o Bitrix24 mexe na etapa quando a tarefa vinculada termina.
6. **Bloqueio de etapa é raro e valioso**: só Zoho e Pipefy impedem de verdade. O Salesforce só orienta. O Kalidash (requisitos que impedem entrar ou sair) fica no grupo forte.
7. **Ciclo de vida automático só avança.** O HubSpot não recua sozinho e exige limpar o valor para voltar; guias de terceiros recomendam regra de "supressão" para um cliente não voltar a Lead por preencher um formulário de novo. O domínio do Kalidash já trata isso com a marca "cliente retornando".
8. **Quando um campo é governado por processo, a edição manual é travada** (Zoho). Sustenta a decisão de o ciclo de vida não ser um campo livre.
9. **Ramificação (se/senão) aparece nas ferramentas de marketing** (ActiveCampaign, Pipedrive); os CRMs de vendas (Bitrix24, Kommo, RD) ficam em regras **lineares com condição**.
10. **Limites por plano** (RD: 50 e 100; Pipedrive: Growth ou acima) são comerciais. No Kalidash, uso interno, o que importa é o **registro de execuções**, que já existe em Automações.

## 4. O que isso vira no Kalidash

### 4.1 Catálogo de eventos (padronizado)
Formato `objeto.ação`, em quatro famílias, sem inventar nomes fora delas:

| Família | Exemplos |
|---|---|
| **Registro** (criado, atualizado, arquivado) | `lead.criado`, `pessoa.atualizada`, `empresa.criada` |
| **Estado do funil** | `lead.qualificado`, `lead.descartado`, `oportunidade.mudou_de_etapa`, `oportunidade.ganha`, `oportunidade.perdida` |
| **Tarefa** | `tarefa.criada`, `tarefa.concluida`, `tarefa.atrasada` |
| **Tempo** | `oportunidade.parada`, `lead.sem_contato`, data específica |

O catálogo já existe em `mocks/automations.ts` (16 eventos). O que falta: os eventos de **atualização de campo** (`campo.mudou`, como o "valor do atributo mudou" do Attio) e `lead.sem_contato`.

### 4.2 Passo e template
- **Passo** = evento + condição (pipeline, etapa, campo) + uma ou mais **ações** (criar tarefa, mover etapa, notificar, e-mail, atribuir dono, **definir ciclo de vida**) + atraso opcional.
- **Template de ciclo de vida** = nome + lista ordenada de passos, mais as etapas e os requisitos da pipeline. É o "template padrão" que hoje só tem CNPJ e fonte.
- **Templates prontos** para começar: *Venda consultiva B2B*, *Inbound rápido (B2C)*, *Parcerias* e *Pós-venda e onboarding do cliente*.
- **Editar**: lista vertical de passos, como a sequência do HubSpot (adicionar, remover, mover, duplicar), com salvar ou **salvar como novo template**.
- **Aplicar**: ao criar a pipeline, o template é **copiado**; cada passo vira uma **automação gerenciada** (aparece em Automações, categoria conforme a ação). O botão "atualizar a partir do template" é opcional e mostra o que muda.

### 4.3 Ciclo de vida como consequência dos eventos
| Evento | Efeito no ciclo de vida |
|---|---|
| `lead.criado` | Pessoa (e empresa) em **Lead** |
| `oportunidade.criada` | **Oportunidade** |
| `oportunidade.ganha` | **Cliente** (a empresa, se houver; senão a pessoa) |
| `oportunidade.perdida` ou `lead.descartado` sem outro registro ativo | **Inativo** |

Regras: só avança sozinho (como o HubSpot); voltar é ação explícita com motivo. "Cliente de antes do sistema" é a ação manual "marcar como cliente (legado)". Como esses efeitos são **passos do template**, o time pode ajustar (por exemplo, exigir uma tarefa de onboarding antes de virar Cliente).

### 4.4 Onde aparece
- **Automações**: todos os passos, agrupados por categoria, com origem "gerenciada pelo template".
- **Configurações da pipeline**: aba nova **Ciclo de vida** com a lista de passos e o botão "trocar de template".
- **Tarefas (workflow)**: os passos que criam tarefas aparecem como requisitos, com o mesmo desenho de hoje.

## 5. Pontos para fechar

1. **Cópia ou vínculo?** Recomendado: cópia (como HubSpot e ActiveCampaign), com "atualizar a partir do template" opcional.
2. **O template cobre o pós-venda?** Recomendado: sim, como um template à parte encadeado ao ganho (onboarding, check-in em 30 e 90 dias, renovação).
3. **Ramificação?** Recomendado: não na v1. Passos lineares com condição, como Bitrix24, Kommo e RD Station. Entra depois se houver necessidade.
4. **Uma automação pode ter várias ações e atraso?** Recomendado: sim, lista de ações com atraso por ação.
5. **Aplicar aos registros já existentes ao criar ou editar um passo?** Recomendado: pergunta na hora, com contagem dos afetados (como o Kommo).
6. **Lista final do catálogo de eventos** (seção 4.1) e se `campo.mudou` entra já.

## 6. Fontes

- HubSpot: [estágios do ciclo de vida](https://knowledge.hubspot.com/records/use-lifecycle-stages), [sincronização de estágios](https://knowledge.hubspot.com/object-settings/manage-how-lifecycle-stages-sync-between-objects), [criar e editar sequências](https://knowledge.hubspot.com/sequences/create-and-edit-sequences). A regra de "supressão" vem de guias de consultorias, como o [Pedowitz Group](https://www.pedowitzgroup.com/blog/hubspot-lifecycle-stages-blog).
- Pipedrive: [primeiros passos em automações](https://support.pipedrive.com/en/article/workflow-automation). Os modelos e o exemplo "proposta enviada → follow-up em 3 dias" vêm de guias de terceiros, como o [Zeeg](https://zeeg.me/en/blog/post/pipedrive-workflow-automation).
- Zoho CRM: [executar Blueprint](https://help.zoho.com/portal/en/kb/crm/process-management/blueprint/articles/execute-blueprint) e o [tutorial da Zenatta](https://zenatta.com/zoho-crm-blueprints-2026/) (Antes, Durante e Depois; campos opcionais).
- Salesforce: [Guide Users with Path](https://help.salesforce.com/s/articleView?id=sf.path_overview.htm&language=en_US&type=5) e [Trailhead](https://trailhead.salesforce.com/content/learn/modules/sales_admin_optimize_salesforce_for_selling/sales_admin_optimize_for_selling_unit_1).
- Pipefy: [evento "card entra em fase"](https://help.pipefy.com/en/articles/3675131-how-to-create-an-automation-for-when-a-card-enters-a-specific-phase), [ações de automação](https://help.pipefy.com/en/articles/6272578-set-up-an-automation-action) e [galeria de modelos](https://www.pipefy.com/glossary/).
- Bitrix24: [regras de automação e gatilhos no CRM](https://helpdesk.bitrix24.com/open/19944826/).
- Kommo: [gatilhos do Digital Pipeline](https://www.kommo.com/support/crm/pipeline-triggers/).
- RD Station CRM: [automação de vendas](https://www.rdstation.com/produtos/crm/vendas/automacao/).
- ActiveCampaign: [receitas prontas](https://help.activecampaign.com/hc/en-us/articles/360013630199-How-to-use-pre-built-automation-recipes-in-ActiveCampaign).
- Attio: [blocos de gatilho](https://attio.com/help/academy/workflows-course/trigger-blocks).
- Stripe: [tipos de evento](https://docs.stripe.com/api/events/types) e [convenções de nome de eventos de webhook](https://www.svix.com/resources/webhook-university/implementation/webhook-event-naming-conventions/).

*Limitações: nada foi testado nas ferramentas; a comparação vem de páginas de ajuda e de guias. O suporte a "bloqueio de etapa" no Bitrix24 e o catálogo de modelos do Pipedrive não foram confirmados em fonte oficial.*
