// Catálogo de tags: classifica o TEXTO das tags em categorias de tag (Perfil do cliente, Evento, Geral). A tag em si
// segue sendo texto nos registros; o catálogo (tabela Tag na API) só diz a que categoria cada texto pertence.
// Status (da tarefa), prioridade e origem NÃO são tags: são campos próprios (components/FieldBadge.tsx).
// Sem entrada no catálogo, vale um palpite por palavras conhecidas (suggestCategory) ou "Geral".
// Puro, sem React: testado em tests/tagCatalog.test.ts.

export type TagCategory = 'PROFILE' | 'EVENT' | 'GENERAL';

/** Ordem em que as categorias aparecem nas listas. */
export const CATEGORY_ORDER: TagCategory[] = ['PROFILE', 'EVENT', 'GENERAL'];

export const CATEGORY_META: Record<TagCategory, { label: string; hint: string }> = {
  PROFILE: { label: 'Perfil do cliente', hint: 'Que tipo de cliente é (B2B, B2C, Enterprise…)' },
  EVENT: { label: 'Evento', hint: 'Feira, webinar, congresso… onde o contato apareceu' },
  GENERAL: { label: 'Geral', hint: 'Qualquer outra marcação' },
};

export type CatalogTag = { id: string; name: string; category: TagCategory };

/** Chave de comparação: sem acento, sem maiúsculas, sem espaços nas pontas. "Indicação" = "indicacao". */
export const tagKey = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

const isCategory = (v: unknown): v is TagCategory => CATEGORY_ORDER.includes(v as TagCategory);
export const asCategory = (v: unknown): TagCategory => (isCategory(v) ? v : 'GENERAL');

// Palpite quando a tag não está no catálogo. Perfil: a palavra inteira. Evento: a palavra aparece em qualquer lugar
// do nome ("Feira Agrishow", "Webinar de IA").
const PROFILE_WORDS = ['enterprise', 'b2b', 'b2c', 'b2b2c', 'pme', 'startup', 'smb', 'varejo', 'pessoa fisica', 'corporativo', 'mid-market', 'governo'];
const EVENT_WORDS = ['evento', 'feira', 'webinar', 'congresso', 'workshop', 'meetup', 'palestra', 'summit', 'convencao', 'expo'];

export function suggestCategory(name: string): TagCategory {
  const k = tagKey(name);
  if (PROFILE_WORDS.includes(k)) return 'PROFILE';
  if (EVENT_WORDS.some((w) => k === w || k.split(/[\s\-_/]+/).includes(w))) return 'EVENT';
  return 'GENERAL';
}

/** A categoria da tag: a do catálogo se existir; senão o palpite. */
export function categoryOf(name: string, catalog: CatalogTag[]): TagCategory {
  const k = tagKey(name);
  const hit = catalog.find((c) => tagKey(c.name) === k);
  return hit ? hit.category : suggestCategory(name);
}

/** Todos os nomes conhecidos, sem repetir (ignorando acento e caixa): os do catálogo + os usados nos registros. */
export function knownTags(catalog: CatalogTag[], used: string[]): string[] {
  const seen = new Map<string, string>();
  for (const n of [...catalog.map((c) => c.name), ...used]) {
    const name = n.trim();
    if (name && !seen.has(tagKey(name))) seen.set(tagKey(name), name);
  }
  return [...seen.values()];
}

export type TagGroup = { category: TagCategory; tags: string[] };

/** Agrupa por categoria (na ordem de CATEGORY_ORDER), cada grupo em ordem alfabética; categoria vazia some. */
export function groupTags(names: string[], catalog: CatalogTag[]): TagGroup[] {
  const by = new Map<TagCategory, string[]>();
  for (const n of names) {
    const c = categoryOf(n, catalog);
    by.set(c, [...(by.get(c) ?? []), n]);
  }
  return CATEGORY_ORDER.filter((c) => by.has(c)).map((c) => ({ category: c, tags: (by.get(c) as string[]).sort((a, b) => a.localeCompare(b, 'pt-BR')) }));
}

/** Filtra pelo texto da busca (no nome da tag ou no nome da categoria), sem acento e sem diferenciar maiúsculas. */
export function searchTags(names: string[], catalog: CatalogTag[], query: string): string[] {
  const q = tagKey(query);
  if (!q) return names;
  return names.filter((n) => tagKey(n).includes(q) || tagKey(CATEGORY_META[categoryOf(n, catalog)].label).includes(q));
}

/** Já existe uma tag com esse nome (ignorando acento e caixa)? Devolve o nome como está guardado. */
export const findTag = (names: string[], query: string): string | undefined => names.find((n) => tagKey(n) === tagKey(query));
