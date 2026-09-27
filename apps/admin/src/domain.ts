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
};

export type Lifecycle = 'LEAD' | 'PROSPECT' | 'CLIENT';

export type Person = {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** CPF. */
  document?: string;
  companyId?: string;
  role?: string;
  tags: string[];
  lifecycle: Lifecycle;
  createdAt: string;
};

export type Company = {
  id: string;
  name: string;
  /** CNPJ (alfanumérico desde 31/07/2026). Sem ele a empresa fica "em análise". */
  document?: string;
  status: 'ACTIVE' | 'REVIEW';
  defaultContactId?: string;
  stakeholders: { personId: string; description: string; tag: string }[];
  lifecycle: Lifecycle;
  segment: string;
  createdAt: string;
};

export type LeadOrigin = 'INBOUND' | 'OUTBOUND';

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  pipelineId: string;
  stageId: string;
  origin: LeadOrigin;
  /** Inbound: nome da fonte. Outbound: quem da equipe trouxe. */
  sourceName: string;
  tags: string[];
  message?: string;
  status: 'ACTIVE' | 'QUALIFIED' | 'DISCARDED';
  createdAt: string;
};

export type AutomationCategory = 'Fontes' | 'Leads' | 'Oportunidades' | 'Pendências' | 'Notificações' | 'E-mails';

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

export type PostStatus = 'PUBLISHED' | 'DRAFT' | 'SCHEDULED';

export type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  tags: string[];
  status: PostStatus;
  author: string;
  updatedAt: string;
  publishAt?: string;
  seoTitle?: string;
  seoDescription?: string;
};

export type Role = 'ADMIN' | 'MANAGER' | 'SELLER';

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'INVITED';
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
