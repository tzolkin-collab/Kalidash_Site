# 🗃️ Bench de dados: o que os outros CRMs guardam

> Data: 26/09/2026. Compara os **campos** que HubSpot, Pipedrive, Salesforce, RD Station CRM e Zoho guardam para pessoa, empresa, lead, oportunidade e tarefa, e define o que o Kalidash vai guardar.
>
> **Método:** documentação oficial de cada produto (páginas de propriedades e referências de API). Nada foi testado na prática.
> **Limites:** as páginas de referência do Salesforce bloquearam a consulta; as células dele marcadas com † vêm do conhecimento da documentação, com confirmação parcial por busca (o objeto de papel do contato, o vínculo de tarefa e os campos principais da oportunidade). Do RD Station só verifiquei negócio e fonte (`n/v` = não verificado). O Zoho entra só no negócio.

---

## 1. O que o bench mostra

1. **Lead é um registro, não só um estado da pessoa.** No Pipedrive é a *Leads Inbox*: título, dono, etiquetas, pessoa ou organização, fonte (`source_name`, `origin`, `channel`), valor e previsão estimados, "visto"; ao converter em negócio, notas, e-mails e atividades vão junto. No HubSpot o Lead tem **pipeline e etapa próprios** e mede o "tempo até o primeiro toque". No Salesforce o Lead converte em Conta, Contato e Oportunidade. → Isso **revisa** a definição anterior (Lead = estado da pessoa). Um Lead com pipeline e fonte próprios é o que permite a coluna de Leads por pipeline.
2. **A origem é guardada em três camadas:** na pessoa ou empresa (origem inicial, automática no HubSpot, com dois níveis de detalhe), no lead ou negócio (Pipedrive: origem, canal; RD: fonte) e na campanha (Salesforce `CampaignId`; RD `campaign`; HubSpot campanha do primeiro e do último toque).
3. **Stakeholders têm papel.** Salesforce: tabela de ligação com `Role` e `IsPrimary` (no máximo um principal por oportunidade). HubSpot: papel de compra. RD: lista de contatos no negócio. Pipedrive: pessoa mais participantes.
4. **Campo obrigatório por etapa existe, mas vaza.** Pipedrive: por pipeline e etapa, plano Professional, **não vale para importação, API, automação ou edição em massa**. Como o Kalidash é dono da API, pode validar no servidor em todos os caminhos.
5. **Motivo de perda, tempo na etapa e próxima atividade** são campos de primeira classe nos que verifiquei (HubSpot: motivo de perda e de ganho, data de entrada e tempo na etapa, próxima atividade; Pipedrive: motivo de perda, `stage_change_time`; RD: motivo de perda configurável).
6. **Formulário → funil não é campo da pipeline em nenhum deles.** HubSpot: o formulário só cria o **contato**; para criar negócio precisa de *workflow* (automação). Pipedrive: o Web Form escolhe, por formulário, criar **Lead na caixa de entrada ou Negócio em uma pipeline específica**, mas é um recurso pago (LeadBooster). Tornar a fonte um campo obrigatório da pipeline é o que você pediu ("sem automação complexa") e é diferencial.
7. **Nenhum traz CPF ou CNPJ como campo padrão** (verificado em HubSpot e Pipedrive). Terá que ser modelado, com CNPJ alfanumérico.

---

## 2. Pessoa (contato)

