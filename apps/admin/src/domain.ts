// Tipos do domínio do CRM (ver docs/dominio.md e docs/plano-schema.md).
// As telas que ainda não têm API usam dados de exemplo desses tipos (src/mocks).

export type StageKind = 'LEAD' | 'OPEN' | 'WON' | 'LOST';

export type Stage = {
  id: string;
  name: string;
  kind: StageKind;
  color: string;
  probability?: number;
  /** Dias parado na etapa até o alerta. */
  alertDays?: number;
};

export type SourceType = 'FORM' | 'MANUAL' | 'IMPORT' | 'API';

export type Source = {
  id: string;
  name: string;
  type: SourceType;
  /** Projeto conectado de onde vem o formulário. */
  project?: string;
  /** Formulário rastreado que alimenta esta fonte (um formulário alimenta uma só pipeline). */
  formId?: string;
  active: boolean;
};

export type RequirementKind = 'FIELD' | 'ACTION';
/** NONE: só pendência. ENTER: impede entrar na etapa. EXIT: impede sair dela. */
export type RequirementGate = 'NONE' | 'ENTER' | 'EXIT';

export type Requirement = {
  id: string;
  stageId: string;
  label: string;
  tag: string;
  kind: RequirementKind;
  gate: RequirementGate;
  assignee?: string;
  dueDays?: number;
  /** Registros parados por causa deste requisito. */
  blocked: number;
  /** Tarefas deste requisito que passaram do prazo. */
  overdue: number;
  /** Caminho simples (D9): notifica o responsável por push quando a tarefa nasce. */
  notifyAssignee?: boolean;
  /** Caminho avançado (D9): id da automação criada a partir desta tarefa, se houver. */
  linkedAutomationId?: string;
};

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean';

export type CustomField = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
};

export type Pipeline = {
  id: string;
  name: string;
  offer: string;
  stages: Stage[];
  sources: Source[];
  requirements: Requirement[];
  /** Quantidade de registros (leads e oportunidades) por etapa. */
  counts: Record<string, number>;
  /** Soma de valor por etapa (leads não entram). */
  values: Record<string, number>;
  customFields: CustomField[];
  taskTags: string[];
  /** O que o Qualificar precisa perguntar na hora (D5). */
  qualifyRequires: ('value' | 'owner')[];
  /** Template de venda de que esta pipeline foi copiada, e o de pós-venda encadeado ao ganho. */
  templateId?: string;
  postSaleTemplateId?: string;
  /** Passos do ciclo de vida: cópia editável do template. É o que roda. */
  steps: Step[];
  archivedAt?: string;
};

export type StepAction = {
  id: string;
  actionId: string;
  /** Texto livre da ação (ex.: "Informar CNPJ|Dados da empresa" para criar tarefa). */
  detail: string;
  delayDays: number;
};

export type StepPhase = 'sale' | 'post-sale';

/** Um passo liga um evento a ações. Sem ramificação: condição simples e lista de ações. */
export type Step = {
  id: string;
  /** Identifica o passo no template de origem, para comparar depois. */
  key: string;
  phase: StepPhase;
  name: string;
  triggerId: string;
  /** Condição: só vale para esta etapa. */
  stageId?: string;
  /** Condição: só vale para este campo (evento campo.mudou e empresa.criada). */
  fieldKey?: string;
  onlyIfEmpty?: boolean;
  actions: StepAction[];
  enabled: boolean;
};

export type TemplateStep = Omit<Step, 'stageId'> & { stageName?: string };

export type LifecycleTemplate = {
  id: string;
  name: string;
  description: string;
  kind: 'SALE' | 'POST_SALE';
  builtIn: boolean;
  version: number;
  stages: { name: string; kind: StageKind; color: string }[];
  requirements: { label: string; tag: string; kind: RequirementKind; gate: RequirementGate; stageName: string; assignee?: string; dueDays?: number }[];
  steps: TemplateStep[];
};

/** INACTIVE: perdeu, descartou ou foi marcado à mão. Só avança sozinho: Lead, Em negociação, Cliente. */
export type Lifecycle = 'LEAD' | 'PROSPECT' | 'CLIENT' | 'INACTIVE';

export type ContactPoint = { value: string; label: string };

export type Stakeholder = { personId: string; description: string; tag: string };

export type EntityKind = 'lead' | 'person' | 'company' | 'opportunity' | 'pipeline';

export type TaskItem = {
  id: string;
  entity: EntityKind;
  entityId: string;
  entityName: string;
  title: string;
  tag: string;
  assignee?: string;
  dueAt?: string;
  done: boolean;
  doneAt?: string;
  source: 'manual' | 'passo' | 'requisito';
  /** Nas nascidas de um requisito: liga de volta pra ele, para checar o gate. */
  requirementId?: string;
  createdAt: string;
};

export type ChangeKind = 'create' | 'edit' | 'archive' | 'restore' | 'reveal' | 'lifecycle' | 'event' | 'qualify' | 'discard';

export type ChangeEntry = {
  id: string;
  at: string;
  actor: string;
  entity: EntityKind;
  entityId: string;
  entityName: string;
  kind: ChangeKind;
  field?: string;
  from?: string;
  to?: string;
  note?: string;
};

