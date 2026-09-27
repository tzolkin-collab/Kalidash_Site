import { createStore } from '../lib/store';
import type { Pipeline, Requirement, Stage, Step } from '../domain';
import { stepsFromTemplate } from '../lib/pipelineTemplate';
import { TEMPLATE_IDS, templatesStore } from './templates';

// Dados de exemplo (fase 1 e 4 do plano). Ver docs/dominio.md §3, §8 e §11.

const stages = (p: string): Stage[] => [
  { id: `${p}:novos`, name: 'Novos', kind: 'LEAD', color: '#94a3b8' },
  { id: `${p}:contato`, name: 'Em contato', kind: 'LEAD', color: '#64748b' },
  { id: `${p}:qualificacao`, name: 'Qualificação', kind: 'OPEN', color: '#f59e0b', probability: 20, alertDays: 7 },
  { id: `${p}:proposta`, name: 'Proposta', kind: 'OPEN', color: '#8b5cf6', probability: 40, alertDays: 7 },
  { id: `${p}:negociacao`, name: 'Negociação', kind: 'OPEN', color: '#3b82f6', probability: 60, alertDays: 10 },
  { id: `${p}:assinatura`, name: 'Assinatura do contrato', kind: 'OPEN', color: '#0ea5e9', probability: 90, alertDays: 5 },
  { id: `${p}:ganho`, name: 'Ganho', kind: 'WON', color: '#10b981' },
  { id: `${p}:perdido`, name: 'Perdido', kind: 'LOST', color: '#ef4444' },
];

/** Template padrão de requisitos: todo funil nasce com estes dois. */
const baseRequirements = (p: string): Requirement[] => [
  { id: `${p}:r-fonte`, stageId: `${p}:novos`, label: 'Definir fonte da pipeline', tag: 'Configuração', kind: 'ACTION', gate: 'NONE', assignee: 'Carol Sales', blocked: 0, overdue: 0 },
  { id: `${p}:r-cnpj`, stageId: `${p}:assinatura`, label: 'Informar CNPJ', tag: 'Dados da empresa', kind: 'FIELD', gate: 'ENTER', assignee: 'Vendedor responsável', blocked: 0, overdue: 0 },
];

/** Passos da pipeline: cópia do template de venda e, se houver, do de pós-venda. */
const stepsFor = (list: Stage[], sale: string, post?: string): Step[] => {
  const find = (id: string) => templatesStore.get().find((t) => t.id === id)!;
  return [...stepsFromTemplate(find(sale), list), ...(post ? stepsFromTemplate(find(post), list) : [])];
};

const q4 = 'q4';
const b2b = 'b2b';
const exp = 'exp26';