| Dado | HubSpot | Pipedrive | Salesforce † | Kalidash |
|---|---|---|---|---|
| Nome | Nome, sobrenome, saudação | `name` (único) | FirstName, LastName | **Guardar** nome e sobrenome |
| E-mail | 1 principal | Vários, com rótulo e principal | Email | **Guardar vários**, com principal |
| Telefone | Fixo, celular, fax | Vários, com rótulo e principal | Phone, MobilePhone | **Guardar vários**, com marca WhatsApp |
| Cargo | Cargo, função, senioridade, persona, papel de compra | `job_title` | Title, Department | **Guardar** cargo. Papel de compra fica na ligação com a oportunidade |
| Empresa | Associação | `org_id` | AccountId | **Guardar** (opcional) |
| Documento | — | — | — | **Guardar CPF** (criptografado, opcional) |
| Ciclo de vida | Lifecycle stage, lead status, prioridade | — | (só no Lead) | **Guardar** `lifecycle` (calculado) |
| Origem | Origem original e última (com 2 detalhes), campanha do 1º e do último toque, fonte do registro | — | LeadSource | **Guardar** origem inicial + UTM |
| Consentimento | Base legal, descadastro, tipos de e-mail, status de marketing, idioma | `marketing_status` | HasOptedOutOfEmail, DoNotCall | **Guardar** base legal LGPD, data e canal |
| Dono e visibilidade | Dono, equipe, compartilhados | `owner_id`, `visible_to` | OwnerId | **Guardar** dono |
| Métricas | Datas de criação, alteração, dono atribuído | Contagem de atividades, e-mails e negócios (abertos, ganhos, perdidos), próxima e última atividade | — | **Derivar** (não gravar) |
| Endereço, aniversário | Endereço completo | Endereço, aniversário, mensageiros | MailingAddress | Depois |

## 3. Empresa (B2B)

| Dado | HubSpot | Pipedrive | Salesforce † | Kalidash |
|---|---|---|---|---|
| Nome | Nome, domínio, site | `name`, `website`, `linkedin` | Name, Website | **Guardar** nome fantasia e razão social, site/domínio (dedupe) |
| Documento | — | — | — | **Guardar CNPJ** (alfanumérico, único) |
| Classificação | Setor, grupo, tipo, faixa e número de funcionários, faturamento | `industry`, `employee_count`, `annual_revenue` | Type, Industry, NumberOfEmployees, AnnualRevenue | **Guardar** setor e porte (faixa); faturamento depois |
| Endereço | Endereço completo, fuso | Endereço em componentes | Billing e Shipping | **Guardar** rua, cidade, UF, CEP |
| Ciclo de vida | Lifecycle stage, lead status, data de fechamento | — | — | **Guardar** `lifecycle` (calculado) |
| Origem | Fonte do registro, origem original e última | — | AccountSource | **Guardar** origem inicial |
| Hierarquia | — | — | ParentId | Depois |
| Datas úteis | Primeiro negócio criado, última atividade, último contato | Contagens de pessoas e negócios | — | **Derivar** |

## 4. Lead

| Dado | Pipedrive | HubSpot | Salesforce † | Kalidash |
|---|---|---|---|---|
| Identificação | `title`, `person_id`, `organization_id` | Nome do lead, contato e empresa primários | Nome, Company, Title, Email, Phone | **Guardar** título, pessoa, empresa (opcional) |
| Funil | — (caixa de entrada única) | **Pipeline e etapa próprios**, categoria, rótulo, tipo | Status | **Guardar** `pipelineId` (oferta) e status |
| Fonte | `source_name`, `origin`, `channel`, `channel_id` | Lead Source, fonte do registro (3 detalhes) | LeadSource, Rating | **Guardar** `sourceId` + UTM + payload do envio |
| Valor e previsão | `value`, `expected_close_date` | — | AnnualRevenue (da empresa) | **Guardar** (opcionais) |
| Dono e leitura | `owner_id`, `was_seen` | Dono, equipe | OwnerId | **Guardar** dono e "visto" |
| Tempo | `add_time`, `update_time` | Primeiro contato, **tempo até o primeiro toque**, datas de entrada e saída de etapa | CreatedDate | **Guardar** e **derivar** tempo até o 1º contato |
| Encerramento | `is_archived` | — | IsConverted + ids convertidos | **Guardar** convertido para (oportunidade) ou descartado com motivo |
| Conversão | Cria o negócio; **notas, arquivos, e-mails e atividades são transferidos** | — | Cria Conta, Contato e Oportunidade | Igual ao Pipedrive |

## 5. Oportunidade (negócio)

