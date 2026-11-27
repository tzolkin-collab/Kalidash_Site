// Mídia paga: uma linha por anúncio (o formato que a Marketing API entrega), somada por conta, campanha, conjunto ou
// anúncio, e os criativos reconhecidos entre contas. Dinheiro em centavos. Sem React (tests/paidMedia.test.ts).

export type Status = 'ACTIVE' | 'PAUSED';

export type Counts = {
  spend: number;
  impressions: number;
  clicks: number; // cliques no link
  pageViews: number;
  views3s: number; // reproduções de 3 s; 0 em imagem
  leads: number;
  qualified: number;
  sales: number;
  revenue: number;
};

export type AdRow = Counts & {
  /** Dia (AAAA-MM-DD) a que os números se referem; a leitura vem uma linha por anúncio e por dia. */
  date: string;
  accountId: string;
  accountName: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: Status;
  /** Orçamento diário da campanha; ausente quando o orçamento é por conjunto. */
  campaignBudget?: number;
  adsetId: string;
  adsetName: string;
  adsetStatus: Status;
  adsetBudget?: number;
  adId: string;
  adName: string;
  adStatus: Status;
  /** ID do criativo no Meta. Muda quando o anúncio é recriado em outra conta. */
  creativeId: string;
  /** O que identifica o arquivo ou a publicação: hash da imagem, ID do vídeo ou ID do post. */
  assetKey?: string;
  format: 'video' | 'image' | 'carousel';
  /** Miniatura servida pela Meta; ausente nos exemplos. */
  thumbnailUrl?: string;
};