export type Person = {
  id: string;
  name: string;
  /** E-mail e telefone principais; os demais ficam em extraEmails e extraPhones. */
  email: string;
  phone: string;
  extraEmails: ContactPoint[];
  extraPhones: ContactPoint[];
  /** CPF. Sensível: aparece mascarado e só quem tem permissão revela. */
  document?: string;
  /** Cargo. As empresas da pessoa vêm dos stakeholders de cada empresa. */
  role?: string;
  tags: string[];
  lifecycle: Lifecycle;
  /** Cliente de antes do sistema, marcado à mão. */
  legacyClient?: boolean;
  inactiveReason?: string;
  firstWonAt?: string;
  lgpdBasis?: string;
  lgpdAt?: string;
  customData?: Record<string, unknown>;
  archivedAt?: string;
  createdAt: string;
};

export type Company = {
  id: string;
  name: string;
  legalName?: string;
  /** CNPJ (alfanumérico desde 31/07/2026). Sem ele a empresa fica "em análise". */
  document?: string;
  status: 'ACTIVE' | 'REVIEW';
  defaultContactId?: string;
  /** Campo de relação: todas as pessoas cadastradas nesta empresa. */
  stakeholders: Stakeholder[];
  lifecycle: Lifecycle;
  segment: string;
  sizeRange?: string;
  website?: string;
  city?: string;
  state?: string;
  legacyClient?: boolean;
  inactiveReason?: string;
  firstWonAt?: string;
  customData?: Record<string, unknown>;
  archivedAt?: string;
  createdAt: string;
};

export type LeadOrigin = 'INBOUND' | 'OUTBOUND';

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  personId?: string;
  companyId?: string;
  pipelineId: string;
  stageId: string;
  origin: LeadOrigin;
  /** Inbound: nome da fonte. Outbound: quem da equipe trouxe. */
  sourceName: string;
  owner?: string;
  estimatedValue?: number;
  expectedCloseAt?: string;
  tags: string[];
  message?: string;
  status: 'ACTIVE' | 'QUALIFIED' | 'DISCARDED';
  discardReason?: string;
  /** Alguém já abriu este lead. */
  wasSeen: boolean;
  firstContactAt?: string;
  convertedOpportunityId?: string;
  /** Cliente que preencheu de novo. */
  returningClient?: boolean;
  customData?: Record<string, unknown>;
  archivedAt?: string;
  createdAt: string;
};

export type AutomationCategory = 'Fontes' | 'Cadastros' | 'Leads' | 'Oportunidades' | 'Pendências' | 'Ciclo de vida' | 'Notificações' | 'E-mails';

export type Automation = {
  id: string;
  name: string;
  category: AutomationCategory;
  trigger: string;
  action: string;
  origin: 'MANUAL' | 'MANAGED';
  /** Para as gerenciadas: o que as criou (ex.: "Conectar fonte: LP Consultoria"). */
  managedBy?: string;
  active: boolean;
  lastRun?: string;
  runs: number;
};

export type ConnectedForm = {
  id: string;
  name: string;
  selector: string;
  fields: number;
  views: number;
  submissions: number;
};

export type ConnectedProject = {
  id: string;
  name: string;
  url: string;
  description: string;
  stack: string;
  modules: { name: 'Formulário' | 'Analytics' | 'Ads'; status: 'ACTIVE' | 'PENDING' | 'ERROR' }[];
  forms: ConnectedForm[];
  visits: number;
  submissions: number;
  topOrigin: string;
};

export type ApiKeyScope = 'forms:write' | 'analytics:write' | 'ads:read' | 'leads:read';

export type ApiKey = {
  id: string;
  name: string;
  env: 'live' | 'test';
  /** Só o prefixo fica visível depois da emissão. */
  prefix: string;
  project: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  lastUsedAt?: string;
  status: 'ACTIVE' | 'REVOKED';
};

/** Artigo do blog: espelha o struct Article do Go (apps/api/blog.go), que é quem manda de
 * verdade — Sem Sanity, sem status/agendamento (não existia de fato). Só rascunho ou publicado. */
export type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  /** Documento nativo do BlockNote (JSON), fonte de verdade do editor — `body` (HTML) é só o
   * export pro site consumir. Ausente nos artigos migrados do mock antigo (nunca passaram pelo
   * BlockNote); o editor detecta e abre o `body` como HTML puro nesse caso. */
  bodyJson?: string;
  coverImageUrl?: string;
  /** 0–100: posição vertical da capa (object-position), tipo "onde centralizar o recorte". */
  coverImagePos: number;
  /** Post de destaque: ocupa o bloco grande na lista do site. */
  featured: boolean;
  published: boolean;
  authorName: string;
  categories: string[];
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type Role = 'ADMIN' | 'MANAGER' | 'SELLER';

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
  lastAccess?: string;
};

export type Webhook = {
  id: string;
  name: string;
  event: string;
  url: string;
  active: boolean;
  lastStatus?: 'OK' | 'FAILED';
  lastAt?: string;
};

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
};

export type EmailLogEntry = {
  id: string;
  at: string;
  to: string;
  subject: string;
  template: string;
  context: string;
  status: 'SENT' | 'FAILED' | 'QUEUED';
};
