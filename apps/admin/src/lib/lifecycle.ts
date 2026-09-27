import type { Lifecycle } from '../domain';

// O ciclo de vida só avança sozinho: Lead -> Em negociação -> Cliente. Inativo é o estado de quem
// perdeu ou foi descartado, e dali qualquer evento novo pode reabrir. Voltar de Cliente é ação manual.

const RANK: Record<Lifecycle, number> = { INACTIVE: 0, LEAD: 1, PROSPECT: 2, CLIENT: 3 };

/** O evento pode levar o registro de `from` para `to` sem ação manual? */
export function canAdvance(from: Lifecycle, to: Lifecycle): boolean {
  if (from === to) return false;
  if (to === 'INACTIVE') return from !== 'CLIENT'; // cliente não vira inativo sozinho
  return RANK[to] > RANK[from];
}

export const LIFECYCLE_ORDER: Lifecycle[] = ['LEAD', 'PROSPECT', 'CLIENT', 'INACTIVE'];
