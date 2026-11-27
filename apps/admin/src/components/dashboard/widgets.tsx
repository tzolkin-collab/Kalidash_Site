import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Clock, FileSearch, Megaphone, ShieldAlert, TrendingUp, UserRound, XCircle, CalendarDays, ClipboardList, Filter, GitBranch, LineChart as LineIcon, PieChart as PieIcon, Radar as RadarIcon, ScatterChart as ScatterIcon, Target, Trophy, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import type { LeadMetrics, OriginRow, TaskMetrics } from '../../lib/dashboardMetrics';
import type { SalesMetrics, Period } from '../../lib/salesMetrics';
import { PERIODS } from '../../lib/salesMetrics';
import { shortSource } from '../../lib/sourceName';
import { topRows } from '../../lib/commercialMetrics';
import type { Cycle, DayPoint, FirstContact, Row, WeekPoint, WinRate } from '../../lib/commercialMetrics';
import type { ChangeEntry } from '../../domain';
import type { TaskItem } from '../../domain';
import type { Opportunity } from '../../types';
import type { WidgetSpec, Span } from '../../lib/dashboardLayout';
import { StageBadge } from '../cells';
import { Badge, CustomSelect, EmptyState, StatCard } from '../ui';
import { FunnelShape } from './FunnelShape';

// Catálogo de widgets da Dashboard. Cada widget sabe se desenhar a partir dos mesmos números de sempre
// (DashData, calculado em pages/Dashboard.tsx); o layout (ordem, largura, quem aparece) é de cada pessoa
// e mora em lib/dashboardLayout.ts. Os "Exemplos" usam os gráficos da galeria, com números inventados.

const Columns = lazy(() => import('./RealCharts'));
const DemoSeries = lazy(() => import('./DemoWidgets').then((m) => ({ default: m.SeriesDemo })));
const DemoOther = lazy(() => import('./DemoWidgets').then((m) => ({ default: m.OtherDemo })));
type OtherId = Parameters<typeof import('./DemoWidgets').OtherDemo>[0]['id'];
type SeriesMode = Parameters<typeof import('./DemoWidgets').SeriesDemo>[0]['mode'];

export type StageRow = { id: string; label: string; color: string; count: number; value: number; isLead?: boolean };

export type DashData = {
  period: Period;
  loading: boolean;
  realLeads: boolean;
  realTasks: boolean;
  stats: SalesMetrics & { total: number; conversion: number; byStage: StageRow[]; biggest: Opportunity[] };
  lm: LeadMetrics;
  origins: OriginRow[];
  tm: TaskMetrics;
  late: TaskItem[];
  /** Histórico de mudanças carregado (só com o CRM na API). */
  realHistory: boolean;
  /** Números do "Hoje": o período escolhido e a variação contra o anterior (null = sem base). */
  hero: { wonCents: number; wonCount: number; wonDelta: number | null; newLeads: number; leadsDelta: number | null; hasPrevious: boolean; /** Últimas 12 semanas, para o mini gráfico. */ wonSpark: number[]; leadsSpark: number[] };
  c: {
    owners: Row[]; lost: Row[]; lostCents: number; cycle: Cycle; winRate: WinRate; trend: WeekPoint[]; byPipeline: Row[];
    firstContact: FirstContact; discard: Row[]; campaigns: Row[];
    actPerson: Row[]; actKinds: Row[]; actDays: DayPoint[]; reveals: { total: number; recent: ChangeEntry[] }; tasksByAssignee: Row[];
  };
  navigate: (path: string) => void;
  /** Métricas do site (GA4, GET /api/site-metrics). */
  site: SiteState;
  /** Qual funil o widget de funil mostra e como trocar. */
  funnel: { pipelineId?: string; name: string; options: { id: string; name: string }[]; choose: (id: string) => void };
};

export type SiteTotals = { users: number; newUsers: number; sessions: number; views: number; engagementRate: number; avgSessionSeconds: number };
export type SiteMetrics = {
  configured: true; period: string; from: string; to: string; totals: SiteTotals; previous: SiteTotals | null;
  daily: { date: string; users: number; sessions: number }[]; pages: { path: string; title: string; views: number; users: number }[];
  channels: { label: string; sessions: number }[]; sources: { label: string; sessions: number }[]; fetchedAt: string;
};
export type SiteState =
  | { status: 'loading' } | { status: 'forbidden' } | { status: 'offline' }
  | { status: 'unconfigured'; error?: string } | { status: 'error'; error: string } | { status: 'ok'; data: SiteMetrics };

export type WidgetGroup = 'Vendas' | 'Site' | 'Leads' | 'Tarefas' | 'Atividade' | 'Exemplos';
export const GROUPS: WidgetGroup[] = ['Vendas', 'Site', 'Leads', 'Tarefas', 'Atividade', 'Exemplos'];

export type WidgetDef = WidgetSpec & {
  title: string;
  group: WidgetGroup;
  description: string;
  Icon: LucideIcon;
  /** Números inventados da galeria, não do CRM. */
  example?: boolean;
  render: (d: DashData) => ReactNode;
};

const percent = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;
const periodLabel = (p: Period) => PERIODS.find((x) => x.id === p)?.label ?? '';

const KPI_SPANS: Span[] = [3, 4, 6];
const PANEL_SPANS: Span[] = [4, 6, 8, 12];

/** Número que só existe com o servidor ligado (leads e tarefas reais): sem ele mostra o traço e a razão. */
const live = (real: boolean, node: ReactNode) => (real ? node : '—');
const offlineHint = (real: boolean, hint: ReactNode) => (real ? hint : 'Aparece com o servidor conectado');

