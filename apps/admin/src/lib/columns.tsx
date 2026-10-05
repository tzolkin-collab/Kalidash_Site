import type { ReactNode } from 'react';
import type { Opportunity } from '../types';
import { formatCurrency, formatDate } from './format';
import { ClientCell, Owner, StageBadge, Tags } from '../components/cells';

// Uma "coluna" é qualquer informação guardada sobre a oportunidade que pode aparecer na Lista
// e na ficha. As do sistema vêm de colunas do banco; as personalizadas vêm de um jsonb
// (`customData`), então nem tudo é coluna de verdade.

export type ColumnDef = {
  id: string;
  label: string;
  group: 'system' | 'custom';
  /** A coluna "Oportunidade" (título) é sempre a primeira e não sai. */
  removable: boolean;
  render: (opp: Opportunity) => ReactNode;
};

const PRIORITIES: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };
const priorityLabel = (priority: string) => PRIORITIES[priority] ?? priority;

const dash = <span className="text-muted">—</span>;

export const SYSTEM_COLUMNS: ColumnDef[] = [
  { id: 'title', label: 'Oportunidade', group: 'system', removable: false, render: (o) => <div className="font-semibold">{o.title}{o.isLead && <span className="badge badge-accent lead-badge">Lead</span>}</div> },
  { id: 'client', label: 'Cliente', group: 'system', removable: true, render: (o) => <ClientCell opp={o} /> },
  { id: 'stage', label: 'Estágio', group: 'system', removable: true, render: (o) => <StageBadge stage={o.stage} opp={o} /> },
  { id: 'tags', label: 'Tags', group: 'system', removable: true, render: (o) => <Tags tags={o.tags} /> },
  { id: 'value', label: 'Valor', group: 'system', removable: true, render: (o) => (o.isLead ? dash : <span className="font-medium" style={{ whiteSpace: 'nowrap' }}>{formatCurrency(o.value)}</span>) },
  { id: 'priority', label: 'Prioridade', group: 'system', removable: true, render: (o) => (o.priority ? <span className="tag">{priorityLabel(o.priority)}</span> : dash) },
  { id: 'owner', label: 'Dono', group: 'system', removable: true, render: (o) => <Owner opp={o} /> },
  { id: 'contact', label: 'Contato', group: 'system', removable: true, render: (o) => o.contactName ?? dash },
  { id: 'company', label: 'Empresa', group: 'system', removable: true, render: (o) => o.companyName ?? dash },
  { id: 'created', label: 'Criada em', group: 'system', removable: true, render: (o) => formatDate(o.created_at) ?? dash },
];

/** "data_prevista" ou "dataPrevista" -> "Data prevista". */
function prettifyKey(key: string): string {
  const spaced = key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatCustomValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return dash;
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : dash;
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value) ?? value;
  return String(value);
}

/** Uma coluna para cada chave encontrada em `customData` de qualquer oportunidade carregada. */
export function customColumnsFrom(opps: Opportunity[]): ColumnDef[] {
  const keys = new Set<string>();
  for (const o of opps) {
    if (o.customData && typeof o.customData === 'object') Object.keys(o.customData).forEach((k) => keys.add(k));
  }
  return [...keys].sort().map((key) => ({
    id: `custom:${key}`,
    label: prettifyKey(key),
    group: 'custom' as const,
    removable: true,
    render: (o: Opportunity) => formatCustomValue(o.customData?.[key]),
  }));
}

/** Colunas visíveis, na ordem escolhida. "Oportunidade" vem sempre primeiro. */
export function resolveColumns(all: ColumnDef[], visibleIds: string[]): ColumnDef[] {
  const byId = new Map(all.map((c) => [c.id, c]));
  const title = byId.get('title');
  const rest = visibleIds
    .filter((id) => id !== 'title')
    .map((id) => byId.get(id))
    .filter((c): c is ColumnDef => Boolean(c)); // ignora ids que não existem mais
  return title ? [title, ...rest] : rest;
}
