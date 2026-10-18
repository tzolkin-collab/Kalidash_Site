import type { Opportunity } from '../types.ts';

/** Só aceita como oportunidade criada algo com id e título: um corpo de erro nunca entra na lista. */
export function asCreatedOpportunity(body: unknown): Opportunity | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Partial<Opportunity>;
  return typeof o.id === 'string' && o.id !== '' && typeof o.title === 'string' ? (o as Opportunity) : null;
}