| Dado | HubSpot | Pipedrive | RD Station | Salesforce † | Zoho | Kalidash |
|---|---|---|---|---|---|---|
| Nome | `dealname`, descrição | `title` | `name` | Name, Description | Deal Name, Description | **Guardar** |
| Funil e etapa | Pipeline, stage | `pipeline_id`, `stage_id` | `deal_pipeline_id`, `deal_stage_id` | StageName | Stage | **Guardar** `pipelineId`, `stageId` |
| Valor | Amount, moeda, câmbio, ACV, ARR, MRR, TCV, ponderado, previsto | `value`, `currency` | — (por produtos) | Amount | Amount, Expected Revenue | **Guardar** valor (`Decimal`) e moeda (BRL). Recorrência depois |
| Previsão | Close date | `expected_close_date` | `prediction_date` | CloseDate | Closing Date | **Guardar** |
| Probabilidade | Deal probability, forecast category, score | `probability` | `rating` | Probability, ForecastCategory | Probability | **Guardar** (padrão da etapa) |
| Estado | Fechado ganho/perdido | `status` (aberto, ganho, perdido) + datas de ganho e perda | `win`, `hold` | IsClosed, IsWon | — | **Guardar** aberta, ganha, perdida (+ pausada) e as datas |
| Motivo | **Motivo de perda e de ganho** | `lost_reason` | `deal_lost_reason_id` (lista configurável) | — | — | **Guardar** motivo (lista configurável) |
| Pessoas | Contatos associados, papel de compra | `person_id` + participantes | `contacts[]` | **OpportunityContactRole** (Role, IsPrimary) | Contact Name | **Guardar** ligação N:M com papel e principal |
| Empresa | Empresa associada | `org_id` | `organization` | AccountId | Account Name | **Guardar** (alvo: empresa **ou** pessoa) |
| Origem | Fonte original e última | `origin`, `channel`, `source_lead_id` | `deal_source`, `campaign` | LeadSource, CampaignId | Lead Source, Campaign Source | **Guardar** origem (inbound/outbound), fonte, campanha, UTM e lead de origem |
| Dono | Dono, colaborador | `owner_id` | `user_id`, `closed_by_id` | OwnerId | Deal Owner | **Guardar** dono |
| Tempo | Data de entrada e **tempo na etapa atual** | `add_time`, `stage_change_time` | — | — | — | **Guardar** data de entrada na etapa (deriva o tempo parado) |
| Próximo passo | Próxima atividade, próximo passo, próxima reunião | `next_activity_id` | — | NextStep | Next Step | **Derivar** da próxima tarefa; campo de texto opcional |
| Prioridade | Priority | — | — | — | — | **Guardar** prioridade e tags |
| Produtos | — | (produtos) | `deal_products` | Itens de linha | — | Depois |
| Obrigatórios | — | Por pipeline e etapa | — | Regras de validação | Nome, conta, data, etapa | **Guardar** por etapa, validado no servidor |

## 6. Tarefa (atividade)

| Dado | Pipedrive | Salesforce † | HubSpot † | Kalidash |
|---|---|---|---|---|
| Título e tipo | `subject`, `type` | Subject, Type | Título, tipo (ligação, e-mail, tarefa) | **Guardar** |
| Prazo | `due_date`, `due_time`, `duration` | ActivityDate | Data e hora | **Guardar** prazo com hora |
| Estado | `done` | Status | Status | **Guardar** concluída em |
| Prioridade e resultado | `priority`, `outcome` | Priority | Prioridade | **Guardar** prioridade e resultado |
| Responsável | `owner_id` | OwnerId | Atribuído a | **Guardar** |
| Vínculo | `deal_id`, `lead_id`, `person_id`, `org_id` | **WhoId** (pessoa ou lead) e **WhatId** (conta, oportunidade…) | Registros associados | **Guardar** vínculo a lead, oportunidade, pessoa ou empresa |
| Local e participantes | `location`, `participants` | — | — | Depois (junto do Google Meet) |
| **Tags** | — | — | — | **Guardar** (exigência do Kalidash) |
| **Origem da tarefa** | — | — | — | **Guardar**: manual ou regra do sistema |
| **Campo faltante** | — | — | — | **Guardar** entidade e campo que a tarefa pede para completar |

Nenhum dos consultados liga uma tarefa a **um campo faltante**. É o que faz a "lista de pendências" do Kalidash: preencher o campo conclui a tarefa.

## 7. Pipeline, etapa e fonte

