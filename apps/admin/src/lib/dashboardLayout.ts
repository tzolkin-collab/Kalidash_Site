// Layout da Dashboard: quais widgets aparecem, em que ordem e com que largura (grade de 12 colunas).
// Funções puras, sem React: testadas em tests/dashboardLayout.test.ts. O layout é de cada pessoa e fica no
// navegador (localStorage), então não depende da API.

import { VISUAL_BY_ID, normalizeChart } from './chartSpec.ts';
import type { ChartConfig } from './chartSpec.ts';

/** Largura em colunas da grade de 12: 3 = 1/4, 4 = 1/3, 6 = 1/2, 8 = 2/3, 12 = inteira. */
export type Span = 3 | 4 | 6 | 8 | 12;
export const SPANS: Span[] = [3, 4, 6, 8, 12];
export const SPAN_LABEL: Record<Span, string> = { 3: '1/4', 4: '1/3', 6: '1/2', 8: '2/3', 12: 'Inteira' };

/** `config` só existe nos gráficos configuráveis (id `chart-…`): cada um carrega a própria configuração. */
export type LayoutItem = { id: string; span: Span; config?: ChartConfig };
export type Layout = LayoutItem[];

/** O que o layout precisa saber de cada widget (o catálogo completo mora em components/dashboard/widgets.tsx). */
export type WidgetSpec = { id: string; defaultSpan: Span; spans: Span[]; inDefault?: boolean; /** Posição no layout de fábrica (menor primeiro); sem ela vale a ordem do catálogo. */ defaultOrder?: number };

const isSpan = (n: unknown): n is Span => SPANS.includes(n as Span);

// ---- Gráficos configuráveis -------------------------------------------------------------------------------------

export const CUSTOM_PREFIX = 'chart-';
export const isCustomId = (id: string) => id.startsWith(CUSTOM_PREFIX);
/** Larguras que um gráfico configurável aceita. */
export const CUSTOM_SPANS: Span[] = [4, 6, 8, 12];

/** Largura inicial: séries e pareto precisam de espaço; rosca, barras e funil cabem em meia largura. */
export function defaultCustomSpan(config: ChartConfig): Span {
  const shape = VISUAL_BY_ID.get(config.visual)?.shape;
  return shape === 'series' || shape === 'stacked' || config.visual === 'pareto' ? 8 : 6;
}

let customCounter = 0;
const newCustomId = () => `${CUSTOM_PREFIX}${Date.now().toString(36)}${(customCounter++).toString(36)}`;

/** Layout de fábrica: os widgets marcados `inDefault`, na ordem do catálogo. */
export const defaultLayout = (catalog: WidgetSpec[]): Layout =>
  catalog
    .map((w, index) => ({ w, index }))
    .filter(({ w }) => w.inDefault)
    .sort((a, b) => (a.w.defaultOrder ?? a.index) - (b.w.defaultOrder ?? b.index) || a.index - b.index)
    .map(({ w }) => ({ id: w.id, span: w.defaultSpan }));

/**
 * Limpa um layout vindo do disco: some com widgets que não existem mais, repetidos e larguras inválidas
 * (volta para a padrão do widget). Não inventa widgets novos: quem quiser, adiciona pelo catálogo.
 */
export function normalizeLayout(raw: unknown, catalog: WidgetSpec[]): Layout {
  if (!Array.isArray(raw)) return defaultLayout(catalog);
  const seen = new Set<string>();
  const out: Layout = [];
  for (const it of raw) {
    const id = typeof it?.id === 'string' ? it.id : '';
    if (isCustomId(id) && !seen.has(id)) {
      const config = normalizeChart(it.config);
      if (config) {
        seen.add(id);
        out.push({ id, span: isSpan(it.span) && CUSTOM_SPANS.includes(it.span) ? it.span : defaultCustomSpan(config), config });
      }
      continue;
    }
    const spec = catalog.find((w) => w.id === id);
    if (!spec || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, span: isSpan(it.span) && spec.spans.includes(it.span) ? it.span : spec.defaultSpan });
  }
  return out;
}

/** Move o item `from` para a posição `to` (índices do layout atual). */
export function moveItem(layout: Layout, from: number, to: number): Layout {
  if (from === to || from < 0 || to < 0 || from >= layout.length || to >= layout.length) return layout;
  const next = [...layout];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function setSpan(layout: Layout, id: string, span: Span, catalog: WidgetSpec[]): Layout {
  const allowed = isCustomId(id) ? CUSTOM_SPANS : catalog.find((w) => w.id === id)?.spans;
  if (!allowed || !allowed.includes(span)) return layout;
  return layout.map((it) => (it.id === id ? { ...it, span } : it));
}

/** Põe um gráfico configurável no fim do layout. Devolve o layout e o id criado. */
export function addCustom(layout: Layout, config: ChartConfig): { layout: Layout; id: string } {
  const id = newCustomId();
  return { id, layout: [...layout, { id, span: defaultCustomSpan(config), config }] };
}

/** Troca a configuração de um gráfico (a largura continua a mesma). */
export const updateCustom = (layout: Layout, id: string, config: ChartConfig): Layout =>
  layout.map((it) => (it.id === id && isCustomId(id) ? { ...it, config } : it));

export const removeItem = (layout: Layout, id: string): Layout => layout.filter((it) => it.id !== id);

/** Põe o widget no fim do layout, na largura padrão. Se já está lá, não repete. */
export function addItem(layout: Layout, id: string, catalog: WidgetSpec[]): Layout {
  const spec = catalog.find((w) => w.id === id);
  if (!spec || layout.some((it) => it.id === id)) return layout;
  return [...layout, { id, span: spec.defaultSpan }];
}

// ---- Disco -------------------------------------------------------------------------------------------------------

const KEY = 'kalidash.dashboard.layout.v1';
/** Cada pessoa tem o seu layout; sem login (modo exemplo) vale um só. */
export const layoutKey = (userId?: string) => `${KEY}.${userId || 'anon'}`;

export function loadLayout(key: string, catalog: WidgetSpec[]): Layout {
  try {
    const raw = localStorage.getItem(key);
    return raw ? normalizeLayout(JSON.parse(raw), catalog) : defaultLayout(catalog);
  } catch {
    return defaultLayout(catalog); // sem storage (aba privada, bloqueio): funciona só nesta sessão
  }
}

export function saveLayout(key: string, layout: Layout): void {
  try { localStorage.setItem(key, JSON.stringify(layout)); } catch { /* sem storage: vale só nesta sessão */ }
}

export function clearLayout(key: string): void {
  try { localStorage.removeItem(key); } catch { /* idem */ }
}
