import type { Opportunity } from '../types.ts';

/** Só aceita como oportunidade criada algo com id e título: um corpo de erro nunca entra na lista. */
export function asCreatedOpportunity(body: unknown): Opportunity | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Partial<Opportunity>;
  return typeof o.id === 'string' && o.id !== '' && typeof o.title === 'string' ? (o as Opportunity) : null;
}

/** O que a ficha edita e a API grava (PUT /api/leads). Vínculo `null` tira o vínculo. */
export type OpportunityChanges = {
  title?: string;
  value?: number;
  priority?: string;
  tags?: string[];
  contactId?: string | null;
  companyId?: string | null;
  ownerMemberId?: string | null;
};

/**
 * Corpo do PUT: id, título e valor sempre (a API os exige) e SÓ o que mudou do resto. Mandar a oportunidade
 * inteira reenviaria vínculos que o servidor confere de novo (uma pessoa arquivada depois barraria até a troca
 * de um título) e tags que outra pessoa pode ter mudado.
 */
export function updateBody(opp: Pick<Opportunity, 'id' | 'title' | 'value'>, changes: OpportunityChanges): Record<string, unknown> {
  return { id: opp.id, title: opp.title, value: opp.value, ...changes };
}

/**
 * A oportunidade depois de salva: o que o servidor devolveu (nomes dos vínculos já resolvidos) por cima da
 * versão da tela. Vínculo que o servidor omite (campo vazio some do JSON) vira vazio, não fica o antigo.
 */
export function mergeSaved(local: Opportunity, saved: Partial<Opportunity> | null | undefined): Opportunity {
  if (!saved || typeof saved !== 'object') return local;
  return {
    ...local,
    title: saved.title ?? local.title,
    value: saved.value ?? local.value,
    priority: saved.priority || local.priority,
    tags: Array.isArray(saved.tags) ? saved.tags : local.tags,
    contactId: saved.contactId, contactName: saved.contactName, contactAvatar: saved.contactAvatar,
    companyId: saved.companyId, companyName: saved.companyName, companyLogo: saved.companyLogo,
    ownerId: saved.ownerId, ownerMemberId: saved.ownerMemberId, ownerName: saved.ownerName, ownerAvatar: saved.ownerAvatar,
  };
}

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'HIGH', label: 'Alta' },
];

/** Texto curto para a anotação automática da ficha ("A prioridade foi alterada para Alta"). */
export function changeNote(changes: OpportunityChanges, names: { contact?: string; company?: string; owner?: string }): string[] {
  const out: string[] = [];
  if (changes.priority !== undefined) out.push(`A prioridade foi alterada para ${PRIORITY_OPTIONS.find((p) => p.value === changes.priority)?.label ?? changes.priority}`);
  if (changes.tags !== undefined) out.push(`As tags foram alteradas para: ${changes.tags.length ? changes.tags.join(', ') : 'nenhuma'}`);
  if (changes.contactId !== undefined) out.push(changes.contactId ? `O contato passou a ser ${names.contact ?? 'outra pessoa'}` : 'O contato foi removido');
  if (changes.companyId !== undefined) out.push(changes.companyId ? `A empresa passou a ser ${names.company ?? 'outra empresa'}` : 'A empresa foi removida');
  if (changes.ownerMemberId !== undefined) out.push(changes.ownerMemberId ? `O responsável passou a ser ${names.owner ?? 'outra pessoa'}` : 'O responsável foi removido');
  return out;
}
