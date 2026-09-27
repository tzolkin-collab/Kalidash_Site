# 🧭 Definição de domínio: leads, oportunidades, pessoas, empresas e clientes

> **Status: v2.1 (27/09/2026), confirmada.** Sem pontos abertos de domínio (seção 13).
> Consolida o que foi definido em conversa e o [bench de dados](./benchmark-dados.md). Substitui o modelo de dados e o ciclo de vida do lead do [ARCHITECTURE.md](./ARCHITECTURE.md), do [crm.md](./pagesAdmin/crm.md) e do [inbound-leads.md](./inbound-leads.md).
> O plano de schema e de migração está em [plano-schema.md](./plano-schema.md). **Nada foi alterado no banco.**

---

## 1. Princípios

1. **Lead não é oportunidade.** Lead é interesse ainda não trabalhado; oportunidade é uma negociação. Ambos aparecem na pipeline, mas o lead só quando se clica em **Ver leads**.
2. **Cliente é um estado**, de Pessoa ou de Empresa, e a tela sempre diz qual dos dois é.
3. **Toda pipeline tem fonte**, e o lead sempre sabe de onde veio: de uma fonte (inbound) ou de um contato interno (outbound).
4. **Cada etapa sabe o que exige.** Dado faltante e ação necessária viram tarefas, por pipeline, com tags. Preencher o campo conclui a tarefa, e uma etapa pode ser impedida até isso acontecer.
5. **Configurar uma vez.** O que se configura num painel simples (conectar fonte, marcar campo como tarefa) vira uma **automação gerenciada** que aparece na página Automações, sem duplo esforço.
6. **Quase tudo é opcional.** O único dado que a plataforma exige é o CNPJ para uma empresa ficar completa.

## 2. Entidades

| Entidade | O que é | Tabela |
|---|---|---|
| **Pessoa** | Contato ou stakeholder. Pode ter empresa ou não (B2C). | `Contact` |
| **Empresa** | Conta B2B. Sem CNPJ fica **em análise**. | `Company` |
| **Lead** | Interesse de uma pessoa (e empresa, se houver) numa oferta. Vive numa pipeline. | `Lead` (nova) |
| **Oportunidade** | Negociação numa etapa de uma pipeline. | `Opportunity` |
| **Stakeholder** | Pessoa numa oportunidade: contato padrão ou outro, com descrição e tags. | `OpportunityContact` (nova) |
| **Pipeline** | O **funil de uma oferta**, com etapas e fontes. | `Pipeline`, `Stage` |
| **Fonte** | De onde vêm os leads: formulário conectado, manual ou importação. | `Source`, `PipelineSource` |
| **Tarefa** | Pendência com tags, prazo e responsável. | `Task` |
| **Requisito de etapa** | Tarefa ou campo que uma etapa exige, com tag e, se for o caso, bloqueio. É o que o workflow desenha. | `StageRequirement` |
| **Campo personalizado** | Campo criado pelo time em Pessoa, Empresa, Lead ou Oportunidade. | `CustomField` |
| **Automação** | Gatilho → ação sobre eventos e dados da plataforma. | `Automation` |
| **Envio de formulário** | Registro bruto de cada envio (payload, UTM, página). | `LeadSubmission` |
| **Cliente** | Estado de Pessoa ou Empresa. | `lifecycle` em `Contact` e `Company` |

```
Formulário ─┐
Manual ─────┼─ Fonte ── Pipeline (funil da oferta) ── Etapas: [Leads] → [Abertas] → Ganha / Perdida
Importação ─┘                 │
                              ├── Lead ──(qualificar)──> Oportunidade ──> Ganha ──> Cliente
                              │     │                        │
                              │   Pessoa / Empresa     Stakeholders (padrão + outros)
                              └── Requisitos de etapa ──> Tarefas
```

## 3. Pipeline, fontes e "Conectar fonte"