const KEYS: (keyof Counts)[] = ['spend', 'impressions', 'clicks', 'pageViews', 'views3s', 'leads', 'qualified', 'sales', 'revenue'];
const zero = (): Counts => ({ spend: 0, impressions: 0, clicks: 0, pageViews: 0, views3s: 0, leads: 0, qualified: 0, sales: 0, revenue: 0 });
export function sum(rows: Counts[]): Counts {
  const t = zero();
  for (const r of rows) for (const k of KEYS) t[k] += r[k];
  return t;
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export type MetricKind = 'money' | 'int' | 'pct' | 'times';
export type Metric = { id: string; label: string; kind: MetricKind; hint: string; value: (c: Counts) => number | null; on: boolean };

/** As métricas na ordem das colunas. `on` = aparece sem a pessoa escolher. */
export const METRICS: Metric[] = [
  { id: 'spend', label: 'Gasto', kind: 'money', hint: 'Valor investido', value: (c) => c.spend, on: true },
  { id: 'sales', label: 'Vendas', kind: 'int', hint: 'Oportunidades ganhas no CRM', value: (c) => c.sales, on: true },
  { id: 'cpa', label: 'CPA', kind: 'money', hint: 'Gasto ÷ vendas', value: (c) => div(c.spend, c.sales), on: true },
  { id: 'revenue', label: 'Faturamento', kind: 'money', hint: 'Valor das oportunidades ganhas', value: (c) => c.revenue, on: true },
  { id: 'profit', label: 'Lucro', kind: 'money', hint: 'Faturamento menos gasto em mídia (sem impostos nem outros custos)', value: (c) => c.revenue - c.spend, on: true },
  { id: 'roas', label: 'ROAS', kind: 'times', hint: 'Faturamento ÷ gasto', value: (c) => div(c.revenue, c.spend), on: true },
  { id: 'margin', label: 'Margem', kind: 'pct', hint: 'Lucro ÷ faturamento', value: (c) => div(c.revenue - c.spend, c.revenue), on: false },
  { id: 'roi', label: 'ROI', kind: 'pct', hint: 'Lucro ÷ gasto', value: (c) => div(c.revenue - c.spend, c.spend), on: false },
  { id: 'leads', label: 'Leads', kind: 'int', hint: 'Leads no CRM', value: (c) => c.leads, on: true },
  { id: 'cpl', label: 'CPL', kind: 'money', hint: 'Gasto ÷ leads', value: (c) => div(c.spend, c.leads), on: true },
  { id: 'qualified', label: 'Qualificados', kind: 'int', hint: 'Leads qualificados', value: (c) => c.qualified, on: false },
  { id: 'cpql', label: 'Custo/qualificado', kind: 'money', hint: 'Gasto ÷ leads qualificados', value: (c) => div(c.spend, c.qualified), on: false },
  { id: 'impressions', label: 'Impressões', kind: 'int', hint: 'Vezes em que o anúncio apareceu', value: (c) => c.impressions, on: false },
  { id: 'cpm', label: 'CPM', kind: 'money', hint: 'Gasto a cada mil impressões', value: (c) => div(c.spend * 1000, c.impressions), on: true },
  { id: 'clicks', label: 'Cliques', kind: 'int', hint: 'Cliques no link', value: (c) => c.clicks, on: false },
  { id: 'cpc', label: 'CPC', kind: 'money', hint: 'Gasto ÷ cliques', value: (c) => div(c.spend, c.clicks), on: true },
  { id: 'ctr', label: 'CTR', kind: 'pct', hint: 'Cliques ÷ impressões', value: (c) => div(c.clicks, c.impressions), on: true },
  { id: 'pageViews', label: 'Vis. de página', kind: 'int', hint: 'Páginas carregadas depois do clique', value: (c) => c.pageViews, on: false },
  { id: 'cpv', label: 'CPV', kind: 'money', hint: 'Gasto ÷ visualizações de página', value: (c) => div(c.spend, c.pageViews), on: false },
  { id: 'connect', label: 'Conexão', kind: 'pct', hint: 'Visualizações de página ÷ cliques', value: (c) => div(c.pageViews, c.clicks), on: false },
  { id: 'pageConv', label: 'Conv. da página', kind: 'pct', hint: 'Leads ÷ visualizações de página', value: (c) => div(c.leads, c.pageViews), on: false },
  { id: 'hook', label: 'Hook (3 s)', kind: 'pct', hint: 'Reproduções de 3 segundos ÷ impressões, só em vídeo', value: (c) => (c.views3s > 0 ? div(c.views3s, c.impressions) : null), on: false },
];

/** Junta os dias de cada anúncio numa linha só. */
export function mergeAds(rows: AdRow[]): AdRow[] {
  const map = new Map<string, AdRow>();
  for (const r of rows) {
    const cur = map.get(r.adId);
    if (!cur) map.set(r.adId, { ...r });
    else for (const k of KEYS) cur[k] += r[k];
  }
  return [...map.values()];
}

export type Period = 'today' | 'yesterday' | '7d' | '14d' | '30d' | '90d';
export const PAID_PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hoje' }, { id: 'yesterday', label: 'Ontem' }, { id: '7d', label: 'Últimos 7 dias' }, { id: '14d', label: 'Últimos 14 dias' }, { id: '30d', label: 'Últimos 30 dias' }, { id: '90d', label: 'Últimos 90 dias' },
];

export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Primeiro e último dia (inclusive) do período; "últimos N dias" inclui hoje. */
export function periodDays(period: Period, now = new Date()): { from: string; to: string } {
  const back = (n: number) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  if (period === 'today') return { from: back(0), to: back(0) };
  if (period === 'yesterday') return { from: back(1), to: back(1) };
  return { from: back(Number.parseInt(period, 10) - 1), to: back(0) };
}

export const inPeriod = (rows: AdRow[], period: Period, now = new Date()): AdRow[] => {
  const { from, to } = periodDays(period, now);
  return rows.filter((r) => r.date >= from && r.date <= to);
};

/** Célula de CSV: aspas dobradas, e nada que a planilha leia como fórmula (os nomes vêm de fora). */
export function csvCell(value: string): string {
  const formula = /^[=+@\t\r-]/.test(value) && !/^-?\d/.test(value);
  return `"${(formula ? `'${value}` : value).replace(/"/g, '""')}"`;
}