const kpi = (
  id: string, title: string, group: WidgetGroup, Icon: LucideIcon, description: string, _inDefault: boolean,
  render: (d: DashData) => ReactNode, defaultSpan: Span = 3,
): WidgetDef => ({ id, title, group, Icon, description, inDefault: false, defaultSpan, spans: KPI_SPANS, render });

function FunnelBars({ rows, max, color }: { rows: { key: string; label: string; count: number; color: string }[]; max: number; color?: string }) {
  return (
    <div className="funnel">
      {rows.map((r) => (
        <div key={r.key} className="funnel-row">
          <span className="funnel-label">{r.label}</span>
          <div className="funnel-track" aria-hidden="true"><div className="funnel-bar" style={{ width: `${(r.count / Math.max(1, max)) * 100}%`, background: color ?? r.color }} /></div>
          <span className="funnel-count">{r.count}</span>
        </div>
      ))}
    </div>
  );
}


/** Ranking em barras: a largura vem de `amount` e o texto à direita de `text`. */
function RankBars({ rows, empty, color = 'var(--accent)' }: { rows: { key: string; label: string; amount: number; text: string }[]; empty: ReactNode; color?: string }) {
  if (rows.length === 0) return <>{empty}</>;
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <div className="funnel">
      {rows.map((r) => (
        <div key={r.key} className="funnel-row funnel-row-rank">
          <span className="funnel-label" title={r.label}>{r.label}</span>
          <div className="funnel-track" aria-hidden="true"><div className="funnel-bar" style={{ width: `${(r.amount / max) * 100}%`, background: color }} /></div>
          <span className="funnel-count">{r.text}</span>
        </div>
      ))}
    </div>
  );
}

