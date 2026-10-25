import type { Role } from '../domain';

// Lógica pura dos escopos (sem React nem rede, para testar com node --test). O servidor é quem decide
// (apps/api/auth_scopes.go); aqui só se calcula o que mostrar e o que enviar.

export type ScopeDef = { id: string; group: string; label: string; description: string; humanOnly?: boolean; reserved?: boolean; publishable?: boolean };
export type Catalog = { groups: string[]; scopes: ScopeDef[]; presets: Record<Role, string[]> };

/** (preset + extras) - removidos, ordenado. */
export function effective(preset: string[], extra: string[], denied: string[]): string[] {
  const set = new Set(preset);
  extra.forEach((s) => set.add(s));
  denied.forEach((s) => set.delete(s));
  return [...set].sort();
}

/** O que enviar para a pessoa acabar com exatamente `want` partindo do preset: extras = o que passa, removidos = o que falta. */
export function overridesFor(preset: string[], want: Iterable<string>): { extra: string[]; denied: string[] } {
  const w = new Set(want);
  const p = new Set(preset);
  return { extra: [...w].filter((s) => !p.has(s)).sort(), denied: [...p].filter((s) => !w.has(s)).sort() };
}

/** Escopos agrupados por área, na ordem do catálogo. `forTokens` esconde os que só pessoas podem ter. */
export function groupScopes(catalog: Catalog, opts: { forTokens?: boolean } = {}): { group: string; scopes: ScopeDef[] }[] {
  const keep = (s: ScopeDef) => !opts.forTokens || !s.humanOnly;
  return catalog.groups
    .map((group) => ({ group, scopes: catalog.scopes.filter((s) => s.group === group && keep(s)) }))
    .filter((g) => g.scopes.length > 0);
}

/** Frases curtas, para o resumo "o que esta pessoa pode fazer". */
const PHRASE: Record<string, string> = {
  'leads:read': 'ver leads e oportunidades',
  'leads:write': 'criar e editar leads',
  'leads:own': 'ver e editar só os leads dele',
  'opportunities:own': 'ver e editar só as oportunidades dele',
  'leads:origin': 'trocar a origem do lead',
  'people:read': 'ver pessoas e empresas',
  'people:write': 'editar pessoas e empresas',
  'people:document': 'ver e alterar o CPF',
  'history:read': 'ver o histórico',
  'history:write': 'gravar no histórico',
  'pipelines:read': 'ver funis',
  'pipelines:manage': 'gerenciar funis',
  'tasks:read': 'ver tarefas',
  'tasks:write': 'criar e editar tarefas',
  'blog:read': 'ver rascunhos do blog',
  'blog:write': 'escrever no blog',
  'emails:send': 'enviar e-mails',
  'automations:manage': 'gerenciar automações',
  'team:read': 'ver a equipe',
  'team:manage': 'gerenciar equipe e permissões',
  'keys:manage': 'gerenciar tokens de API',
  'forms:write': 'enviar formulários pelo connect.js',
  'analytics:write': 'enviar eventos de analytics',
  'ads:read': 'ler mídia paga',
};

export const phraseOf = (def: ScopeDef) => PHRASE[def.id] ?? def.label.toLowerCase();

export function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Uma linha por área: o que pode, ou null quando não pode nada ali. */
export function summarize(catalog: Catalog, scopes: Iterable<string>): { group: string; can: string | null; count: number; total: number }[] {
  const have = new Set(scopes);
  return groupScopes(catalog).map(({ group, scopes: list }) => {
    const mine = list.filter((s) => have.has(s.id));
    const text = joinPt(mine.map(phraseOf));
    return { group, can: mine.length ? text.charAt(0).toUpperCase() + text.slice(1) : null, count: mine.length, total: list.length };
  });
}

export type Validity = 'never' | '30' | '90' | '365' | 'date';

/** ISO da validade escolhida, ou undefined quando o token nunca expira. `date` vem como YYYY-MM-DD (fim do dia local). */
export function expiryFor(v: Validity, date: string, now = new Date()): string | undefined {
  if (v === 'never') return undefined;
  if (v === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
    const d = new Date(`${date}T23:59:59`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return new Date(now.getTime() + Number(v) * 86_400_000).toISOString();
}

/** Texto curto de "há quanto tempo". */
export function ago(iso: string | undefined, now = new Date()): string {
  if (!iso) return 'Nunca';
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'agora há pouco';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  if (s < 86400 * 30) return `há ${Math.round(s / 86400)} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** "kld_live_Ab3x" + "wXyZ" → "kld_live_Ab3x••••••••wXyZ" */
export const maskedToken = (prefix: string, last4: string) => `${prefix}••••••••${last4}`;

/** Tokens ainda válidos que a pessoa criou (D13: eles sobrevivem à desativação dela; a tela avisa antes). */
export function activeTokensOf<T extends { createdBy?: string; status: string }>(tokens: T[], memberId: string): T[] {
  return tokens.filter((t) => t.createdBy === memberId && t.status === 'ACTIVE');
}