export const pipelinesStore = createStore<Pipeline[]>([
  {
    id: q4,
    name: 'Q4 Sales Pipeline',
    offer: 'Consultoria de vendas',
    stages: stages(q4),
    sources: [
      { id: 's-q4-lp', name: 'Formulário da LP Consultoria', type: 'FORM', project: 'LP Consultoria', formId: 'lp-consultoria:principal', active: true },
      { id: 's-q4-man', name: 'Cadastro manual', type: 'MANUAL', active: true },
    ],
    requirements: [
      ...baseRequirements(q4),
      { id: `${q4}:r-contato`, stageId: `${q4}:contato`, label: 'Registrar o primeiro contato', tag: 'Comercial', kind: 'ACTION', gate: 'EXIT', assignee: 'Vendedor responsável', dueDays: 2, blocked: 1, overdue: 1 },
      { id: `${q4}:r-dados`, stageId: `${q4}:qualificacao`, label: 'Completar dados do cliente', tag: 'Dados do cliente', kind: 'FIELD', gate: 'NONE', assignee: 'Vendedor responsável', dueDays: 3, blocked: 0, overdue: 0 },
      { id: `${q4}:r-proposta`, stageId: `${q4}:proposta`, label: 'Enviar a proposta', tag: 'Comercial', kind: 'ACTION', gate: 'EXIT', assignee: 'Marina Alves', dueDays: 5, blocked: 2, overdue: 1 },
      { id: `${q4}:r-empresa`, stageId: `${q4}:assinatura`, label: 'Coletar dados da empresa', tag: 'Dados da empresa', kind: 'FIELD', gate: 'NONE', assignee: 'Diego Costa', dueDays: 3, blocked: 0, overdue: 0 },
    ],
    counts: { [`${q4}:novos`]: 3, [`${q4}:contato`]: 2, [`${q4}:qualificacao`]: 5, [`${q4}:proposta`]: 3, [`${q4}:negociacao`]: 2, [`${q4}:assinatura`]: 1, [`${q4}:ganho`]: 6, [`${q4}:perdido`]: 2 },
    values: { [`${q4}:qualificacao`]: 38000, [`${q4}:proposta`]: 54000, [`${q4}:negociacao`]: 41000, [`${q4}:assinatura`]: 15000, [`${q4}:ganho`]: 96000 },
    customFields: [
      { id: 'cf1', key: 'data_prevista', label: 'Data prevista de fechamento', type: 'date' },
      { id: 'cf2', key: 'origem_campanha', label: 'Campanha de origem', type: 'text' },
      { id: 'cf3', key: 'numero_de_vagas', label: 'Número de vagas', type: 'number' },
    ],
    taskTags: ['Dados do cliente', 'Dados da empresa', 'Comercial', 'Configuração', 'Pós-venda'],
    qualifyRequires: ['value'],
    templateId: TEMPLATE_IDS.consultiva,
    postSaleTemplateId: TEMPLATE_IDS.posVenda,
    steps: stepsFor(stages(q4), TEMPLATE_IDS.consultiva, TEMPLATE_IDS.posVenda),
  },
  {
    id: b2b,
    name: 'Parcerias B2B',
    offer: 'Programa de parcerias',
    stages: stages(b2b),
    sources: [
      { id: 's-b2b-man', name: 'Cadastro manual', type: 'MANUAL', active: true },
      { id: 's-b2b-imp', name: 'Importação de planilha', type: 'IMPORT', active: true },
    ],
    requirements: [
      ...baseRequirements(b2b),
      { id: `${b2b}:r-nda`, stageId: `${b2b}:negociacao`, label: 'Assinar o NDA', tag: 'Jurídico', kind: 'ACTION', gate: 'EXIT', assignee: 'Marina Alves', dueDays: 7, blocked: 1, overdue: 0 },
    ],
    counts: { [`${b2b}:novos`]: 2, [`${b2b}:contato`]: 1, [`${b2b}:qualificacao`]: 2, [`${b2b}:proposta`]: 1, [`${b2b}:negociacao`]: 1, [`${b2b}:assinatura`]: 0, [`${b2b}:ganho`]: 3, [`${b2b}:perdido`]: 1 },
    values: { [`${b2b}:qualificacao`]: 12000, [`${b2b}:proposta`]: 9000, [`${b2b}:negociacao`]: 30000, [`${b2b}:ganho`]: 47000 },
    customFields: [{ id: 'cf4', key: 'tipo_de_parceria', label: 'Tipo de parceria', type: 'select', options: ['Indicação', 'Revenda', 'Co-marketing'] }],
    taskTags: ['Dados da empresa', 'Jurídico', 'Comercial', 'Configuração'],
    qualifyRequires: [],
    templateId: TEMPLATE_IDS.parcerias,
    steps: stepsFor(stages(b2b), TEMPLATE_IDS.parcerias),
  },
  {
    id: exp,
    name: 'Expansão 2026',
    offer: 'Expansão de contas atuais',
    stages: stages(exp),
    sources: [],
    requirements: baseRequirements(exp),
    counts: { [`${exp}:novos`]: 1, [`${exp}:contato`]: 0, [`${exp}:qualificacao`]: 1, [`${exp}:proposta`]: 0, [`${exp}:negociacao`]: 0, [`${exp}:assinatura`]: 0, [`${exp}:ganho`]: 0, [`${exp}:perdido`]: 0 },
    values: { [`${exp}:qualificacao`]: 22000 },
    customFields: [],
    taskTags: ['Dados do cliente', 'Comercial', 'Configuração'],
    qualifyRequires: [],
    templateId: TEMPLATE_IDS.inbound,
    steps: stepsFor(stages(exp), TEMPLATE_IDS.inbound),
  },
]);

export const pipelineById = (list: Pipeline[], id: string | undefined) => list.find((p) => p.id === id);

export const stageOf = (p: Pipeline, stageId: string) => p.stages.find((s) => s.id === stageId);
