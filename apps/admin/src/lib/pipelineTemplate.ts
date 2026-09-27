import type { Pipeline, Requirement, Stage, StageKind } from '../domain';
import { newId } from './store';

export type StageDraft = { key: string; name: string; kind: StageKind; color: string };

const COLORS: Record<StageKind, string> = { LEAD: '#94a3b8', OPEN: '#3b82f6', WON: '#10b981', LOST: '#ef4444' };

/** Etapas com que todo funil nasce (docs/dominio.md §3). */
export const defaultStageDrafts = (): StageDraft[] => [
  { key: newId('d'), name: 'Novos', kind: 'LEAD', color: '#94a3b8' },
  { key: newId('d'), name: 'Em contato', kind: 'LEAD', color: '#64748b' },
  { key: newId('d'), name: 'Qualificação', kind: 'OPEN', color: '#f59e0b' },
  { key: newId('d'), name: 'Proposta', kind: 'OPEN', color: '#8b5cf6' },
  { key: newId('d'), name: 'Negociação', kind: 'OPEN', color: '#3b82f6' },
  { key: newId('d'), name: 'Assinatura do contrato', kind: 'OPEN', color: '#0ea5e9' },
  { key: newId('d'), name: 'Ganho', kind: 'WON', color: '#10b981' },
  { key: newId('d'), name: 'Perdido', kind: 'LOST', color: '#ef4444' },
];

export const colorFor = (kind: StageKind) => COLORS[kind];

/** Monta a pipeline com o template padrão de requisitos: CNPJ antes da assinatura e "definir fonte". */
export function buildPipeline(name: string, offer: string, drafts: StageDraft[]): Pipeline {
  const id = newId('pl');
  const stages: Stage[] = drafts.map((d, i) => ({
    id: `${id}:${i}-${d.key}`,
    name: d.name.trim() || 'Etapa',
    kind: d.kind,
    color: d.color,
    ...(d.kind === 'OPEN' ? { probability: 50, alertDays: 7 } : {}),
  }));
  const firstLead = stages.find((s) => s.kind === 'LEAD') ?? stages[0];
  const signing = stages.find((s) => /assinatura/i.test(s.name)) ?? [...stages].reverse().find((s) => s.kind === 'OPEN');

  const requirements: Requirement[] = [
    { id: `${id}:r-fonte`, stageId: firstLead.id, label: 'Definir fonte da pipeline', tag: 'Configuração', kind: 'ACTION', gate: 'NONE', assignee: 'Quem criou a pipeline', blocked: 0, overdue: 0 },
  ];
  if (signing) {
    requirements.push({ id: `${id}:r-cnpj`, stageId: signing.id, label: 'Informar CNPJ', tag: 'Dados da empresa', kind: 'FIELD', gate: 'ENTER', assignee: 'Vendedor responsável', blocked: 0, overdue: 0 });
  }

  return {
    id,
    name: name.trim(),
    offer: offer.trim(),
    stages,
    sources: [],
    requirements,
    counts: Object.fromEntries(stages.map((s) => [s.id, 0])),
    values: {},
    customFields: [],
    taskTags: ['Dados do cliente', 'Dados da empresa', 'Comercial', 'Configuração'],
  };
}
