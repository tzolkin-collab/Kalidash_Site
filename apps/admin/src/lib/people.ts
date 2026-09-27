import type { Lifecycle } from '../domain';

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = { LEAD: 'Lead', PROSPECT: 'Em negociação', CLIENT: 'Cliente', INACTIVE: 'Inativo' };
export const LIFECYCLE_TONE: Record<Lifecycle, 'neutral' | 'warning' | 'success'> = { LEAD: 'neutral', PROSPECT: 'warning', CLIENT: 'success', INACTIVE: 'neutral' };

/** Iniciais para o avatar (até duas letras). */
export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}
