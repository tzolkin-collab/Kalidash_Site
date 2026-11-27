import { tagKey } from './tagCatalog.ts';

// Migração assistida das tags que na verdade são CAMPOS (status, prioridade, origem). Só PROPÕE: nada é alterado sem
// a pessoa confirmar cada grupo. Puro, sem React nem rede: testado em tests/tagMigration.test.ts.
//
//   Prioridade → campo `priority` da oportunidade (Alta, Média, Baixa).
//   Origem     → campos `origin` e `sourceName` do lead (que já existem; a tag costuma só repetir).
//   Status     → a etapa do funil já diz isso (status é campo da tarefa, não de oportunidade ou lead).
// Registro sem campo equivalente (pessoa não tem prioridade nem origem) só é MANTIDO, a menos que a pessoa escolha remover.

export type FieldKind = 'STATUS' | 'PRIORITY' | 'SOURCE';
export type EntityType = 'opportunity' | 'lead' | 'person';
/** MOVE: passa para o campo e tira a tag. REMOVE: só tira a tag (o campo já diz o mesmo). KEEP: não mexe. */
export type Action = 'MOVE' | 'REMOVE' | 'KEEP';

export const FIELD_KIND_LABEL: Record<FieldKind, string> = { STATUS: 'Status', PRIORITY: 'Prioridade', SOURCE: 'Origem' };
export const ENTITY_LABEL: Record<EntityType, { one: string; many: string }> = {
  opportunity: { one: 'oportunidade', many: 'oportunidades' },
  lead: { one: 'lead', many: 'leads' },
  person: { one: 'pessoa', many: 'pessoas' },
};

