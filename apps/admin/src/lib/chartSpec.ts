// Contrato dos gráficos configuráveis da Dashboard. Cada visual declara o FORMATO de dado que lê (série no tempo,
// partes de um todo, ranking, etapas…) e quais campos pede; cada medida declara de quais formatos é capaz. A
// compatibilidade sai dessa regra: a interface nunca oferece um visual que não funciona para a medida escolhida.
// Puro, sem React: testado em tests/chartSpec.test.ts. Os números saem de lib/chartData.ts.

/** Formato do dado que o visual consome. */
export type Shape = 'series' | 'stacked' | 'parts' | 'ranking' | 'stages' | 'hierarchy' | 'matrix' | 'points' | 'distribution' | 'goal';

export type CategoryId = 'tempo' | 'composicao' | 'comparacao' | 'funil' | 'padroes' | 'meta';
export const CATEGORIES: { id: CategoryId; label: string; hint: string }[] = [
  { id: 'tempo', label: 'Evolução no tempo', hint: 'Como algo muda dia a dia ou semana a semana' },
  { id: 'composicao', label: 'Composição', hint: 'Quanto cada parte pesa no total' },
  { id: 'comparacao', label: 'Comparação', hint: 'Quem ou o que vem na frente' },
  { id: 'funil', label: 'Funil', hint: 'O que avança por cada etapa' },
  { id: 'padroes', label: 'Padrões e relações', hint: 'Quando as coisas acontecem e como se relacionam' },
  { id: 'meta', label: 'Meta', hint: 'Quanto falta para chegar lá' },
];

export type VisualId = 'line' | 'area' | 'columns' | 'stacked' | 'donut' | 'bars' | 'pareto' | 'funnel' | 'treemap' | 'sunburst' | 'heatmap' | 'scatter' | 'boxplot' | 'radial';

/** Campos que o visual pede ao montar. A medida é sempre pedida. */
export type SlotId = 'granularity' | 'compare' | 'dimension' | 'dimension2' | 'stackBy' | 'topN' | 'goal';

export type VisualDef = { id: VisualId; label: string; category: CategoryId; shape: Shape; description: string; slots: SlotId[] };

export const VISUALS: VisualDef[] = [
  { id: 'line', label: 'Linha', category: 'tempo', shape: 'series', description: 'Uma medida ao longo do tempo, com comparação opcional.', slots: ['granularity', 'compare'] },
  { id: 'area', label: 'Área', category: 'tempo', shape: 'series', description: 'Como a linha, destacando o volume.', slots: ['granularity', 'compare'] },
  { id: 'columns', label: 'Colunas', category: 'tempo', shape: 'series', description: 'Uma coluna por dia ou semana.', slots: ['granularity', 'compare'] },
  { id: 'stacked', label: 'Colunas empilhadas', category: 'tempo', shape: 'stacked', description: 'Cada coluna dividida por grupo (responsável, origem…).', slots: ['granularity', 'stackBy', 'topN'] },
  { id: 'donut', label: 'Rosca', category: 'composicao', shape: 'parts', description: 'As partes de um todo, em fatias.', slots: ['dimension', 'topN'] },
  { id: 'bars', label: 'Barras', category: 'comparacao', shape: 'ranking', description: 'Ranking do maior para o menor.', slots: ['dimension', 'topN'] },
  { id: 'pareto', label: 'Pareto', category: 'comparacao', shape: 'ranking', description: 'Ranking com a participação acumulada.', slots: ['dimension', 'topN'] },
  { id: 'treemap', label: 'Treemap', category: 'composicao', shape: 'hierarchy', description: 'Áreas proporcionais em dois níveis (ex.: origem → campanha).', slots: ['dimension', 'dimension2', 'topN'] },
  { id: 'sunburst', label: 'Sunburst', category: 'composicao', shape: 'hierarchy', description: 'Os mesmos dois níveis, em anéis concêntricos.', slots: ['dimension', 'dimension2', 'topN'] },
  { id: 'heatmap', label: 'Mapa de calor', category: 'padroes', shape: 'matrix', description: 'Dia da semana × hora: quando as coisas acontecem.', slots: [] },
  { id: 'scatter', label: 'Dispersão', category: 'padroes', shape: 'points', description: 'Cada venda ganha é um ponto: dias até fechar × valor.', slots: [] },
  { id: 'boxplot', label: 'Box plot', category: 'padroes', shape: 'distribution', description: 'Mediana, quartis e extremos de cada grupo.', slots: ['dimension'] },
  { id: 'radial', label: 'Radial', category: 'meta', shape: 'goal', description: 'Quanto da meta já foi atingido no período.', slots: ['goal'] },
  { id: 'funnel', label: 'Funil', category: 'funil', shape: 'stages', description: 'Quantas oportunidades (ou quanto valor) há em cada etapa, na ordem do funil.', slots: [] },
];

export const VISUAL_BY_ID = new Map(VISUALS.map((v) => [v.id, v]));

