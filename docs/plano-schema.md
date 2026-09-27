# 🗄️ Plano de schema e de migração

> **Status: rascunho (atualizado em 27/09/2026). Não foi aplicado.** Traduz a [definição de domínio v2](./dominio.md) para o Prisma (`apps/studio/prisma/schema.prisma`) e para a API em Go.
> Os blocos abaixo são um **desenho**, com os campos que importam. O schema final é fechado na implementação.

---

## 1. Enums

```prisma
enum StageType      { LEAD OPEN WON LOST }
enum Origin         { INBOUND OUTBOUND }
enum SourceType     { FORM MANUAL IMPORT }
enum LeadState      { OPEN CONVERTED DISCARDED }
enum Lifecycle      { LEAD OPPORTUNITY CUSTOMER INACTIVE }
enum Registration   { IN_REVIEW COMPLETE }          // Empresa sem CNPJ = IN_REVIEW
enum TaskStatus     { PENDING DONE DISMISSED }
enum TaskOrigin     { MANUAL RULE SYSTEM }
enum EntityKind     { CONTACT COMPANY LEAD OPPORTUNITY }
enum CustomFieldType{ TEXT NUMBER DATE SELECT MULTISELECT BOOLEAN LINK }
enum TagKind        { CONTACT_ROLE LEAD TASK }
enum RequirementKind{ FIELD ACTION }             // campo marcado como tarefa | tarefa avulsa
enum Gate           { NONE ENTER EXIT }          // impede entrar na etapa | impede sair dela
enum StartAt        { CREATION ENTER_STAGE }     // quando a tarefa nasce
```

## 2. Pipeline, etapas e fontes (novas)

```prisma
model Pipeline {          // um funil = uma oferta
  id          String @id @default(uuid())
  name        String
  offerName   String?
  isActive    Boolean @default(true)
  position    Int
  stages      Stage[]
  sources     PipelineSource[]
  requirements StageRequirement[]
}

model Stage {
  id           String @id @default(uuid())
  pipelineId   String
  name         String
  type         StageType            // LEAD = coluna de leads (só com "Ver leads")
  position     Int
  color        String?
  probability  Int?                 // % (padrão da etapa)
  staleDays    Int?                 // alerta de parado
  @@index([pipelineId, position])
}

model Source {
  id         String @id @default(uuid())
  type       SourceType             // FORM | MANUAL | IMPORT
  name       String
  formId     String?  @unique       // formulário rastreado (Projeto conectado): 1 formulário -> 1 pipeline
  automationId String? @unique      // automação gerenciada criada por "Conectar fonte"
}

model PipelineSource {    // uma pipeline tem várias fontes
  pipelineId String
  sourceId   String
  @@id([pipelineId, sourceId])
}
```

## 3. Lead (novo)

```prisma
model Lead {
  id              String @id @default(uuid())
  pipelineId      String
  stageId         String                  // etapa do tipo LEAD
  title           String
  state           LeadState @default(OPEN)
  origin          Origin
  sourceId        String?                 // inbound: obrigatório
  broughtById     String?                 // outbound: User (contato interno) obrigatório
  contactId       String
  companyId       String?
  ownerId         String?
  estimatedValue  Decimal? @db.Decimal(12,2)
  expectedCloseAt DateTime?
  discardReason   String?
  wasSeen         Boolean @default(false)
  firstContactAt  DateTime?               // deriva "tempo até o 1º contato"
  convertedOppId  String?  @unique
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@index([pipelineId, stageId, state])
  // Regra (validada na API): (origin=INBOUND e sourceId) OU (origin=OUTBOUND e broughtById)
}

model LeadSubmission {    // registro bruto de cada envio
  id         String @id @default(uuid())
  leadId     String?
  sourceId   String
  payload    Json
  utm        Json?
  pageUrl    String?
  ipHash     String?
  createdAt  DateTime @default(now())
}
```

## 4. Pessoa e Empresa (mudam)