- **Uma pipeline = um funil = uma oferta.** O nome da oferta é um campo da pipeline.
- **Uma pipeline tem várias fontes.** Cada fonte é de um tipo: **formulário conectado** (inbound), **manual** ou **importação** (outbound). Uma pipeline com formulário e manual roda os dois modos.
- **Toda pipeline precisa de uma fonte.** Sem fonte, ela avisa e gera a tarefa "Definir fonte da pipeline" (tag `configuração`). Não bloqueia.
- **Um formulário alimenta uma só pipeline.** Motivo: cada envio precisa cair num lugar certo. Se o mesmo formulário alimentasse duas, cada envio criaria dois leads da mesma pessoa. Se um dia um formulário precisar rotear por resposta (por exemplo, o campo "interesse"), isso é uma regra de roteamento, não duas fontes.
- **Etapas:** cada pipeline tem etapas dos tipos **Lead**, **Aberta**, **Ganha** e **Perdida**. As de tipo Lead (padrão: "Novos" e "Em contato") são as **colunas de leads**, que só aparecem em **Ver leads**. A pipeline nova nasce com: Novos e Em contato (Lead); Qualificação, Proposta, Negociação e **Assinatura do contrato** (Aberta); Ganho; Perdido. O time renomeia, reordena e cria etapas.
- **Conectar fonte (assistente simples):** escolher o formulário, mapear os campos (nome, e-mail, telefone, CPF/CNPJ, empresa, cargo, interesse), escolher o que fazer (criar ou atualizar a pessoa, criar a empresa se houver CNPJ, criar o lead em qual coluna, dono, tags). Salvar cria uma **automação gerenciada**. Ela aparece na página Automações, na categoria "Fontes". Editar no assistente ou lá altera o mesmo registro.

## 4. Lead

- **Origem obrigatória:** ou uma **fonte** (inbound), ou um **contato interno**, o funcionário que trouxe o lead, marcado como **outbound**. Lead sem um dos dois não é criado.
- **Campos:** título, pipeline, coluna (etapa do tipo Lead), origem, pessoa, empresa (opcional), tags, dono, valor e previsão estimados (opcionais), "visto", datas.
- **Estado do registro:** aberto, convertido ou descartado (com motivo).
- **Adicionar lead à mão:** na coluna de Leads ou na página Leads. Pede o contato interno que trouxe.
- **Qualificar** cria a oportunidade na **primeira etapa aberta** e transfere notas, tarefas e e-mails. Vale o **botão** ou **arrastar** o lead da coluna de leads para uma etapa aberta (**opcional**, o botão basta).
- **Origem da oportunidade:** o lead inbound gera oportunidade `INBOUND`; o manual ou de importação, `OUTBOUND`. Também dá para criar oportunidade direta, sempre `OUTBOUND`.
- **Descartar** não conta como oportunidade perdida.
- **Cliente que preenche de novo** entra como lead com a marca "cliente retornando".
- **Tempo até o primeiro contato** é calculado e vai para o dashboard.

## 5. Pessoas, empresas e documento (CPF/CNPJ)

Campo **explícito** de documento no formulário de lead e no cadastro:

| Situação | Resultado |
|---|---|
| **CNPJ válido** | Cria a **Empresa**; a pessoa vira stakeholder dela. Abre o formulário "Cadastrar empresa" ou permite "completar depois". |
| **Empresa sem CNPJ** | Pode ser cadastrada. Fica **em análise** e a tarefa "Informar CNPJ" (tag `dados da empresa`) fica **não feita**. Ao informar o CNPJ, a empresa sai de análise e a tarefa conclui. |
| **Marcou "tenho CNPJ" e não preencheu** | Mesma tarefa "Informar CNPJ". |
| **Só CPF** | Pessoa física (B2C): a Pessoa é o alvo. O CPF é sensível e fica criptografado. |
| **Documento que já existe** | Vincula ao registro existente, sem duplicar, e avisa. |

- **Único obrigatório:** o CNPJ, e só para a empresa ficar completa. O nome é o mínimo técnico de qualquer registro. Todo o resto é opcional e, se o time quiser, vira tarefa (seção 8).
- **CNPJ alfanumérico:** desde 31/07/2026 a Receita emite CNPJ com letras nas 12 primeiras posições (14 caracteres; os 2 últimos seguem dígitos verificadores). Máscara, armazenamento e validação aceitam letras e números; os antigos continuam válidos.
- **Enriquecimento** pela consulta pública de CNPJ é opcional; se falhar, vira tarefa.

## 6. Oportunidade e stakeholders

- **Alvo:** a **Empresa** (B2B) **ou** a **Pessoa** (B2C). A tela mostra o tipo com ícone e rótulo (Empresa ou Pessoa).
- **Stakeholders:** cada oportunidade tem um **contato padrão** (principal) e **outros contatos**. Cada um tem **descrição** (texto livre) e **tags**, criadas pelo time com a função da pessoa (ex.: "decisor", "financeiro", "técnico"). A lista de tags é do time. A mesma pessoa pode estar em várias oportunidades.
- **Valor:** `Decimal`, em reais. **Estado:** aberta, ganha ou perdida, com data e **motivo** (lista configurável).
- **Origem:** `INBOUND` ou `OUTBOUND`, mais fonte, campanha e UTM herdados do lead.
- **Tempo na etapa** vem da data de entrada na etapa atual.

