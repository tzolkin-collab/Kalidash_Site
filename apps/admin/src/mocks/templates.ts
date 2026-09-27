import { createStore, newId } from '../lib/store';
import type { LifecycleTemplate, StepAction, StepPhase, TemplateStep } from '../domain';

// Templates prontos de ciclo de vida (docs/benchmark-ciclo-de-vida.md §4). Cada um é uma receita:
// etapas, requisitos e passos. A pipeline recebe uma CÓPIA; editar a cópia não muda o template.

const act = (actionId: string, detail: string, delayDays = 0): StepAction => ({ id: newId('sa'), actionId, detail, delayDays });

const step = (key: string, phase: StepPhase, name: string, triggerId: string, actions: StepAction[], extra: Partial<TemplateStep> = {}): TemplateStep => ({
  id: `tplstep-${key}`, key, phase, name, triggerId, actions, enabled: true, ...extra,
});

const S = {
  leadCriado: () => step('lead-criado', 'sale', 'Lead entra no funil', 'lead.criado', [act('ciclo.definir', 'LEAD'), act('notificar.equipe', 'Responsável pela pipeline'), act('email.enviar', 'Modelo: Boas-vindas (Inbound)')]),
  semCnpj: () => step('empresa-sem-cnpj', 'sale', 'Empresa sem CNPJ vira tarefa', 'empresa.criada', [act('tarefa.criar', 'Informar CNPJ|Dados da empresa', 3)], { fieldKey: 'cnpj', onlyIfEmpty: true }),
  cnpjInformado: () => step('cnpj-informado', 'sale', 'CNPJ informado conclui a tarefa', 'campo.mudou', [act('tarefa.concluir', 'Informar CNPJ')], { fieldKey: 'cnpj' }),
  qualificado: () => step('lead-qualificado', 'sale', 'Lead qualificado vira oportunidade', 'lead.qualificado', [act('ciclo.definir', 'PROSPECT')]),
  ganha: () => step('ganha', 'sale', 'Ganhou: vira cliente', 'oportunidade.ganha', [act('ciclo.definir', 'CLIENT')]),
  perdida: () => step('perdida', 'sale', 'Perdeu: fica inativo', 'oportunidade.perdida', [act('ciclo.definir', 'INACTIVE')]),
  descartado: () => step('descartado', 'sale', 'Lead descartado: fica inativo', 'lead.descartado', [act('ciclo.definir', 'INACTIVE')]),
  semContato: () => step('sem-contato', 'sale', 'Lead sem contato', 'lead.sem_contato', [act('notificar.equipe', 'Responsável do lead')]),
  parada: () => step('parada', 'sale', 'Oportunidade parada', 'oportunidade.parada', [act('notificar.equipe', 'Dono da oportunidade')]),
  followUp: () => step('proposta-followup', 'sale', 'Follow-up depois da proposta', 'oportunidade.mudou_de_etapa', [act('tarefa.criar', 'Follow-up da proposta|Comercial', 3)], { stageName: 'Proposta' }),
  nda: () => step('nda', 'sale', 'NDA ao negociar', 'oportunidade.mudou_de_etapa', [act('tarefa.criar', 'Assinar o NDA|Jurídico', 7)], { stageName: 'Negociação' }),
};

const DEFAULT_STAGES: LifecycleTemplate['stages'] = [
  { name: 'Novos', kind: 'LEAD', color: '#94a3b8' },
  { name: 'Em contato', kind: 'LEAD', color: '#64748b' },
  { name: 'Qualificação', kind: 'OPEN', color: '#f59e0b' },
  { name: 'Proposta', kind: 'OPEN', color: '#8b5cf6' },
  { name: 'Negociação', kind: 'OPEN', color: '#3b82f6' },
  { name: 'Assinatura do contrato', kind: 'OPEN', color: '#0ea5e9' },
  { name: 'Ganho', kind: 'WON', color: '#10b981' },
  { name: 'Perdido', kind: 'LOST', color: '#ef4444' },
];

export const TEMPLATE_IDS = { consultiva: 'tpl-consultiva', inbound: 'tpl-inbound', parcerias: 'tpl-parcerias', posVenda: 'tpl-posvenda' } as const;