```prisma
model Contact {           // + campos
  // já existe: id, name, avatarUrl, companyId
  document        String?   // CPF, criptografado (AES-256-GCM)
  documentHash    String?   @unique   // HMAC do CPF, só para achar duplicado
  jobTitle        String?
  lifecycle       Lifecycle @default(LEAD)
  firstSourceId   String?
  firstUtm        Json?
  lgpdBasis       String?
  lgpdAt          DateTime?
  customData      Json?
  emails          ContactEmail[]
  phones          ContactPhone[]
}
model ContactEmail { id String @id @default(uuid()) contactId String value String label String? isPrimary Boolean @default(false) @@index([value]) }
model ContactPhone { id String @id @default(uuid()) contactId String value String label String? isPrimary Boolean @default(false) isWhatsapp Boolean @default(false) }

model Company {           // + campos
  // já existe: id, name, logoUrl, website
  cnpj          String?  @unique @db.VarChar(14)   // alfanumérico (A-Z, 0-9); os 2 últimos são dígitos verificadores
  legalName     String?
  registration  Registration @default(IN_REVIEW)  // COMPLETE quando houver CNPJ
  industry      String?
  sizeRange     String?
  city          String?
  state         String? @db.VarChar(2)
  zip           String?
  lifecycle     Lifecycle @default(LEAD)
  firstSourceId String?
  customData    Json?
}
```

## 5. Oportunidade e stakeholders (mudam)

```prisma
model Opportunity {       // + campos; "stage" (texto) sai depois da migração
  pipelineId       String
  stageId          String            // etapa OPEN, WON ou LOST
  value            Decimal @db.Decimal(12,2)   // era Float
  origin           Origin
  sourceId         String?
  leadId           String?
  expectedCloseAt  DateTime?
  enteredStageAt   DateTime @default(now())    // deriva "tempo na etapa"
  closedAt         DateTime?
  lostReasonId     String?
  customData       Json?
  contacts         OpportunityContact[]
  // companyId (opcional) e contactId (legado) continuam; "alvo" = empresa OU pessoa
  @@index([pipelineId, stageId, createdAt])
}

model OpportunityContact {   // stakeholders
  opportunityId String
  contactId     String
  isDefault     Boolean @default(false)   // contato padrão (no máximo um por oportunidade)
  description   String?
  tags          Tag[]                     // TagKind.CONTACT_ROLE, criadas pelo time
  @@id([opportunityId, contactId])
}

model Tag { id String @id @default(uuid()) kind TagKind name String color String? @@unique([kind, name]) }
model LostReason { id String @id @default(uuid()) name String isActive Boolean @default(true) }
```

## 6. Tarefas, requisitos de etapa e campos personalizados (novos)

```prisma
model Task {
  id            String @id @default(uuid())
  title         String
  status        TaskStatus @default(PENDING)
  origin        TaskOrigin
  pipelineId    String?
  stageId       String?
  leadId        String?
  opportunityId String?
  contactId     String?
  companyId     String?
  assigneeId    String?
  dueAt         DateTime?
  doneAt        DateTime?
  fieldEntity   EntityKind?     // nas tarefas de dado faltante:
  fieldKey      String?         //   qual campo (do sistema ou personalizado) falta
  requirementId String?         // requisito de etapa que gerou a tarefa
  tags          Tag[]           // TagKind.TASK; toda tarefa tem ao menos uma
  @@index([pipelineId, status, dueAt])
}

model StageRequirement {        // o que a etapa exige; é o que o workflow desenha
  id            String @id @default(uuid())
  pipelineId    String
  stageId       String                 // nó em que aparece
  kind          RequirementKind        // FIELD = campo de cadastro marcado como tarefa; ACTION = tarefa avulsa
  title         String
  entity        EntityKind?            // FIELD: entidade do campo
  fieldKey      String?                // FIELD: campo do sistema (ex.: "company.cnpj") ou id de CustomField
  startAt       StartAt @default(ENTER_STAGE)   // ex.: "Informar CNPJ" nasce na criação (CREATION)
  gate          Gate    @default(NONE)          // ex.: "Informar CNPJ" impede ENTRAR em "Assinatura do contrato"
  tagId         String
  assigneeId    String?
  dueOffsetDays Int?
  position      Int                    // ordem dentro do nó
  automationId  String? @unique
  @@index([pipelineId, stageId, position])
}

model CustomField {
  id       String @id @default(uuid())
  entity   EntityKind
  key      String
  label    String
  type     CustomFieldType
  options  Json?
  @@unique([entity, key])
}
```

## 7. Automações e e-mails (novos)

```prisma
model Automation {
  id         String @id @default(uuid())
  name       String
  category   String                  // Fontes, Leads, Oportunidades, Pendências, Notificações, E-mails...
  trigger    Json                    // evento + filtros (ex.: formulario.enviado)
  actions    Json                    // lista de ações
  isEnabled  Boolean @default(true)
  managedBy  String?                 // "SOURCE" | "REQUIREMENT" | null (manual)
  managedRef String?                 // id da Source ou do StageRequirement que a gerou
  createdAt  DateTime @default(now())
}
model AutomationRun { id String @id @default(uuid()) automationId String status String error String? createdAt DateTime @default(now()) }

model EmailTemplate { id String @id @default(uuid()) name String subject String design Json html String? updatedAt DateTime @updatedAt }
```