export type Level = 'account' | 'campaign' | 'adset' | 'ad';
export const LEVELS: { id: Level; label: string }[] = [
  { id: 'account', label: 'Contas' }, { id: 'campaign', label: 'Campanhas' }, { id: 'adset', label: 'Conjuntos' }, { id: 'ad', label: 'Anúncios' },
];

export type LevelRow = Counts & { id: string; name: string; context: string; status?: Status; budget?: number };

export function byLevel(rows: AdRow[], level: Level): LevelRow[] {
  const map = new Map<string, { first: AdRow; list: AdRow[] }>();
  for (const r of rows) {
    const id = level === 'account' ? r.accountId : level === 'campaign' ? r.campaignId : level === 'adset' ? r.adsetId : r.adId;
    const g = map.get(id) ?? { first: r, list: [] };
    g.list.push(r);
    map.set(id, g);
  }
  return [...map].map(([id, { first, list }]) => ({
    ...sum(list),
    id,
    name: level === 'account' ? first.accountName : level === 'campaign' ? first.campaignName : level === 'adset' ? first.adsetName : first.adName,
    context: level === 'account' ? first.accountId : level === 'campaign' ? first.accountName : level === 'adset' ? first.campaignName : first.adsetName,
    status: level === 'campaign' ? first.campaignStatus : level === 'adset' ? first.adsetStatus : level === 'ad' ? first.adStatus : undefined,
    budget: level === 'campaign' ? first.campaignBudget : level === 'adset' ? first.adsetBudget : undefined,
  }));
}

/**
 * Como as peças de um grupo foram reconhecidas como a mesma:
 * "id" = um só ID de criativo; "arquivo" = IDs diferentes com o mesmo arquivo ou post; "nome" = só o nome bate.
 */
export type Match = 'id' | 'arquivo' | 'nome';

export type CreativeGroup = Counts & {
  key: string; name: string; format: AdRow['format']; match: Match;
  creativeIds: string[]; accounts: string[]; ads: AdRow[];
};

export const creativeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s*[-–]?\s*(c[oó]pia|copy)(\s*\d+)?$/i, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Agrupa anúncios do mesmo criativo, inclusive entre contas: pelo ID do criativo, pelo arquivo (ou post) e, por
 * último, pelo nome com o mesmo formato (vídeo reenviado ganha outro ID). O grupo guarda o vínculo mais fraco usado.
 */
export function creativeGroups(daily: AdRow[]): CreativeGroup[] {
  const rows = mergeAds(daily);
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (keyOf: (r: AdRow) => string) => {
    const seen = new Map<string, number>();
    rows.forEach((r, i) => {
      const k = keyOf(r);
      if (!k) return;
      const j = seen.get(k);
      if (j === undefined) seen.set(k, i);
      else parent[find(i)] = find(j);
    });
  };
  join((r) => r.creativeId);
  join((r) => r.assetKey ?? '');
  const strong = rows.map((_, i) => find(i));
  join((r) => (creativeName(r.adName) ? `${r.format}|${creativeName(r.adName)}` : ''));

  const groups = new Map<number, number[]>();
  rows.forEach((_, i) => { const root = find(i); groups.set(root, [...(groups.get(root) ?? []), i]); });
  return [...groups.values()].map((idx) => {
    const ads = idx.map((i) => rows[i]);
    const creativeIds = [...new Set(ads.map((a) => a.creativeId))];
    const match: Match = new Set(idx.map((i) => strong[i])).size > 1 ? 'nome' : creativeIds.length > 1 ? 'arquivo' : 'id';
    const top = [...ads].sort((a, b) => b.spend - a.spend)[0];
    return { ...sum(ads), key: creativeIds.slice().sort().join('+'), name: top.adName, format: top.format, match, creativeIds, accounts: [...new Set(ads.map((a) => a.accountName))], ads };
  });
}