export type DimId = 'owner' | 'pipeline' | 'stage' | 'reason' | 'source' | 'campaign' | 'status' | 'assignee' | 'tag' | 'actor' | 'action';
export type Dim = { id: DimId; label: string };

export type MeasureId =
  | 'won-value' | 'won-count' | 'opp-created' | 'open-value' | 'lost-value' | 'lost-count'
  | 'leads-created' | 'tasks-open' | 'tasks-done' | 'actions' | 'stage-count' | 'stage-value' | 'deal-scatter' | 'close-days';

export type Unit = 'money' | 'count' | 'days';
export type Group = 'Vendas' | 'Leads' | 'Tarefas' | 'Atividade';

export type MeasureMeta = {
  id: MeasureId;
  label: string;
  group: Group;
  unit: Unit;
  /** Tem data própria: serve para série no tempo. */
  hasDate: boolean;
  /** Por quais cortes dá para dividir. Vazio = só etapas ou série simples. */
  dims: Dim[];
  /** Só lê "por etapa do funil" (visual Funil). */
  stages?: boolean;
  /** Cada registro é um ponto (dispersão). */
  points?: boolean;
  /** Cada registro é uma duração a resumir em quartis (box plot); não se soma. */
  distribution?: boolean;
};

const OPP_DIMS: Dim[] = [{ id: 'owner', label: 'Responsável' }, { id: 'pipeline', label: 'Funil' }, { id: 'stage', label: 'Etapa' }];

export const MEASURES: MeasureMeta[] = [
  { id: 'won-value', label: 'Valor ganho', group: 'Vendas', unit: 'money', hasDate: true, dims: [{ id: 'owner', label: 'Responsável' }, { id: 'pipeline', label: 'Funil' }] },
  { id: 'won-count', label: 'Contratos ganhos', group: 'Vendas', unit: 'count', hasDate: true, dims: [{ id: 'owner', label: 'Responsável' }, { id: 'pipeline', label: 'Funil' }] },
  { id: 'opp-created', label: 'Oportunidades criadas', group: 'Vendas', unit: 'count', hasDate: true, dims: OPP_DIMS },
  { id: 'open-value', label: 'Valor em aberto', group: 'Vendas', unit: 'money', hasDate: false, dims: OPP_DIMS },
  { id: 'lost-value', label: 'Valor perdido', group: 'Vendas', unit: 'money', hasDate: false, dims: [{ id: 'reason', label: 'Motivo da perda' }, { id: 'owner', label: 'Responsável' }, { id: 'pipeline', label: 'Funil' }] },
  { id: 'lost-count', label: 'Oportunidades perdidas', group: 'Vendas', unit: 'count', hasDate: false, dims: [{ id: 'reason', label: 'Motivo da perda' }, { id: 'owner', label: 'Responsável' }, { id: 'pipeline', label: 'Funil' }] },
  { id: 'stage-count', label: 'Oportunidades por etapa', group: 'Vendas', unit: 'count', hasDate: false, dims: [], stages: true },
  { id: 'stage-value', label: 'Valor por etapa', group: 'Vendas', unit: 'money', hasDate: false, dims: [], stages: true },
  { id: 'deal-scatter', label: 'Valor × dias até fechar', group: 'Vendas', unit: 'money', hasDate: false, dims: [], points: true },
  { id: 'close-days', label: 'Dias para fechar', group: 'Vendas', unit: 'days', hasDate: false, dims: [{ id: 'owner', label: 'Responsável' }, { id: 'pipeline', label: 'Funil' }], distribution: true },
  { id: 'leads-created', label: 'Leads novos', group: 'Leads', unit: 'count', hasDate: true, dims: [{ id: 'source', label: 'Origem' }, { id: 'campaign', label: 'Campanha' }, { id: 'status', label: 'Situação' }, { id: 'reason', label: 'Motivo do descarte' }] },
  { id: 'tasks-open', label: 'Tarefas abertas', group: 'Tarefas', unit: 'count', hasDate: false, dims: [{ id: 'assignee', label: 'Responsável' }, { id: 'tag', label: 'Tag' }, { id: 'source', label: 'Origem da tarefa' }] },
  { id: 'tasks-done', label: 'Tarefas concluídas', group: 'Tarefas', unit: 'count', hasDate: true, dims: [{ id: 'assignee', label: 'Responsável' }, { id: 'tag', label: 'Tag' }, { id: 'source', label: 'Origem da tarefa' }] },
  { id: 'actions', label: 'Ações da equipe', group: 'Atividade', unit: 'count', hasDate: true, dims: [{ id: 'actor', label: 'Pessoa' }, { id: 'action', label: 'Tipo de ação' }] },
];

export const MEASURE_BY_ID = new Map(MEASURES.map((m) => [m.id, m]));