**Regra das automações gerenciadas:** "Conectar fonte" e "Marcar como tarefa" (requisito de etapa) gravam uma `Automation` com `managedBy` e `managedRef`. Há uma só fonte da verdade: editar no assistente ou na página Automações altera o mesmo registro; apagar a fonte ou a regra apaga a automação.

## 8. Migração dos dados (passo a passo)

0. **Backup** do banco antes de qualquer coisa, e adotar `prisma migrate` (hoje o schema é aplicado sem migrations versionadas).
1. Criar as tabelas novas e as colunas novas como **opcionais** (nada é apagado).
2. **Seed:** pipeline "Pipeline padrão" com as etapas Novos e Em contato (Lead); Qualificação, Proposta, Negociação e **Assinatura do contrato** (Aberta); Ganho (Ganha) e Perdido (Perdida); motivos de perda padrão; tags padrão; template de requisitos ("Informar CNPJ", que nasce no cadastro da empresa e **impede entrar em Assinatura do contrato**, e "Definir fonte da pipeline").
3. **Converter os 4 registros:** as 2 em `INBOUND` viram `Lead` em "Novos" (a "Nova Oportunidade" de teste, sem contato, é descartada); `QUALIFICATION` vai para "Qualificação"; `WON` para "Ganho". `value` passa a `Decimal`. `enteredStageAt` recebe `updatedAt`.
4. Trocar a API e as telas para `pipelineId` e `stageId`. Manter a coluna `stage` até validar, e só então removê-la.

## 9. Impacto na API (Go)

- **Renomear:** `/api/leads` hoje serve oportunidades. Passa a ser `/api/opportunities`; `/api/leads` vira o de leads de verdade.
- **Novas rotas:** pipelines e etapas, fontes, leads (listar, criar manual, qualificar, descartar), pessoas e empresas (com **deduplicação** por e-mail, CPF e CNPJ), tarefas, requisitos de etapa, o **workflow da pipeline** (etapas, requisitos e contagem de registros e de bloqueados por nó), tags, campos personalizados, automações e suas execuções, templates de e-mail.
- **Paginação e contagem:** `?page=&pageSize=` devolvendo `items` e `total`; um resumo por pipeline com **quantidade e soma de valor por etapa** (os leads ficam fora da soma). É o que alimenta as colunas do Kanban e a lista.
- **Validação no servidor** de tudo que é regra: origem obrigatória do lead, CNPJ alfanumérico e CPF, contato padrão único, e o **bloqueio de etapa** (entrar ou sair) pelos requisitos, também em importação e API.
- **Eventos internos** (`lead.criado`, `oportunidade.mudou_de_etapa`, `tarefa.concluida`, `formulario.enviado`…) para as automações.

## 10. Ordem de implementação

| Fase | Entrega | Depende de |
|---|---|---|
| **0** | Consertar a edição no popup (título e valor) e decidir modal ou painel lateral. | — |
| **1** | Schema base, seed, API de pipelines, etapas e oportunidades com paginação e contagem. Some o funil escrito no código. | 0 |
| **2** | Pessoas e Empresas: documento, CNPJ alfanumérico, "em análise", tags, stakeholders. Páginas Pessoas & Empresas e Clientes. | 1 |
| **3** | Leads: registro, página Leads, **Ver leads** no Kanban e na Lista, qualificar (botão e arrastar), fontes. | 2 |
| **4** | Tarefas: requisitos de etapa e template por pipeline, "marcar como tarefa", campos personalizados, a galeria de funis e a **página do workflow** (React Flow). | 3 |
| **5** | Automações: eventos, catálogo, gerenciadas; **Conectar fonte**; ligação do `connect.js`. | 4 |
| **6** | E-mails: templates no banco, envio a partir do popup. | 1 |

Segurança (autenticação, CORS, porta do banco) fica por último, como combinado.

## 11. Riscos

- **Escopo grande:** são 12 tabelas novas e 3 alteradas. As fases permitem parar em qualquer ponto com algo que funciona.
- **Campos personalizados:** na v1 os valores ficam em `customData` (JSON) por entidade, o que é simples mas limita filtro e relatório. Se virar gargalo, passam para tabela própria.
- **Barramento de eventos:** a fase 5 exige um mecanismo de eventos e execução assíncrona. No Go dá para começar com canais e Goroutines, sem fila externa, e trocar depois se preciso.
- **Go com SQL cru:** cada mudança de schema exige atualizar as queries de `apps/api/main.go`.