export const templatesStore = createStore<LifecycleTemplate[]>([
  {
    id: TEMPLATE_IDS.consultiva, name: 'Venda consultiva B2B', kind: 'SALE', builtIn: true, version: 1,
    description: 'Ciclo completo para vender a empresas: qualificação, proposta, negociação e assinatura, com CNPJ exigido antes do contrato.',
    stages: DEFAULT_STAGES,
    requirements: [
      { label: 'Definir fonte da pipeline', tag: 'Configuração', kind: 'ACTION', gate: 'NONE', stageName: 'Novos', assignee: 'Carol Sales' },
      { label: 'Registrar o primeiro contato', tag: 'Comercial', kind: 'ACTION', gate: 'EXIT', stageName: 'Em contato', assignee: 'Vendedor responsável', dueDays: 2 },
      { label: 'Completar dados do cliente', tag: 'Dados do cliente', kind: 'FIELD', gate: 'NONE', stageName: 'Qualificação', assignee: 'Vendedor responsável', dueDays: 3 },
      { label: 'Enviar a proposta', tag: 'Comercial', kind: 'ACTION', gate: 'EXIT', stageName: 'Proposta', assignee: 'Marina Alves', dueDays: 5 },
      { label: 'Informar CNPJ', tag: 'Dados da empresa', kind: 'FIELD', gate: 'ENTER', stageName: 'Assinatura do contrato', assignee: 'Vendedor responsável' },
      { label: 'Coletar dados da empresa', tag: 'Dados da empresa', kind: 'FIELD', gate: 'NONE', stageName: 'Assinatura do contrato', assignee: 'Diego Costa', dueDays: 3 },
    ],
    steps: [S.leadCriado(), S.semContato(), S.semCnpj(), S.cnpjInformado(), S.qualificado(), S.followUp(), S.parada(), S.ganha(), S.perdida(), S.descartado()],
  },
  {
    id: TEMPLATE_IDS.inbound, name: 'Inbound rápido (B2C)', kind: 'SALE', builtIn: true, version: 1,
    description: 'Funil curto para vender a pessoas: sem CNPJ, com resposta rápida ao lead que chega por formulário.',
    stages: DEFAULT_STAGES,
    requirements: [
      { label: 'Definir fonte da pipeline', tag: 'Configuração', kind: 'ACTION', gate: 'NONE', stageName: 'Novos', assignee: 'Carol Sales' },
      { label: 'Informar CNPJ', tag: 'Dados da empresa', kind: 'FIELD', gate: 'ENTER', stageName: 'Assinatura do contrato', assignee: 'Vendedor responsável' },
    ],
    steps: [S.leadCriado(), S.semContato(), S.qualificado(), S.parada(), S.ganha(), S.perdida(), S.descartado()],
  },
  {
    id: TEMPLATE_IDS.parcerias, name: 'Parcerias', kind: 'SALE', builtIn: true, version: 1,
    description: 'Funil de parcerias, com NDA na negociação e CNPJ antes da assinatura.',
    stages: DEFAULT_STAGES,
    requirements: [
      { label: 'Definir fonte da pipeline', tag: 'Configuração', kind: 'ACTION', gate: 'NONE', stageName: 'Novos', assignee: 'Carol Sales' },
      { label: 'Assinar o NDA', tag: 'Jurídico', kind: 'ACTION', gate: 'EXIT', stageName: 'Negociação', assignee: 'Marina Alves', dueDays: 7 },
      { label: 'Informar CNPJ', tag: 'Dados da empresa', kind: 'FIELD', gate: 'ENTER', stageName: 'Assinatura do contrato', assignee: 'Vendedor responsável' },
    ],
    steps: [S.leadCriado(), S.semCnpj(), S.cnpjInformado(), S.qualificado(), S.nda(), S.ganha(), S.perdida(), S.descartado()],
  },
  {
    id: TEMPLATE_IDS.posVenda, name: 'Pós-venda e onboarding', kind: 'POST_SALE', builtIn: true, version: 1,
    description: 'Encadeado ao ganho: onboarding, check-ins de 30 e 90 dias e conversa de renovação.',
    stages: [],
    requirements: [],
    steps: [
      step('onboarding', 'post-sale', 'Onboarding do cliente', 'oportunidade.ganha', [act('tarefa.criar', 'Reunião de onboarding|Pós-venda', 2), act('email.enviar', 'Modelo: Boas-vindas ao cliente')]),
      step('checkins', 'post-sale', 'Check-ins e renovação', 'oportunidade.ganha', [act('tarefa.criar', 'Check-in de 30 dias|Pós-venda', 30), act('tarefa.criar', 'Check-in de 90 dias|Pós-venda', 90), act('tarefa.criar', 'Conversa de renovação|Pós-venda', 330)]),
    ],
  },
]);

export const templateById = (list: LifecycleTemplate[], id: string | undefined) => list.find((t) => t.id === id);