/** A medida sabe entregar este formato? */
export function measureSupports(m: MeasureMeta, shape: Shape): boolean {
  const plain = !m.stages && !m.points && !m.distribution; // medidas somáveis, com contagem ou valor por registro
  switch (shape) {
    case 'series':
    case 'matrix':
    case 'goal': return plain && m.hasDate;
    case 'stacked': return plain && m.hasDate && m.dims.length > 0;
    case 'parts':
    case 'ranking': return plain && m.dims.length > 0;
    case 'hierarchy': return plain && m.dims.length >= 2;
    case 'stages': return Boolean(m.stages);
    case 'points': return Boolean(m.points);
    case 'distribution': return Boolean(m.distribution);
  }
}

export const compatibleMeasures = (visual: VisualId): MeasureMeta[] => {
  const v = VISUAL_BY_ID.get(visual);
  return v ? MEASURES.filter((m) => measureSupports(m, v.shape)) : [];
};

export type Granularity = 'day' | 'week';

export type ChartConfig = {
  visual: VisualId;
  measure: MeasureId;
  /** Dividir por (rosca, barras, pareto). */
  dimension?: DimId;
  /** Segundo nível (treemap e sunburst): "depois por". */
  dimension2?: DimId;
  /** Empilhar por (colunas empilhadas). */
  stackBy?: DimId;
  /** Meta do gráfico radial, na unidade da medida (reais ou unidades). */
  goal?: number;
  granularity: Granularity;
  /** Mostrar o período anterior (só nos visuais de série simples). */
  compare: boolean;
  /** Quantas fatias, barras ou grupos antes de juntar o resto em "Outros". */
  topN: number;
  /** Título escolhido pela pessoa; sem ele vale o automático (chartTitle). */
  title?: string;
};

export const TOP_N_OPTIONS = [3, 4, 5, 6, 8, 10];

/**
 * Valida e completa uma configuração (vinda do disco ou do formulário): troca o que ficou incompatível pelo primeiro
 * valor válido e zera o que o visual não usa. `null` quando nem o visual existe.
 */
export function normalizeChart(raw: unknown): ChartConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const visual = VISUAL_BY_ID.get(r.visual as VisualId);
  if (!visual) return null;
  const options = compatibleMeasures(visual.id);
  if (options.length === 0) return null;
  const measure = options.find((m) => m.id === r.measure) ?? options[0];
  const dimIds = measure.dims.map((d) => d.id);
  const pick = (v: unknown) => (dimIds.includes(v as DimId) ? (v as DimId) : dimIds[0]);
  const goal = typeof r.goal === 'number' && Number.isFinite(r.goal) && r.goal > 0 ? r.goal : measure.unit === 'money' ? 10000 : 10;
  const topN = typeof r.topN === 'number' && Number.isInteger(r.topN) && r.topN >= 3 && r.topN <= 12 ? r.topN : 6;
  const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 60) : undefined;
  return {
    visual: visual.id,
    measure: measure.id,
    dimension: ['parts', 'ranking', 'distribution', 'hierarchy'].includes(visual.shape) ? pick(r.dimension) : undefined,
    dimension2: visual.shape === 'hierarchy' ? dimIds.find((d) => d === r.dimension2 && d !== pick(r.dimension)) ?? dimIds.find((d) => d !== pick(r.dimension)) : undefined,
    stackBy: visual.shape === 'stacked' ? pick(r.stackBy) : undefined,
    goal: visual.shape === 'goal' ? goal : undefined,
    granularity: r.granularity === 'day' ? 'day' : 'week',
    compare: visual.shape === 'series' && r.compare === true,
    topN,
    title,
  };
}

/** Troca o visual mantendo o que for compatível (a medida, o corte e o resto voltam a ser validados). */
export const withVisual = (cfg: ChartConfig, visual: VisualId): ChartConfig => normalizeChart({ ...cfg, visual }) ?? cfg;

/** Título automático: "Valor ganho por responsável", "Leads novos por semana", "Funil · Oportunidades por etapa". */
export function chartTitle(cfg: ChartConfig): string {
  if (cfg.title) return cfg.title;
  const m = MEASURE_BY_ID.get(cfg.measure);
  const v = VISUAL_BY_ID.get(cfg.visual);
  if (!m || !v) return 'Gráfico';
  const dimLabel = (id?: DimId) => m.dims.find((d) => d.id === id)?.label.toLowerCase();
  switch (v.shape) {
    case 'series': return `${m.label} por ${cfg.granularity === 'day' ? 'dia' : 'semana'}`;
    case 'stacked': return `${m.label} por ${cfg.granularity === 'day' ? 'dia' : 'semana'}, por ${dimLabel(cfg.stackBy) ?? 'grupo'}`;
    case 'parts':
    case 'ranking': return `${m.label} por ${dimLabel(cfg.dimension) ?? 'grupo'}`;
    case 'stages': return `Funil · ${m.label}`;
    case 'hierarchy': return `${m.label} por ${dimLabel(cfg.dimension) ?? 'grupo'} e ${dimLabel(cfg.dimension2) ?? 'subgrupo'}`;
    case 'matrix': return `${m.label} por dia da semana e hora`;
    case 'points': return m.label;
    case 'distribution': return `${m.label} por ${dimLabel(cfg.dimension) ?? 'grupo'}`;
    case 'goal': return `Meta · ${m.label}`;
  }
}