## 7. Ciclo de vida e Cliente

`lifecycle` de Pessoa e de Empresa: **Lead → Oportunidade → Cliente → Inativo**, calculado:

- Tem lead aberto e nenhuma oportunidade → **Lead**.
- Tem oportunidade aberta → **Oportunidade**.
- **Ganhou** → **Cliente**: a **Empresa, quando houver; senão a Pessoa**. As outras pessoas seguem como stakeholders.
- Perdeu ou descartou e não tem outra ativa (e não é cliente) → **Inativo**.
- Cliente de antes do sistema: marcado à mão.
- **Empresa em análise** (sem CNPJ) avança normalmente pelo funil, mas o sistema **impede na hora em que ela chega à etapa de Assinatura do contrato**. Sem CNPJ ela não entra nessa etapa e, portanto, não ganha. É uma regra do template padrão, editável por pipeline (como o campo obrigatório por fase do Pipefy).

## 8. Requisitos de etapa, pendências e campos personalizados

- **Requisito de etapa:** o que uma etapa exige para o cliente avançar com a equipe. Tem dois tipos: **campo** (um campo de cadastro marcado como tarefa) e **ação** (tarefa avulsa, ex.: "Enviar proposta", "Reunião de diagnóstico").
- **Marcar como tarefa:** em qualquer campo de cadastro (Pessoa, Empresa, Lead ou Oportunidade, **do sistema ou personalizado**), a pipeline liga "marcar como tarefa" numa etapa. Se o campo estiver vazio, a tarefa nasce com **tag**, responsável e prazo configuráveis. Preencher o campo conclui a tarefa. É uma **automação gerenciada** (categoria "Pendências").
- **Quando nasce:** na criação do registro (ex.: "Informar CNPJ") ou ao entrar na etapa.
- **Bloqueio (opcional):** **impede entrar** na etapa, ou **impede sair** dela, enquanto a tarefa estiver aberta. Sem bloqueio, a tarefa só acompanha.
- **Template padrão de cada pipeline:** "Informar CNPJ" (nasce no cadastro da empresa, **impede entrar em Assinatura do contrato**), "Definir fonte da pipeline" (configuração), e os dados faltantes que o time escolher.
- **Toda tarefa tem tags** (`dados da pessoa`, `dados da empresa`, `configuração`, `ligação`, `reunião`, `e-mail`, e as do time). Guarda origem (manual ou requisito), vínculo (lead, oportunidade, pessoa ou empresa) e, nas de dado faltante, **qual campo** falta.
- **Aparece** na cronologia da oportunidade, no workflow da pipeline e como **próxima ação** no card.
- **Campos personalizados:** o time cria campos por entidade (texto, número, data, lista, seleção múltipla, sim/não, link). Ficam disponíveis em formulários, listas e nos requisitos de etapa.

## 9. Automações, e-mails e as três páginas

- **E-mails** é uma página própria: gerenciar e montar templates (o editor visual), histórico de envio.
- **Automações** é outra página própria: **catálogo de tudo o que o sistema permite**, classificado por categoria (Fontes, Leads, Oportunidades, Pendências, Notificações, E-mails e outras que vierem), com interface própria de criação e manutenção, usando a infraestrutura, os eventos e os dados da plataforma (`lead.criado`, `oportunidade.mudou_de_etapa`, `tarefa.concluida`, `formulario.enviado`…).
- **Origem da automação:** manual (criada ali) ou **gerenciada** (criada por trás dos panos por "Conectar fonte" ou "Marcar como tarefa"). As gerenciadas aparecem na lista, e apagar a fonte apaga a automação dela.
- Cada automação mostra estado, última execução e quantidade de execuções.

## 10. Telas