const countRows = (rows: Row[], top = 6) => topRows(rows, top).map((r) => ({ key: r.label, label: r.label, amount: r.count, text: String(r.count) }));
const hours = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` : `${(h / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`);
const days = (d: number) => `${d.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${Math.round(d * 10) === 10 ? 'dia' : 'dias'}`;
const noHistory = <p className="text-xs text-muted">O histórico aparece aqui quando o servidor estiver conectado.</p>;
const noLeads = <p className="text-xs text-muted">Os leads aparecem aqui quando o servidor estiver conectado.</p>;
const emptyRows = (title: string, hint: string) => <EmptyState title={title}>{hint}</EmptyState>;

/** Widget de painel: título + corpo. `heading` troca o título conforme o período; `spans` troca as larguras permitidas. */
const panel = (
  id: string, title: string, group: WidgetGroup, Icon: LucideIcon, description: string, defaultSpan: Span,
  body: (d: DashData) => ReactNode, heading?: (d: DashData) => string, spans: Span[] = PANEL_SPANS, extra: Partial<WidgetDef> = {},
): WidgetDef => ({ id, title, group, Icon, description, defaultSpan, spans, ...extra, render: (d) => <Panel title={heading ? heading(d) : title}>{body(d)}</Panel> });

function Panel({ title, children, badge }: { title: string; children: ReactNode; badge?: ReactNode }) {
  return (
    <section className="panel-card dash-panel">
      <h2 className="section-title">{title}{badge}</h2>
      {children}
    </section>
  );
}

const ExampleBadge = <span className="dash-example-tag"><Badge tone="info">Exemplo</Badge></span>;

function example(id: string, title: string, Icon: LucideIcon, note: string, defaultSpan: Span, body: ReactNode): WidgetDef {
  return {
    id, title, group: 'Exemplos', Icon, description: `${note} Números de demonstração, não do CRM.`, example: true, defaultSpan, spans: [6, 8, 12],
    render: () => (
      <Panel title={title} badge={ExampleBadge}>
        <p className="text-xs text-muted dash-note">{note}</p>
        <Suspense fallback={<div className="page-loading" role="status">Carregando gráfico…</div>}>{body}</Suspense>
      </Panel>
    ),
  };
}

const SERIES: { id: string; title: string; mode: SeriesMode; note: string }[] = [
  { id: 'ex-line', title: 'Oportunidades criadas · linha', mode: 'line', note: 'Entradas diárias comparadas ao período anterior.' },
  { id: 'ex-area', title: 'Oportunidades criadas · área', mode: 'area', note: 'Destaca a intensidade ao longo do tempo.' },
  { id: 'ex-bars', title: 'Oportunidades criadas · colunas', mode: 'bars', note: 'Períodos lado a lado em blocos de cinco dias.' },
];

const OTHERS: { id: OtherId; title: string; note: string; Icon: LucideIcon; span: Span }[] = [
  { id: 'donut', title: 'Rosca · origem', note: 'Participação de cada origem no total.', Icon: PieIcon, span: 6 },
  { id: 'funnel', title: 'Funil · conversão', note: 'Volume que avança ou se perde por etapa.', Icon: Activity, span: 6 },
  { id: 'radial', title: 'Radial · meta', note: 'Progresso em relação a uma meta.', Icon: Target, span: 6 },
  { id: 'radar', title: 'Radar · perfil', note: 'Dimensões do processo comercial.', Icon: RadarIcon, span: 6 },
  { id: 'correlation', title: 'Dispersão · valor × prazo', note: 'Valor da oportunidade × dias até fechar.', Icon: ScatterIcon, span: 6 },
  { id: 'pareto', title: 'Pareto · concentração', note: 'Origens por volume e participação acumulada.', Icon: BarChart3, span: 12 },
  { id: 'heatmap', title: 'Heatmap · atividade', note: 'Dias e horários com mais atividade.', Icon: CalendarDays, span: 12 },
  { id: 'waterfall', title: 'Cascata · variação', note: 'Como entradas e perdas levam ao resultado.', Icon: BarChart3, span: 12 },
  { id: 'sankey', title: 'Sankey · fluxo', note: 'Caminhos das origens até o resultado.', Icon: GitBranch, span: 12 },
  { id: 'treemap', title: 'Treemap · pipeline', note: 'Origem → campanha, área proporcional ao pipeline.', Icon: BarChart3, span: 12 },
  { id: 'boxplot', title: 'Box plot · tempo para fechar', note: 'Mediana, quartis e extremos por origem.', Icon: BarChart3, span: 12 },
];


const signedPct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;

/** Variação contra o período anterior: seta e % coloridos; sem base, a razão em texto neutro. */
function Delta({ value, hasPrevious }: { value: number | null; hasPrevious: boolean }) {
  if (!hasPrevious) return <span className="dash-delta" data-tone="flat">Sem comparação em "Tudo"</span>;
  if (value === null) return <span className="dash-delta" data-tone="flat">Sem base no período anterior</span>;
  const tone = value > 0.0005 ? 'up' : value < -0.0005 ? 'down' : 'flat';
  return (
    <span className="dash-delta" data-tone={tone}>
      {tone === 'up' && <ArrowUpRight size={14} aria-hidden="true" />}
      {tone === 'down' && <ArrowDownRight size={14} aria-hidden="true" />}
      <strong>{signedPct(value)}</strong> <span>vs. período anterior</span>
    </span>
  );
}

/** Mini gráfico de linha (sem eixos) para o resumo: mostra o ritmo das últimas semanas. */
function Spark({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2 || values.every((v) => !v)) return <div className="dash-spark dash-spark-empty" aria-hidden="true" />;
  const W = 120;
  const H = 28;
  const max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - (max ? (v / max) * (H - 8) : 0)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="dash-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <polygon points={`0,${H} ${line} ${W},${H}`} className="dash-spark-area" />
      <polyline points={line} className="dash-spark-line" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="2.5" className="dash-spark-dot" />
    </svg>
  );
}

/** "Hoje": os quatro números que contam o período, sem moldura de cartão. */
function HeroToday({ d }: { d: DashData }) {
  const items: { label: string; value: ReactNode; foot: ReactNode; spark?: ReactNode }[] = [
    { label: 'Valor ganho', value: formatCurrency(d.hero.wonCents / 100), foot: <Delta value={d.hero.wonDelta} hasPrevious={d.hero.hasPrevious} />, spark: <Spark values={d.hero.wonSpark} label="Valor ganho nas últimas 12 semanas" /> },
    { label: 'Em aberto', value: formatCurrency(d.stats.openCents / 100), foot: <span className="dash-foot">{d.stats.openCount} {d.stats.openCount === 1 ? 'oportunidade' : 'oportunidades'}</span> },
    { label: 'Previsão ponderada', value: formatCurrency(d.stats.forecastCents / 100), foot: <span className="dash-foot">Valor × probabilidade da etapa</span> },
    { label: 'Leads novos', value: live(d.realLeads, d.hero.newLeads), foot: d.realLeads ? <Delta value={d.hero.leadsDelta} hasPrevious={d.hero.hasPrevious} /> : <span className="dash-foot">Aparece com o servidor conectado</span>, spark: d.realLeads ? <Spark values={d.hero.leadsSpark} label="Leads novos nas últimas 12 semanas" /> : undefined },
  ];
  return (
    <section className="dash-hero" aria-label={`Resumo · ${periodLabel(d.period)}`}>
      {items.map((it) => (
        <div key={it.label} className="dash-hero-item">
          <div className="dash-hero-label">{it.label}</div>
          <div className="dash-hero-value">{it.value}</div>
          <div className="dash-hero-foot">{it.foot}</div>
          {it.spark ?? <div className="dash-spark dash-spark-empty" aria-hidden="true" />}
        </div>
      ))}
    </section>
  );
}

type Attn = { key: string; label: string; value: number | null; state: 'alert' | 'warn' | 'ok'; hint: string; to: string };

/** "Atenção": colorido só quando há algo a resolver; senão fica neutro e diz "Em dia". */
function Attention({ d }: { d: DashData }) {
  const tiles: Attn[] = [
    { key: 'overdue', label: 'Tarefas atrasadas', value: d.realTasks ? d.tm.overdue : null, state: d.tm.overdue ? 'alert' : 'ok', hint: d.tm.overdue ? 'Prazo vencido e não concluídas' : 'Nada atrasado', to: '/tarefas' },
    { key: 'waiting', label: 'Leads aguardando contato', value: d.realLeads ? d.lm.waitingContact : null, state: d.lm.waitingContact ? 'warn' : 'ok', hint: d.lm.waitingContact ? 'Ativos sem primeiro contato' : 'Todos já foram contatados', to: '/leads' },
    { key: 'unseen', label: 'Leads não abertos', value: d.realLeads ? d.lm.unseen : null, state: d.lm.unseen ? 'warn' : 'ok', hint: d.lm.unseen ? 'Ninguém abriu ainda' : 'Todos já foram vistos', to: '/leads' },
    { key: 'soon', label: 'Vencem em 7 dias', value: d.realTasks ? d.tm.dueSoon : null, state: 'ok', hint: 'Ainda dentro do prazo', to: '/tarefas' },
  ];
  return (
    <section className="dash-attn" aria-label="Atenção">
      {tiles.map((t) => (
        <button key={t.key} type="button" className="dash-attn-tile" data-state={t.value === null ? 'idle' : t.state} onClick={() => d.navigate(t.to)}>
          <span className="dash-attn-label">{t.label}</span>
          <span className="dash-attn-value">{t.value === null ? '—' : t.value}</span>
          <span className="dash-attn-hint">{t.value === null ? 'Aparece com o servidor conectado' : t.hint}</span>
        </button>
      ))}
    </section>
  );
}


// ---- Site (Google Analytics 4) -------------------------------------------------------------------------------------

const CHANNEL_PT: Record<string, string> = {
  'Organic Search': 'Busca orgânica', Direct: 'Direto', Referral: 'Sites de referência', 'Organic Social': 'Redes sociais',
  'Paid Search': 'Busca paga', 'Paid Social': 'Redes sociais pagas', Email: 'E-mail', Display: 'Display', 'Organic Video': 'Vídeo orgânico',
  'Paid Video': 'Vídeo pago', 'Organic Shopping': 'Shopping orgânico', 'Paid Shopping': 'Shopping pago', 'Cross-network': 'Várias redes',
  Affiliates: 'Afiliados', SMS: 'SMS', 'Mobile Push Notifications': 'Notificações push', Audio: 'Áudio', Unassigned: 'Não atribuído', '(other)': 'Outros',
};
const channelPt = (c: string) => CHANNEL_PT[c] ?? c;
const sourcePt = (s: string) => s.replace('(direct) / (none)', 'Direto').replace('(not set)', 'não definido').replace(' / organic', ' · orgânico').replace(' / referral', ' · referência').replace(' / cpc', ' · pago');
const intPt = (n: number) => n.toLocaleString('pt-BR');
const ratio = (cur: number, prev: number | undefined) => (prev === undefined ? null : prev > 0 ? (cur - prev) / prev : null);
const duration = (secs: number) => { const s = Math.round(secs); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s`; };

/** Estados em que não há números: sem permissão, sem servidor, GA4 não conectado, erro do Google, carregando. */
function SiteGate({ d, children, compact = false }: { d: DashData; children: (m: SiteMetrics) => ReactNode; compact?: boolean }) {
  const s = d.site;
  if (s.status === 'ok') return <>{children(s.data)}</>;
  // Nos blocos menores o aviso é curto: a explicação completa fica no resumo do site.
  if (compact && s.status !== 'loading') return <p className="text-xs text-muted" style={{ margin: 0 }}>{s.status === 'unconfigured' ? 'Aparece quando o Google Analytics estiver conectado.' : s.status === 'forbidden' ? 'Sem permissão para ver as métricas do site.' : s.status === 'offline' ? 'Aparece com o servidor conectado.' : 'O Google Analytics não respondeu.'}</p>;
  if (s.status === 'loading') return <div className="page-loading" role="status">Carregando o Google Analytics…</div>;
  if (s.status === 'forbidden') return <EmptyState title="Sem permissão">Peça a permissão Ver métricas do site a um Admin.</EmptyState>;
  if (s.status === 'offline') return <EmptyState title="Servidor desconectado">As métricas do site vêm do Google Analytics pela API do Kalidash.</EmptyState>;
  if (s.status === 'unconfigured') return (
    <EmptyState title="Google Analytics não conectado">
      {s.error ?? 'A API precisa de GA4_PROPERTY_ID e GA4_SERVICE_ACCOUNT (uma conta de serviço com acesso de Leitor à propriedade do GA4).'}
    </EmptyState>
  );
  return <EmptyState title="O Google Analytics não respondeu">{s.error}</EmptyState>;
}

function SiteSummary({ d }: { d: DashData }) {
  return (
    <section className="panel-card dash-panel">
      <h2 className="section-title">Site · {periodLabel(d.period).toLowerCase()}</h2>
      <SiteGate d={d}>
        {(m) => {
          const p = m.previous ?? undefined;
          const has = m.previous !== null;
          const leads = d.realLeads ? d.hero.newLeads : null;
          const conv = leads !== null && m.totals.sessions > 0 ? leads / m.totals.sessions : null;
          const perSession = m.totals.sessions ? (m.totals.views / m.totals.sessions).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0';
          const items: { label: string; value: ReactNode; foot: ReactNode; spark?: ReactNode }[] = [
            { label: 'Visitantes', value: intPt(m.totals.users), foot: <Delta value={ratio(m.totals.users, p?.users)} hasPrevious={has} />, spark: <Spark values={m.daily.map((x) => x.users)} label="Visitantes por dia" /> },
            { label: 'Sessões', value: intPt(m.totals.sessions), foot: <Delta value={ratio(m.totals.sessions, p?.sessions)} hasPrevious={has} />, spark: <Spark values={m.daily.map((x) => x.sessions)} label="Sessões por dia" /> },
            { label: 'Páginas vistas', value: intPt(m.totals.views), foot: <span className="dash-foot">{perSession} por sessão · {duration(m.totals.avgSessionSeconds)} em média</span> },
            { label: 'Visita → lead', value: conv === null ? '—' : `${(conv * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, foot: <span className="dash-foot">{leads === null ? 'Aparece com o servidor conectado' : `${intPt(leads)} ${leads === 1 ? 'lead' : 'leads'} em ${intPt(m.totals.sessions)} sessões`}</span> },
          ];
          return (
            <div className="dash-hero dash-hero-flat">
              {items.map((it) => (
                <div key={it.label} className="dash-hero-item">
                  <div className="dash-hero-label">{it.label}</div>
                  <div className="dash-hero-value">{it.value}</div>
                  <div className="dash-hero-foot">{it.foot}</div>
                  {it.spark ?? <div className="dash-spark dash-spark-empty" aria-hidden="true" />}
                </div>
              ))}
            </div>
          );
        }}
      </SiteGate>
    </section>
  );
}

/** Visitantes por dia em colunas (sem biblioteca de gráfico: é uma série curta). */
function SiteDaily({ m }: { m: SiteMetrics }) {
  if (m.daily.length === 0 || m.daily.every((x) => !x.users)) return <EmptyState title="Sem visitas no período">As visitas aparecem aqui, dia a dia.</EmptyState>;
  const max = Math.max(1, ...m.daily.map((x) => x.users));
  const fmtDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  const step = Math.max(1, Math.ceil(m.daily.length / 8));
  return (
    <div className="site-daily" role="img" aria-label={`Visitantes por dia de ${fmtDay(m.from)} a ${fmtDay(m.to)}`}>
      <div className="site-daily-bars">
        {m.daily.map((x) => (
          <div key={x.date} className="site-daily-col" title={`${fmtDay(x.date)}: ${intPt(x.users)} visitantes · ${intPt(x.sessions)} sessões`}>
            <div className="site-daily-bar" style={{ height: `${Math.max(2, (x.users / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="site-daily-axis" aria-hidden="true">
        {m.daily.map((x, i) => <span key={x.date}>{i % step === 0 ? fmtDay(x.date) : ''}</span>)}
      </div>
    </div>
  );
}

const SITE_WIDGETS: WidgetDef[] = [
  { id: 'site-summary', title: 'Site · resumo', group: 'Site', Icon: LineIcon, description: 'Visitantes, sessões, páginas vistas e quantas visitas viraram lead, do Google Analytics.', inDefault: true, defaultOrder: 2.5, defaultSpan: 12, spans: [12], render: (d) => <SiteSummary d={d} /> },
  panel('site-daily', 'Visitantes por dia', 'Site', BarChart3, 'Visitantes do site em cada dia do período (Google Analytics).', 8,
    (d) => <SiteGate d={d} compact>{(m) => <SiteDaily m={m} />}</SiteGate>, (d) => `Visitantes por dia · ${periodLabel(d.period).toLowerCase()}`, [6, 8, 12], { inDefault: true, defaultOrder: 2.6 }),
  panel('site-channels', 'Origem do tráfego', 'Site', Megaphone, 'Sessões por canal: busca, direto, redes sociais, referência… (Google Analytics).', 4,
    (d) => <SiteGate d={d} compact>{(m) => <RankBars empty={emptyRows('Sem visitas no período', 'Os canais aparecem aqui quando houver visitas.')} rows={m.channels.map((c) => ({ key: c.label, label: channelPt(c.label), amount: c.sessions, text: intPt(c.sessions) }))} />}</SiteGate>,
    undefined, PANEL_SPANS, { inDefault: true, defaultOrder: 2.7 }),
  panel('site-pages', 'Páginas mais vistas', 'Site', FileSearch, 'As páginas do site com mais visualizações no período (Google Analytics).', 6,
    (d) => <SiteGate d={d} compact>{(m) => <RankBars empty={emptyRows('Sem visitas no período', 'As páginas aparecem aqui quando houver visitas.')} rows={m.pages.map((pg) => ({ key: pg.path, label: pg.path === '/' ? 'Início (/)' : pg.path, amount: pg.views, text: intPt(pg.views) }))} />}</SiteGate>),
  panel('site-sources', 'Origem / mídia', 'Site', GitBranch, 'Sessões por origem e mídia (google · orgânico, instagram · referência…), do Google Analytics.', 6,
    (d) => <SiteGate d={d} compact>{(m) => <RankBars empty={emptyRows('Sem visitas no período', 'As origens aparecem aqui quando houver visitas.')} rows={m.sources.map((c) => ({ key: c.label, label: sourcePt(c.label), amount: c.sessions, text: intPt(c.sessions) }))} />}</SiteGate>),
];

export const WIDGETS: WidgetDef[] = [
  // ---- Vendas: o padrão ----
  { id: 'hero-today', title: 'Resumo do período', group: 'Vendas', Icon: TrendingUp, description: 'Valor ganho, em aberto, previsão e leads novos, com a variação contra o período anterior.', inDefault: true, defaultOrder: 1, defaultSpan: 12, spans: [12], render: (d) => <HeroToday d={d} /> },
  { id: 'attention', title: 'Atenção', group: 'Vendas', Icon: ShieldAlert, description: 'O que precisa de ação agora: tarefas atrasadas, leads sem contato e sem abrir.', inDefault: true, defaultOrder: 2, defaultSpan: 12, spans: [12], render: (d) => <Attention d={d} /> },
  // ---- Vendas ----
  kpi('kpi-open', 'Oportunidades abertas', 'Vendas', Filter, 'Quantas estão em andamento.', true, (d) => <StatCard label="Oportunidades abertas" value={d.stats.openCount} hint={`${d.stats.total} no total`} />, 4),
  kpi('kpi-open-value', 'Valor em aberto', 'Vendas', Filter, 'Soma de tudo que está em andamento.', true, (d) => <StatCard label="Valor em aberto" value={formatCurrency(d.stats.openCents / 100)} hint="Tudo que está em andamento" />, 4),
  kpi('kpi-forecast', 'Previsão ponderada', 'Vendas', Target, 'Valor × probabilidade da etapa.', true, (d) => (
    <StatCard label="Previsão ponderada" value={formatCurrency(d.stats.forecastCents / 100)} hint={d.stats.openWithoutProbability ? `Valor × probabilidade da etapa · ${d.stats.openWithoutProbability} sem probabilidade ficam de fora` : 'Valor × probabilidade da etapa'} />
  ), 4),
  kpi('kpi-won', 'Valor ganho', 'Vendas', Trophy, 'Contratos ganhos no período escolhido.', true, (d) => (
    <StatCard label="Valor ganho" value={formatCurrency(d.stats.wonCents / 100)} tone="success" hint={`${d.stats.wonCount} ${d.stats.wonCount === 1 ? 'contrato' : 'contratos'} · ${periodLabel(d.period).toLowerCase()}`} />
  ), 4),
  kpi('kpi-ticket', 'Ticket médio', 'Vendas', Trophy, 'Média do valor ganho no período.', true, (d) => <StatCard label="Ticket médio" value={formatCurrency(d.stats.averageCents / 100)} hint="Média do valor ganho no período" />, 4),
  kpi('kpi-conversion', 'Taxa de conversão', 'Vendas', Trophy, 'Ganhas sobre o total.', true, (d) => <StatCard label="Taxa de conversão" value={percent(d.stats.conversion)} hint="Ganhas sobre o total" />, 4),
  {
    id: 'funnel', title: 'Funil por etapa', group: 'Vendas', Icon: Filter, description: 'Leads e oportunidades em cada etapa do funil que você escolher.', inDefault: true, defaultOrder: 5, defaultSpan: 6, spans: PANEL_SPANS,
    render: (d) => (
      <section className="panel-card dash-panel">
        <div className="funnel-head">
          <h2 className="section-title">Funil por etapa</h2>
          {d.funnel.options.length > 1 ? (
            <CustomSelect className="select select-sm funnel-pick" value={d.funnel.pipelineId ?? ''} onChange={(e) => d.funnel.choose(e.target.value)} aria-label="Funil mostrado">
              {d.funnel.options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </CustomSelect>
          ) : d.funnel.name ? <span className="text-xs text-muted">{d.funnel.name}</span> : null}
        </div>
        {!d.funnel.pipelineId
          ? <EmptyState title="Nenhum funil ativo">Crie um funil em Oportunidades para ver as etapas aqui.</EmptyState>
          : d.stats.byStage.every((s) => s.count === 0) && !d.loading
            ? <EmptyState title="Funil vazio">Nenhum lead ou oportunidade nas etapas de {d.funnel.name}.</EmptyState>
            : <FunnelShape steps={d.stats.byStage.map((s) => ({ key: s.id, label: s.label, amount: s.count, text: String(s.count), sub: s.isLead ? (s.count === 1 ? 'lead' : 'leads') : formatCurrency(s.value), color: s.color }))} />}
      </section>
    ),
  },
  {
    id: 'biggest', title: 'Maiores oportunidades abertas', group: 'Vendas', Icon: Trophy, description: 'As cinco maiores em andamento, da maior para a menor.', inDefault: true, defaultOrder: 6, defaultSpan: 6, spans: PANEL_SPANS,
    render: (d) => (
      <Panel title="Maiores oportunidades abertas">
        {d.stats.biggest.length === 0 ? (
          <EmptyState title="Nada em aberto">As oportunidades abertas aparecem aqui, da maior para a menor.</EmptyState>
        ) : (
          <ul className="top-list">
            {d.stats.biggest.map((o) => (
              <li key={o.id}>
                <button type="button" className="top-item" onClick={() => d.navigate('/oportunidades')}>
                  <span className="cell-stack"><span className="cell-primary">{o.title}</span><span className="text-xs text-muted">{o.companyName || o.contactName || 'Sem contato'}</span></span>
                  <StageBadge stage={o.stage} opp={o} />
                  <span className="font-semibold">{formatCurrency(o.value)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    ),
  },
  // ---- Vendas: comercial ----
  panel('sales-by-owner', 'Ganho por responsável', 'Vendas', UserRound, 'Valor ganho e contratos de cada pessoa no período.', 6, (d) => (
    <RankBars
      rows={d.c.owners.slice(0, 6).map((r) => ({ key: r.label, label: r.label, amount: r.cents ?? 0, text: `${formatCurrency((r.cents ?? 0) / 100)} · ${r.count}` }))}
      empty={emptyRows('Nada ganho no período', 'Os contratos ganhos aparecem aqui, por responsável.')}
    />
  ), (d) => `Ganho por responsável · ${periodLabel(d.period).toLowerCase()}`),
  panel('trend', 'Criadas e ganhas por semana', 'Vendas', TrendingUp, 'Oportunidades criadas e ganhas nas últimas 8 semanas.', 12, (d) => (
    d.c.trend.every((w) => !w.created && !w.won)
      ? emptyRows('Nada nas últimas 8 semanas', 'As oportunidades criadas e ganhas aparecem aqui, semana a semana.')
      : <Suspense fallback={<div className="page-loading" role="status">Carregando gráfico…</div>}>
      <Columns data={d.c.trend.map((w) => ({ label: w.label, created: w.created, won: w.won }))} series={[{ key: 'created', label: 'Criadas', color: '#C9C4F5' }, { key: 'won', label: 'Ganhas', color: '#6755DE' }]} />
    </Suspense>
  ), undefined, [8, 12], { inDefault: true, defaultOrder: 3, defaultSpan: 8 }),
  panel('lost-reasons', 'Motivos de perda', 'Vendas', XCircle, 'Por que as oportunidades se perdem, em todo o histórico.', 6, (d) => (
    <RankBars
      color="var(--danger, #dc2626)"
      rows={topRows(d.c.lost, 6).map((r) => ({ key: r.label, label: r.label, amount: r.count, text: `${r.count} · ${formatCurrency((r.cents ?? 0) / 100)}` }))}
      empty={emptyRows('Nenhuma perda registrada', 'Quando uma oportunidade for perdida, o motivo aparece aqui.')}
    />
  )),
  panel('by-pipeline', 'Valor em aberto por funil', 'Vendas', Filter, 'Quanto há em andamento em cada funil.', 6, (d) => (
    <RankBars
      rows={d.c.byPipeline.slice(0, 6).map((r) => ({ key: r.label, label: r.label, amount: r.cents ?? 0, text: `${formatCurrency((r.cents ?? 0) / 100)} · ${r.count}` }))}
      empty={emptyRows('Nada em aberto', 'As oportunidades abertas aparecem aqui, por funil.')}
    />
  )),
  kpi('kpi-win-rate', 'Taxa de vitória', 'Vendas', Trophy, 'Ganhas sobre ganhas + perdidas, em todo o histórico.', false, (d) => (
    <StatCard label="Taxa de vitória" value={d.c.winRate.won + d.c.winRate.lost ? percent(d.c.winRate.rate) : '—'} tone={d.c.winRate.rate >= 0.5 ? 'success' : undefined} hint={`${d.c.winRate.won} ganhas · ${d.c.winRate.lost} perdidas`} />
  ), 4),
  kpi('kpi-cycle', 'Ciclo de venda', 'Vendas', Clock, 'Dias da criação até o ganho, das ganhas no período.', false, (d) => (
    <StatCard label="Ciclo de venda" value={d.c.cycle.count ? days(d.c.cycle.medianDays) : '—'} hint={d.c.cycle.count ? `Mediana de ${d.c.cycle.count} ${d.c.cycle.count === 1 ? 'venda' : 'vendas'} · média ${days(d.c.cycle.avgDays)}` : 'Sem vendas ganhas no período'} />
  ), 4),
  kpi('kpi-lost-value', 'Valor perdido', 'Vendas', XCircle, 'Soma das oportunidades perdidas, em todo o histórico.', false, (d) => (
    <StatCard label="Valor perdido" value={formatCurrency(d.c.lostCents / 100)} tone={d.c.lostCents ? 'danger' : undefined} hint={`${d.stats.lostCount} ${d.stats.lostCount === 1 ? 'oportunidade' : 'oportunidades'}`} />
  ), 4),
  // ---- Leads ----
  kpi('kpi-leads-active', 'Leads ativos', 'Leads', Users, 'Leads em aberto e quantos ainda não foram abertos.', true, (d) => <StatCard label="Leads ativos" value={live(d.realLeads, d.lm.active)} hint={offlineHint(d.realLeads, `${d.lm.unseen} ainda não ${d.lm.unseen === 1 ? 'foi aberto' : 'foram abertos'}`)} />),
  kpi('kpi-leads-new', 'Novos no período', 'Leads', Users, 'Leads que entraram no período escolhido.', true, (d) => <StatCard label="Novos no período" value={live(d.realLeads, d.lm.newInPeriod)} hint={offlineHint(d.realLeads, periodLabel(d.period))} />),
  kpi('kpi-leads-waiting', 'Aguardando contato', 'Leads', Users, 'Ativos sem primeiro contato.', true, (d) => <StatCard label="Aguardando contato" value={live(d.realLeads, d.lm.waitingContact)} tone={d.realLeads && d.lm.waitingContact ? 'warning' : undefined} hint={offlineHint(d.realLeads, 'Ativos sem primeiro contato')} />),
  kpi('kpi-leads-qualified', 'Qualificados', 'Leads', Users, 'Qualificados e a taxa de qualificação.', true, (d) => <StatCard label="Qualificados" value={live(d.realLeads, d.lm.qualified)} tone="success" hint={offlineHint(d.realLeads, `${d.lm.discarded} descartados · ${percent(d.lm.qualifiedRate)} de qualificação`)} />),
  kpi('kpi-first-contact', 'Tempo até o 1º contato', 'Leads', Clock, 'Mediana entre o lead entrar e alguém falar com ele.', false, (d) => (
    <StatCard label="Tempo até o 1º contato" value={live(d.realLeads, d.c.firstContact.count ? hours(d.c.firstContact.medianHours) : '—')} hint={offlineHint(d.realLeads, d.c.firstContact.count ? `${percent(d.c.firstContact.within24h)} em até 24 h · ${periodLabel(d.period).toLowerCase()}` : 'Nenhum lead contatado no período')} />
  ), 4),
  panel('discard-reasons', 'Motivos de descarte', 'Leads', XCircle, 'Por que os leads são descartados, em todo o histórico.', 6, (d) => (
    !d.realLeads ? noLeads : <RankBars color="var(--danger, #dc2626)" rows={countRows(d.c.discard)} empty={emptyRows('Nenhum descarte', 'Os motivos dos leads descartados aparecem aqui.')} />
  )),
  panel('lead-campaigns', 'Leads por campanha', 'Leads', Megaphone, 'Campanha (UTM) de onde veio cada lead do período.', 6, (d) => (
    !d.realLeads ? noLeads : <RankBars rows={countRows(d.c.campaigns)} empty={emptyRows('Nenhum lead no período', 'As campanhas dos leads aparecem aqui.')} />
  ), (d) => `Leads por campanha · ${periodLabel(d.period).toLowerCase()}`),
  // ---- Tarefas ----
  kpi('kpi-tasks-open', 'Tarefas abertas', 'Tarefas', ClipboardList, 'Tarefas não concluídas e as sem prazo.', true, (d) => <StatCard label="Tarefas abertas" value={live(d.realTasks, d.tm.open)} hint={offlineHint(d.realTasks, `${d.tm.noDue} sem prazo`)} />),
  kpi('kpi-tasks-overdue', 'Atrasadas', 'Tarefas', ClipboardList, 'Prazo vencido e não concluída.', true, (d) => <StatCard label="Atrasadas" value={live(d.realTasks, d.tm.overdue)} tone={d.realTasks && d.tm.overdue ? 'danger' : undefined} hint={offlineHint(d.realTasks, 'Prazo vencido e não concluída')} />),
  kpi('kpi-tasks-soon', 'Vencem em 7 dias', 'Tarefas', ClipboardList, 'Ainda dentro do prazo.', true, (d) => <StatCard label="Vencem em 7 dias" value={live(d.realTasks, d.tm.dueSoon)} hint={offlineHint(d.realTasks, 'Ainda dentro do prazo')} />),
  kpi('kpi-tasks-done', 'Concluídas no período', 'Tarefas', ClipboardList, 'Tarefas concluídas no período escolhido.', true, (d) => <StatCard label="Concluídas no período" value={live(d.realTasks, d.tm.doneInPeriod)} tone="success" hint={offlineHint(d.realTasks, periodLabel(d.period))} />),
  panel('tasks-by-assignee', 'Tarefas abertas por responsável', 'Tarefas', UserRound, 'Quem está com quantas tarefas em aberto.', 6, (d) => (
    !d.realTasks ? <p className="text-xs text-muted">As tarefas aparecem aqui quando o servidor estiver conectado.</p>
      : <RankBars rows={countRows(d.c.tasksByAssignee)} empty={emptyRows('Nenhuma tarefa aberta', 'As tarefas abertas aparecem aqui, por responsável.')} />
  )),
  {
    id: 'late', title: 'O que está atrasado', group: 'Tarefas', Icon: ClipboardList, description: 'As tarefas vencidas, da mais antiga para a mais nova.', defaultSpan: 6, spans: PANEL_SPANS,
    render: (d) => (
      <Panel title="O que está atrasado">
        {!d.realTasks ? <p className="text-xs text-muted">As tarefas aparecem aqui quando o servidor estiver conectado.</p>
          : d.late.length === 0 ? <EmptyState title="Nada atrasado">As tarefas com prazo vencido aparecem aqui, da mais antiga para a mais nova.</EmptyState>
          : (
            <ul className="top-list">
              {d.late.map((t) => (
                <li key={t.id}>
                  <button type="button" className="top-item" onClick={() => d.navigate('/tarefas')}>
                    <span className="cell-stack"><span className="cell-primary">{t.title}</span><span className="text-xs text-muted">{t.entityName}{t.assignee ? ` · ${t.assignee}` : ''}</span></span>
                    <span className="text-xs text-muted">prazo {new Date(t.dueAt as string).toLocaleDateString('pt-BR')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </Panel>
    ),
  },
  // ---- Atividade ----
  panel('activity-by-person', 'Atividade por pessoa', 'Atividade', UserRound, 'Ações de cada pessoa da equipe no período.', 6, (d) => (
    !d.realHistory ? noHistory : <RankBars rows={countRows(d.c.actPerson)} empty={emptyRows('Sem atividade no período', 'As ações da equipe aparecem aqui.')} />
  ), (d) => `Atividade por pessoa · ${periodLabel(d.period).toLowerCase()}`),
  panel('activity-kinds', 'Tipos de ação', 'Atividade', FileSearch, 'Criações, edições, qualificações, descartes e outras ações.', 6, (d) => (
    !d.realHistory ? noHistory : <RankBars rows={countRows(d.c.actKinds)} empty={emptyRows('Sem atividade no período', 'As ações aparecem aqui, por tipo.')} />
  ), (d) => `Tipos de ação · ${periodLabel(d.period).toLowerCase()}`),
  panel('activity-by-day', 'Atividade por dia', 'Atividade', Activity, 'Ações registradas nos últimos 14 dias.', 12, (d) => (
    !d.realHistory ? noHistory : (
      <Suspense fallback={<div className="page-loading" role="status">Carregando gráfico…</div>}>
        <Columns height={180} data={d.c.actDays.map((x) => ({ label: x.label, count: x.count }))} series={[{ key: 'count', label: 'Ações', color: '#6755DE' }]} />
      </Suspense>
    )
  ), undefined, [8, 12]),
  panel('cpf-reveals', 'CPFs revelados', 'Atividade', ShieldAlert, 'Quem viu CPF no período (auditoria da LGPD).', 6, (d) => (
    !d.realHistory ? noHistory : d.c.reveals.total === 0 ? emptyRows('Nenhum CPF revelado', 'Cada vez que alguém revelar um CPF, aparece aqui com quem e quando.') : (
      <>
        <p className="funnel-count" style={{ fontSize: 28, margin: '0 0 8px' }}>{d.c.reveals.total}</p>
        <ul className="top-list">
          {d.c.reveals.recent.map((h) => (
            <li key={h.id}><div className="top-item"><span className="cell-stack"><span className="cell-primary">{h.actor}</span><span className="text-xs text-muted">{h.entityName}</span></span><span className="text-xs text-muted">{new Date(h.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span></div></li>
          ))}
        </ul>
      </>
    )
  ), (d) => `CPFs revelados · ${periodLabel(d.period).toLowerCase()}`),
  {
    id: 'origins', title: 'Origem dos leads', group: 'Leads', Icon: PieIcon, description: 'De onde vêm os leads do período, por fonte.', inDefault: true, defaultOrder: 4, defaultSpan: 4, spans: PANEL_SPANS,
    render: (d) => (
      <Panel title="Origem dos leads">
        {!d.realLeads ? <p className="text-xs text-muted">Os leads aparecem aqui quando o servidor estiver conectado.</p>
          : d.origins.length === 0 ? <EmptyState title="Nenhum lead no período">Os leads que entrarem por formulário, LP ou cadastro aparecem aqui por fonte.</EmptyState>
          : <FunnelBars max={d.origins[0].count} rows={d.origins.map((o) => ({ key: `${o.origin}-${o.label}`, label: shortSource(o.label), count: o.count, color: o.origin === 'INBOUND' ? 'var(--accent)' : 'var(--text-muted)' }))} />}
      </Panel>
    ),
  },
  ...SITE_WIDGETS,
  // ---- Exemplos (galeria) ----
  ...SERIES.map((s) => example(s.id, s.title, LineIcon, s.note, 12, <DemoSeries mode={s.mode} />)),
  ...OTHERS.map((o) => example(`ex-${o.id}`, o.title, o.Icon, o.note, o.span, <DemoOther id={o.id} />)),
];

export const WIDGET_BY_ID = new Map(WIDGETS.map((w) => [w.id, w]));