const PRIORITY_LEVEL: Record<string, 'HIGH' | 'MEDIUM' | 'LOW'> = { urgente: 'HIGH', critica: 'HIGH', alta: 'HIGH', media: 'MEDIUM', importante: 'MEDIUM', baixa: 'LOW' };
const PRIORITY_NAME = { HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' } as const;
const ORIGIN_WORD: Record<string, 'INBOUND' | 'OUTBOUND'> = { inbound: 'INBOUND', outbound: 'OUTBOUND' };
const ORIGIN_NAME = { INBOUND: 'Inbound', OUTBOUND: 'Outbound' } as const;
const SOURCE_WORDS = ['site', 'indicacao', 'organico', 'midia paga', 'instagram', 'linkedin', 'google', 'facebook', 'whatsapp', 'parceiro', 'parceria', 'newsletter', 'blog', 'formulario'];
const STATUS_WORDS = ['novo', 'nova', 'em contato', 'em andamento', 'aguardando', 'fechado', 'fechada', 'ganho', 'perdido', 'ativo', 'inativo', 'pendente', 'concluido', 'em negociacao', 'qualificado', 'descartado'];

/** A tag parece qual campo? `null` quando é uma tag de verdade (Perfil, Evento, Geral). */
export function fieldKindOf(tag: string): FieldKind | null {
  const k = tagKey(tag);
  if (k in PRIORITY_LEVEL) return 'PRIORITY';
  if (k in ORIGIN_WORD || SOURCE_WORDS.includes(k)) return 'SOURCE';
  if (STATUS_WORDS.includes(k)) return 'STATUS';
  return null;
}

export type Target = {
  entity: EntityType;
  id: string;
  name: string;
  tags: string[];
  /** Oportunidade: LOW, MEDIUM, HIGH ou vazio. */
  priority?: string;
  /** Lead. */
  origin?: 'INBOUND' | 'OUTBOUND';
  sourceName?: string;
};

export type Item = {
  entity: EntityType;
  id: string;
  name: string;
  tag: string;
  kind: FieldKind;
  action: Action;
  /** O que MOVE grava no campo. */
  set?: { priority?: 'HIGH' | 'MEDIUM' | 'LOW' };
  /** Por que esta sugestão, em uma frase. */
  note: string;
};

function planOne(t: Target, tag: string, kind: FieldKind): Item {
  const base = { entity: t.entity, id: t.id, name: t.name, tag, kind };
  const k = tagKey(tag);

  if (kind === 'PRIORITY') {
    if (t.entity !== 'opportunity') return { ...base, action: 'KEEP', note: `${ENTITY_LABEL[t.entity].one[0].toUpperCase()}${ENTITY_LABEL[t.entity].one.slice(1)} não tem campo de prioridade.` };
    const level = PRIORITY_LEVEL[k];
    if (!t.priority) return { ...base, action: 'MOVE', set: { priority: level }, note: `Passa a ser a Prioridade ${PRIORITY_NAME[level]}.` };
    if (t.priority === level) return { ...base, action: 'REMOVE', note: `A Prioridade já é ${PRIORITY_NAME[level]}.` };
    return { ...base, action: 'KEEP', note: `A Prioridade do registro é ${PRIORITY_NAME[t.priority as keyof typeof PRIORITY_NAME] ?? t.priority}, a tag diz ${PRIORITY_NAME[level]}. Revise à mão.` };
  }

  if (kind === 'SOURCE') {
    if (t.entity !== 'lead') return { ...base, action: 'KEEP', note: `${t.entity === 'person' ? 'Pessoa' : 'Oportunidade'} não tem campo de origem; ela fica no lead.` };
    const origin = ORIGIN_WORD[k];
    if (origin) {
      return t.origin === origin
        ? { ...base, action: 'REMOVE', note: `A Origem do lead já é ${ORIGIN_NAME[origin]}.` }
        : { ...base, action: 'KEEP', note: `A Origem do lead é ${t.origin ? ORIGIN_NAME[t.origin] : 'outra'}, a tag diz ${ORIGIN_NAME[origin]}. Revise à mão.` };
    }
    return t.sourceName && tagKey(t.sourceName).includes(k)
      ? { ...base, action: 'REMOVE', note: `A Fonte do lead já é “${t.sourceName}”.` }
      : { ...base, action: 'KEEP', note: `A Fonte do lead é “${t.sourceName ?? '—'}”; esta tag diz outra coisa.` };
  }

  // STATUS
  if (t.entity === 'person') return { ...base, action: 'KEEP', note: 'Status é campo da tarefa; para pessoa vale o ciclo de vida.' };
  return { ...base, action: 'REMOVE', note: 'A etapa do funil já mostra o andamento. Status é campo da tarefa.' };
}

/** Uma sugestão para cada (registro, tag) em que a tag parece um campo. */
export function planMigration(targets: Target[]): Item[] {
  const out: Item[] = [];
  for (const t of targets) {
    const seen = new Set<string>();
    for (const tag of t.tags) {
      const kind = fieldKindOf(tag);
      if (!kind || seen.has(tagKey(tag))) continue;
      seen.add(tagKey(tag));
      out.push(planOne(t, tag, kind));
    }
  }
  return out;
}

/** Itens iguais (mesma tag, tipo de registro, ação e motivo) andam juntos: a pessoa decide uma vez por grupo. */
export type Group = { key: string; tag: string; kind: FieldKind; entity: EntityType; action: Action; note: string; items: Item[] };

export function groupPlan(items: Item[]): Group[] {
  const by = new Map<string, Group>();
  for (const it of items) {
    const key = [tagKey(it.tag), it.entity, it.action, it.note].join('|');
    const g = by.get(key) ?? { key, tag: it.tag, kind: it.kind, entity: it.entity, action: it.action, note: it.note, items: [] };
    g.items.push(it);
    by.set(key, g);
  }
  const rank: Record<Action, number> = { MOVE: 0, REMOVE: 1, KEEP: 2 };
  return [...by.values()].sort((a, b) => rank[a.action] - rank[b.action] || a.kind.localeCompare(b.kind) || a.tag.localeCompare(b.tag, 'pt-BR') || a.entity.localeCompare(b.entity));
}

/** O que a pessoa escolheu para um grupo: seguir a sugestão, só tirar a tag, ou manter. */
export type Choice = 'SUGGESTED' | 'REMOVE' | 'KEEP';

/** A ação final de um item dado o que a pessoa escolheu para o grupo dele. MOVE só vale seguindo a sugestão. */
export function finalAction(item: Item, choice: Choice): Action {
  if (choice === 'KEEP') return 'KEEP';
  if (choice === 'REMOVE') return 'REMOVE';
  return item.action;
}

export type Change = { entity: EntityType; id: string; name: string; before: string[]; tags: string[]; patch: { priority?: 'HIGH' | 'MEDIUM' | 'LOW' }; removed: string[] };

/**
 * Junta as decisões por registro: as tags que saem (MOVE ou REMOVE) e o que vai para os campos. Registro sem nada a
 * mudar não aparece. `decide` devolve a ação final de cada item.
 */
export function buildChanges(targets: Target[], items: Item[], decide: (item: Item) => Action): Change[] {
  const byTarget = new Map<string, Item[]>();
  for (const it of items) byTarget.set(`${it.entity}:${it.id}`, [...(byTarget.get(`${it.entity}:${it.id}`) ?? []), it]);
  const out: Change[] = [];
  for (const t of targets) {
    const mine = byTarget.get(`${t.entity}:${t.id}`);
    if (!mine) continue;
    const leaving = new Map<string, Item>();
    for (const it of mine) if (decide(it) !== 'KEEP') leaving.set(tagKey(it.tag), it);
    if (leaving.size === 0) continue;
    const patch: Change['patch'] = {};
    for (const it of leaving.values()) if (decide(it) === 'MOVE' && it.set?.priority) patch.priority = it.set.priority;
    out.push({ entity: t.entity, id: t.id, name: t.name, before: t.tags, tags: t.tags.filter((x) => !leaving.has(tagKey(x))), patch, removed: [...leaving.values()].map((i) => i.tag) });
  }
  return out;
}