| Dado | HubSpot | Pipedrive | RD Station | Kalidash |
|---|---|---|---|---|
| Pipeline | Nome, ordem, etapas | Nome, etapas | Funil, etapas | **Guardar** nome, oferta, modo (inbound, outbound ou ambos), ativa, ordem |
| Etapa | Nome, probabilidade | Nome, probabilidade, dias para "apodrecer" | Nome | **Guardar** nome, ordem, cor, tipo (aberta, ganha, perdida), probabilidade, dias para alerta |
| Campos obrigatórios | Por etapa | Por pipeline e etapa | — | **Guardar** por etapa |
| Fonte | Origem automática por UTM | `source_name`, `origin`, `channel` | **Fonte** (nome, descrição) e campanha | **Guardar** fonte (tipo, formulário conectado) e **ligar à pipeline** |
| Formulário → funil | Só contato; negócio exige workflow | Web Form escolhe Lead ou Negócio numa pipeline (pago) | n/v | **Campo da pipeline**: a fonte indicada alimenta sozinha |

## 7.1. Pendências por fase e área de tarefas (Pipefy)

Os concorrentes de referência são **todos** os CRMs consultados. O mais próximo do modelo de pendências por fase é o **Pipefy** (a referência de processo que a Carol passou no início); o que verifiquei na documentação dele:

- Os **campos de cada fase** definem o que o time precisa fazer naquela fase, e o campo **obrigatório trava** o card: ele só avança com o campo preenchido. No Kalidash a pendência é uma **tarefa**, e o bloqueio (impedir entrar ou sair da etapa) é opcional por requisito.
- Há a área **Minhas Tarefas** (*My Work*): cards atribuídos ao usuário e tarefas pendentes ou concluídas, filtráveis por pipe, com vistas em Kanban, lista e calendário.
- **Tarefas** no Pipefy são atividades enviadas a pessoas (o formulário de uma fase, por e-mail) para coletar informação ou aprovação.
- **Não encontrei** uma tela que desenhe o **funil inteiro de cada pipeline em modo de pendências**, nem tarefa ligada a **um campo faltante de cadastro**. Não afirmo que não exista; apenas não achei.

---

## 8. Fontes

- HubSpot: [propriedades de contato](https://knowledge.hubspot.com/properties/hubspots-default-contact-properties), [de empresa](https://knowledge.hubspot.com/properties/hubspot-crm-default-company-properties), [de negócio](https://knowledge.hubspot.com/properties/hubspots-default-deal-properties), [de lead](https://knowledge.hubspot.com/properties/hubspots-default-lead-properties); formulário só cria contato: [HubSpot Community](https://community.hubspot.com/t5/CRM/deal-pipeline-automation-from-a-hubspot-form-submission/td-p/1017581).
- Pipedrive: API de [Deals](https://developers.pipedrive.com/docs/api/v1/Deals), [Persons](https://developers.pipedrive.com/docs/api/v1/Persons), [Organizations](https://developers.pipedrive.com/docs/api/v1/Organizations), [Leads](https://developers.pipedrive.com/docs/api/v1/Leads) e [Activities](https://developers.pipedrive.com/docs/api/v1/Activities); [campos obrigatórios](https://support.pipedrive.com/en/article/required-fields); [Web Forms](https://support.pipedrive.com/en/article/web-forms).
- RD Station CRM: [negociações](https://developers.rdstation.com/reference/rdcrm-negociacoes) e [fontes](https://developers.rdstation.com/reference/crm-v1-deal-sources).
- Zoho CRM: [campos padrão de Deals](https://help.zoho.com/portal/en/kb/crm-nextgen/sales-force-automation/deal-management/articles/nextgen-standard-fields-deals).
- Salesforce: [OpportunityContactRole](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_opportunitycontactrole.htm) e [Task](https://developer.salesforce.com/docs/atlas.en-us.sfFieldRef.meta/sfFieldRef/salesforce_field_reference_Task.htm) (confirmação parcial; páginas de campos bloqueadas).
- Pipefy: [campos de fase](https://help.pipefy.com/en/articles/614598-field), [tarefas](https://help.pipefy.com/en/articles/7039271-what-are-tasks), [cards atribuídos a você](https://help.pipefy.com/en/articles/1602018-how-to-find-all-cards-assigned-to-you) e [vistas do pipe](https://help.pipefy.com/en/articles/3143190-choosing-pipe-views).
- CNPJ alfanumérico: [Receita Federal](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico).