| Tela | O que tem |
|---|---|
| **Dashboard** | Métricas do CRM. |
| **Leads** | Página própria: leads de todas as pipelines, filtro por pipeline, fonte, origem e tags; Qualificar, Descartar, Adicionar lead. |
| **Oportunidades** | Seletor de pipeline, **engrenagem** ao lado (dica "Configurações das pipelines"), Kanban e Lista. Detalhes abaixo. |
| **Tarefas** | **Galeria de funis em cards**, cada um com o desenho do seu workflow. Abrir um card abre a **página do workflow** (seção 11). |
| **Pessoas & Empresas** | Duas visões, com contagem e paginação. |
| **Clientes** | Página própria: clientes Pessoa e Empresa, com abas Todos, Empresas e Pessoas. |
| **E-mails** | Templates e histórico. |
| **Automações** | O catálogo classificado. |
| **Configurações das pipelines** (painel dedicado, fora do modal atual) | Ver, editar, excluir e criar pipelines (excluir uma com oportunidades exige movê-las antes). Etapas (nome, ordem, cor, tipo, probabilidade, dias para alerta). Fontes e **Conectar fonte**. Marcar campos como tarefa. Tags de tarefa e de contato. Campos personalizados. |

### Oportunidades em detalhe

- **Botão "Ver leads"** ao lado do **Filtro**. Ligado, o **Kanban** abre as **colunas de leads** à esquerda, com as **tags** dos leads. Na **Lista**, os leads entram misturados, **diferenciados** dos ativos (selo "Lead", linha mais clara e marca lateral tracejada).
- **Contagem:** cada coluna mostra quantidade e valor (os leads ficam **fora** dos totais de valor); a lista mostra "1–20 de N". O cabeçalho mostra oportunidades e, com Ver leads ligado, leads.
- **Paginação:** por coluna no Kanban ("carregar mais", 20 por vez) e por página na Lista (tamanho da página ajustável). A API devolve total e contagem por etapa.
- **Cliente Pessoa ou Empresa:** em card e linha, a Empresa aparece com ícone de prédio e o contato padrão abaixo; a Pessoa (B2C) aparece com ícone de pessoa. O selo de **Cliente** só aparece quando o `lifecycle` é Cliente.

## 11. Página Tarefas: galeria de funis e workflow

Serve para **ver os funis de cima, do começo ao fim**, e o que a equipe precisa cumprir em cada etapa.

**Galeria.** Um **card por pipeline**. Cada card mostra o nome e a oferta, uma **miniatura do workflow** (fontes, etapas em sequência e as tarefas de cada uma), a **contagem** de registros no funil, de tarefas abertas, atrasadas e de registros **bloqueados**, e avisos (por exemplo, "sem fonte"). Filtros por tag e busca por nome.

**Página do workflow** (ao abrir o card). O funil desenhado da esquerda para a direita:

- **Fontes** (formulários conectados, manual, importação) entram pela esquerda.
- Cada **etapa** é um nó, na ordem: colunas de leads, etapas abertas, e Ganho e Perdido no fim.
- Dentro de cada nó, os **requisitos de etapa**: cada tarefa com tag, responsável e prazo, e um **cadeado** quando ela **impede entrar** ou **impede sair** (ex.: "Informar CNPJ" na Assinatura do contrato).
- Cada nó e cada tarefa mostram **quantos registros** estão ali e **quantos estão parados** por causa dela.
- Selecionar uma tarefa abre a configuração do requisito; dá para criar, editar e reordenar sem sair da página.
- Selecionar um **registro** (lead ou oportunidade) destaca o **caminho dele**: o que já foi feito e o que falta em cada etapa.

Implementação prevista com **React Flow** (`@xyflow/react`, licença MIT), com o layout calculado pela ordem das etapas.

## 12. Migração dos dados atuais (sem executar)

Hoje há 4 registros: 2 em Entrada, 1 em Qualificação, 1 Ganho.
- As 2 de **Entrada** viram **leads** na coluna "Novos" de uma pipeline padrão (o teste "Nova Oportunidade", sem contato, é descartado).
- Qualificação e Ganho seguem como oportunidades nessa pipeline.
- `value` passa de `Float` para `Decimal`.
- Detalhes em [plano-schema.md](./plano-schema.md).

## 13. Pontos abertos

**Nenhum ponto de domínio em aberto.** Confirmado em 27/09/2026:

1. As colunas de leads são as etapas do tipo Lead da pipeline (padrão "Novos" e "Em contato").
2. A página Tarefas é uma galeria de funis em cards; cada um abre a página do workflow.
3. A empresa sem CNPJ é impedida **ao chegar à Assinatura do contrato**.
4. Um formulário alimenta uma só pipeline; uma pipeline tem várias fontes.
5. Os concorrentes de referência são todos os CRMs consultados.

A decisão de **interface** também está fechada (27/09/2026): a ficha da oportunidade abre como **painel lateral ou popup central, à escolha de cada pessoa**, em "Configurar visualização", que também define o tamanho da fonte e as colunas da Lista.
