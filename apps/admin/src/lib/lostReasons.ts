import type { Pipeline } from '../domain';

// Motivo de perda (WP4-2, D28): a mesma regra do servidor (apps/api/lead_lifecycle.go).
// Vale para descartar um lead e para levar uma oportunidade a uma etapa Perdida.
// A lista é do funil (Pipeline.config.lostReasons); sem lista própria, vale a padrão abaixo.

export const OTHER_LOST_REASON = 'Outro';

/** Igual a defaultLostReasons da API: mudar aqui exige mudar lá. */
export const DEFAULT_LOST_REASONS = ['Sem orçamento', 'Escolheu concorrente', 'Sem resposta', 'Sem fit', 'Timing', OTHER_LOST_REASON];

/** Os motivos do funil, ou os padrão quando ele não definiu os seus. */
export function lostReasonsFor(p: Pick<Pipeline, 'lostReasons'> | undefined): string[] {
  const own = (p?.lostReasons ?? []).map((r) => r.trim()).filter(Boolean);
  return own.length > 0 ? own : DEFAULT_LOST_REASONS;
}

/** O que impede confirmar o motivo (null quando está tudo certo). */
export function lostReasonProblem(reasons: string[], reason: string, note: string): string | null {
  if (!reason.trim()) return 'Escolha o motivo.';
  if (!reasons.includes(reason)) return 'Este motivo não está na lista do funil.';
  if (reason === OTHER_LOST_REASON && !note.trim()) return 'Com "Outro", explique o motivo na observação.';
  return null;
}

/** Motivo e nota em uma linha, para listas e avisos. */
export const lostReasonLabel = (reason?: string, note?: string) => (reason ? (note?.trim() ? `${reason} · ${note.trim()}` : reason) : '');
