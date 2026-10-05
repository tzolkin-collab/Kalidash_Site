import type { ChangeEntry } from '../domain';

// Partes puras da sincronização do histórico com a API (sem rede nem stores), testadas em
// tests/historyDiff.test.ts. A orquestração fica em historySync.ts.

/** Mais recente primeiro; no empate, pelo id (o servidor ordena igual). */
export const byRecent = (a: ChangeEntry, b: ChangeEntry) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id);

/** Junta o que veio do servidor ao que já está na tela, sem duplicar por id. Devolve o mesmo array se nada entrou. */
export function mergeHistory(existing: ChangeEntry[], incoming: ChangeEntry[]): ChangeEntry[] {
  const seen = new Set(existing.map((e) => e.id));
  const added = incoming.filter((e) => !seen.has(e.id));
  if (added.length === 0) return existing;
  return [...existing, ...added].sort(byRecent);
}

/** O que ainda não foi para o servidor, do mais antigo para o mais novo (a ordem em que aconteceu). */
export const pendingEntries = (entries: ChangeEntry[], known: Set<string>): ChangeEntry[] =>
  entries.filter((e) => !known.has(e.id)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
