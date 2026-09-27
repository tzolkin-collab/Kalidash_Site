import { useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, CircleHelp, GitBranch, LineChart as LineIcon, PieChart as PieIcon, Radar as RadarIcon, ScatterChart as ScatterIcon, Sparkles, Target, Waves } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Funnel,
  FunnelChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Rectangle,
  Sankey,
  Scatter,
  ScatterChart,
  Cell,
  SunburstChart,
  Treemap,
  type TreemapNode,
  type BarShapeProps,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './analytics-chart-gallery.css';

type ChartMode = 'line' | 'smooth' | 'step' | 'dots' | 'scatter' | 'area' | 'range-area' | 'stacked-area' | 'share-area' | 'bars' | 'horizontal' | 'stacked' | 'composed';
type DayPoint = { date: string; fullDate: string; current: number; previous: number };
type BucketPoint = { date: string; current: number; previous: number };

const CURRENT = [6, 8, 5, 7, 9, 4, 11, 8, 6, 9, 13, 10, 11, 9, 14, 12, 7, 13, 15, 11, 9, 16, 12, 17, 14, 12, 18, 15, 10, 19];
const PREVIOUS = [4, 7, 6, 8, 9, 4, 10, 7, 5, 8, 12, 9, 11, 10, 14, 12, 10, 13, 16, 11, 9, 15, 12, 17, 14, 13, 18, 15, 12, 19];

const MODES: { id: ChartMode; label: string; Icon: typeof LineIcon }[] = [
  { id: 'line', label: 'Linha', Icon: LineIcon },
  { id: 'smooth', label: 'Suave', Icon: Waves },
  { id: 'area', label: 'Área', Icon: Waves },
  { id: 'range-area', label: 'Faixa', Icon: Waves },
  { id: 'share-area', label: 'Participação', Icon: Waves },
  { id: 'step', label: 'Degraus', Icon: Activity },
  { id: 'dots', label: 'Pontos', Icon: Sparkles },
  { id: 'scatter', label: 'Dispersão', Icon: Sparkles },
  { id: 'bars', label: 'Colunas', Icon: BarChart3 },
  { id: 'horizontal', label: 'Horizontal', Icon: BarChart3 },
  { id: 'stacked', label: 'Empilhadas', Icon: BarChart3 },
  { id: 'stacked-area', label: 'Área empilhada', Icon: Waves },
  { id: 'composed', label: 'Composto', Icon: Activity },
];

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const pct = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

function makeDays(): DayPoint[] {
  const today = new Date();
  return CURRENT.map((current, index) => {
    const date = new Date(today);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (CURRENT.length - 1 - index));
    return {
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''),
      fullDate: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
      current,
      previous: PREVIOUS[index],
    };
  });
}

function makeBuckets(days: DayPoint[]): BucketPoint[] {
  return Array.from({ length: 6 }, (_, bucket) => {
    const points = days.slice(bucket * 5, bucket * 5 + 5);
    return {
      date: `${points[0].date.split(' ')[0]}–${points.at(-1)?.date.split(' ')[0]}`,
      current: sum(points.map((point) => point.current)),
      previous: sum(points.map((point) => point.previous)),
    };
  });
}

function ChartSurface({ mode, days, buckets, compact = false }: { mode: ChartMode; days: DayPoint[]; buckets: BucketPoint[]; compact?: boolean }) {
  const isBucketMode = mode === 'bars' || mode === 'horizontal' || mode === 'stacked';
  const data = isBucketMode ? buckets : days;
  const chartHeight = compact ? 168 : 326;
  const tickCount = 6;

  const common = (
    <>
      <CartesianGrid vertical={false} stroke="#ECECF2" strokeDasharray="0" />
      <XAxis
        dataKey="date"
        axisLine={false}
        tickLine={false}
        interval={isBucketMode ? 0 : 'preserveStartEnd'}
        minTickGap={isBucketMode ? 0 : 22}
        tick={{ fill: '#8A8D9B', fontSize: compact ? 10 : 11, fontFamily: 'Source Sans 3' }}
        dy={10}
      />
      <YAxis
        axisLine={false}
        tickLine={false}
        width={30}
        domain={mode === 'share-area' ? [0, 1] : [0, isBucketMode ? 'auto' : 24]}
        tickCount={tickCount}
        tickFormatter={mode === 'share-area' ? (value) => `${Math.round(Number(value) * 100)}%` : undefined}
        tick={{ fill: '#A0A2AD', fontSize: 10, fontFamily: 'Source Sans 3' }}
        dx={-3}
      />
      <Tooltip
        cursor={{ stroke: '#B8B8C7', strokeDasharray: '3 5' }}
        contentStyle={{ border: '1px solid #E7E7EF', borderRadius: 9, boxShadow: '0 10px 30px rgba(31, 26, 62, .12)', fontSize: 12, fontFamily: 'Source Sans 3' }}
        labelStyle={{ color: '#2B2940', fontWeight: 600, marginBottom: 6 }}
        itemStyle={{ color: '#58576A', padding: '2px 0' }}
        formatter={(value, name) => [String(value), name === 'current' ? 'Período atual' : 'Período anterior']}
        labelFormatter={(label, payload) => payload[0]?.payload.fullDate ?? String(label)}
      />
    </>
  );

  return (
    <div className={`idea-chart idea-chart-${mode} ${compact ? 'is-compact' : ''}`} style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        {mode === 'horizontal' ? (
          <BarChart data={buckets} layout="vertical" margin={{ top: 4, right: 14, left: 2, bottom: 4 }} barGap={5} barCategoryGap="24%">
            <CartesianGrid horizontal={false} stroke="#ECECF2" />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#8A8D9B', fontSize: compact ? 9 : 10, fontFamily: 'Source Sans 3' }} />
            <YAxis dataKey="date" type="category" axisLine={false} tickLine={false} width={compact ? 40 : 48} tick={{ fill: '#8A8D9B', fontSize: compact ? 9 : 10, fontFamily: 'Source Sans 3' }} />
            <Tooltip cursor={{ fill: '#F7F6FC' }} contentStyle={{ border: '1px solid #E7E7EF', borderRadius: 9, boxShadow: '0 10px 30px rgba(31, 26, 62, .12)', fontSize: 12, fontFamily: 'Source Sans 3' }} formatter={(value, name) => [String(value), name === 'current' ? 'Período atual' : 'Período anterior']} />
            <Bar dataKey="previous" fill="#CCD0DA" radius={[0, 4, 4, 0]} maxBarSize={compact ? 10 : 16} isAnimationActive={false} />
            <Bar dataKey="current" fill="#6857E8" radius={[0, 4, 4, 0]} maxBarSize={compact ? 10 : 16} isAnimationActive={false} />
          </BarChart>
        ) : mode === 'scatter' ? (
          <ScatterChart margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke="#ECECF2" />
            <XAxis type="number" dataKey="x" domain={[0, 29]} ticks={[0, 5, 10, 15, 20, 25, 29]} tickFormatter={(value) => days[Math.round(Number(value))]?.date ?? ''} axisLine={false} tickLine={false} tick={{ fill: '#8A8D9B', fontSize: compact ? 9 : 10, fontFamily: 'Source Sans 3' }} dy={10} />
            <YAxis type="number" dataKey="y" domain={[0, 24]} width={30} tickCount={6} axisLine={false} tickLine={false} tick={{ fill: '#A0A2AD', fontSize: 10, fontFamily: 'Source Sans 3' }} />
            <Tooltip cursor={{ stroke: '#B8B8C7', strokeDasharray: '3 5' }} contentStyle={{ border: '1px solid #E7E7EF', borderRadius: 9, boxShadow: '0 10px 30px rgba(31, 26, 62, .12)', fontSize: 12, fontFamily: 'Source Sans 3' }} formatter={(value, name) => [String(value), name]} labelFormatter={(_, payload) => payload[0]?.payload.fullDate ?? ''} />
            <Scatter name="Período anterior" data={days.map((point, index) => ({ x: index - 0.12, y: point.previous, fullDate: point.fullDate }))} fill="#B6BAC5" isAnimationActive={false} />
            <Scatter name="Período atual" data={days.map((point, index) => ({ x: index + 0.12, y: point.current, fullDate: point.fullDate }))} fill="#6857E8" stroke="#FFFFFF" strokeWidth={1.5} isAnimationActive={false} />
          </ScatterChart>
        ) : mode === 'stacked-area' ? (
          <AreaChart data={days} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id={compact ? 'ideaStackedAreaSmall' : 'ideaStackedArea'} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#725FE9" stopOpacity={0.2} />
                <stop offset="92%" stopColor="#725FE9" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {common}
            <Area dataKey="previous" stackId="periods" type="linear" stroke="#B6BAC5" strokeWidth={1.4} fill="#CCD0DA" fillOpacity={0.28} isAnimationActive={false} />
            <Area dataKey="current" stackId="periods" type="linear" stroke="#6A57E5" strokeWidth={2.3} fill={`url(#${compact ? 'ideaStackedAreaSmall' : 'ideaStackedArea'})`} activeDot={{ r: 4, strokeWidth: 2, stroke: '#FFFFFF', fill: '#6A57E5' }} isAnimationActive={false} />
          </AreaChart>
        ) : mode === 'share-area' ? (
          <AreaChart data={days} stackOffset="expand" margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke="#ECECF2" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={22} tick={{ fill: '#8A8D9B', fontSize: compact ? 10 : 11, fontFamily: 'Source Sans 3' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} width={34} domain={[0, 1]} tickCount={5} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} tick={{ fill: '#A0A2AD', fontSize: 10, fontFamily: 'Source Sans 3' }} />
            <Tooltip cursor={{ stroke: '#B8B8C7', strokeDasharray: '3 5' }} contentStyle={{ border: '1px solid #E7E7EF', borderRadius: 9, boxShadow: '0 10px 30px rgba(31, 26, 62, .12)', fontSize: 12, fontFamily: 'Source Sans 3' }} formatter={(value, name) => [`${Math.round(Number(value) * 100)}%`, name === 'current' ? 'Período atual' : 'Período anterior']} labelFormatter={(label, payload) => payload[0]?.payload.fullDate ?? String(label)} />
            <Area dataKey="previous" stackId="share" type="monotone" stroke="#B6BAC5" strokeWidth={1.4} fill="#D9DCE4" fillOpacity={0.78} isAnimationActive={false} />
            <Area dataKey="current" stackId="share" type="monotone" stroke="#6A57E5" strokeWidth={2.2} fill="#7564E9" fillOpacity={0.82} activeDot={{ r: 4, strokeWidth: 2, stroke: '#FFFFFF', fill: '#6A57E5' }} isAnimationActive={false} />
          </AreaChart>
        ) : mode === 'range-area' ? (
          <AreaChart data={days.map((point) => ({ ...point, range: [Math.max(0, point.current - 3), point.current + 4] }))} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            {common}
            <Area dataKey="range" type="linear" stroke="#8A7BEC" strokeWidth={1.4} fill="#8A7BEC" fillOpacity={0.16} activeDot={false} isAnimationActive={false} />
            <Line dataKey="current" type="linear" stroke="#5D4ACF" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#FFFFFF', fill: '#5D4ACF' }} isAnimationActive={false} />
          </AreaChart>
        ) : mode === 'stacked' ? (
          <BarChart data={buckets} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} barCategoryGap="32%">
            {common}
            <Bar dataKey="previous" stackId="periods" fill="#CCD0DA" maxBarSize={compact ? 22 : 34} isAnimationActive={false} />
            <Bar dataKey="current" stackId="periods" fill="#6857E8" radius={[5, 5, 0, 0]} maxBarSize={compact ? 22 : 34} isAnimationActive={false} />
          </BarChart>
        ) : mode === 'bars' ? (
          <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} barGap={5} barCategoryGap="28%">
            {common}
            <Bar dataKey="previous" fill="#CCD0DA" radius={[4, 4, 0, 0]} maxBarSize={compact ? 12 : 22} isAnimationActive={false} />
            <Bar dataKey="current" fill="#6857E8" radius={[4, 4, 0, 0]} maxBarSize={compact ? 12 : 22} isAnimationActive={false} />
          </BarChart>
        ) : mode === 'composed' ? (
          <ComposedChart data={days} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} barCategoryGap="35%">
            {common}
            <Bar dataKey="current" fill="#6857E8" fillOpacity={0.72} radius={[3, 3, 0, 0]} maxBarSize={compact ? 9 : 14} isAnimationActive={false} />
            <Line dataKey="previous" type="linear" stroke="#AEB2BE" strokeWidth={1.8} strokeDasharray="5 5" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </ComposedChart>
        ) : mode === 'area' ? (
          <AreaChart data={days} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id={compact ? 'ideaAreaFillSmall' : 'ideaAreaFill'} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#725FE9" stopOpacity={0.22} />
                <stop offset="92%" stopColor="#725FE9" stopOpacity={0.015} />
              </linearGradient>
            </defs>
            {common}
            <Area dataKey="current" type="linear" stroke="#6A57E5" strokeWidth={2.6} fill={`url(#${compact ? 'ideaAreaFillSmall' : 'ideaAreaFill'})`} activeDot={{ r: 4, strokeWidth: 2, stroke: '#FFFFFF', fill: '#6A57E5' }} isAnimationActive={false} />
            <Line dataKey="previous" type="linear" stroke="#B6BAC5" strokeWidth={1.8} strokeDasharray="5 5" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </AreaChart>
        ) : (
          <LineChart data={days} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            {common}
            <Line dataKey="previous" type={mode === 'step' ? 'stepAfter' : 'linear'} stroke={mode === 'dots' ? 'transparent' : '#B6BAC5'} strokeWidth={mode === 'dots' ? 0 : 1.8} strokeDasharray={mode === 'dots' ? undefined : '5 5'} dot={mode === 'dots' ? { r: 2.7, stroke: '#B6BAC5', strokeWidth: 1.4, fill: '#FFFFFF' } : false} activeDot={{ r: 3, strokeWidth: 2, stroke: '#FFFFFF' }} isAnimationActive={false} />
            <Line dataKey="current" type={mode === 'smooth' ? 'monotone' : mode === 'step' ? 'stepAfter' : 'linear'} stroke={mode === 'dots' ? 'transparent' : '#6A57E5'} strokeWidth={mode === 'dots' ? 0 : 2.7} dot={mode === 'dots' ? { r: 2.8, stroke: '#FFFFFF', strokeWidth: 1.2, fill: '#6A57E5' } : false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#FFFFFF', fill: '#6A57E5' }} isAnimationActive={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function Legend() {
  return (
    <div className="idea-legend" aria-label="Legenda do gráfico">
      <span><i className="idea-legend-current" /> Período atual</span>
      <span><i className="idea-legend-previous" /> Período anterior</span>
    </div>
  );
}

const OTHER_CHARTS = [
  { id: 'donut', title: 'Rosca · composição', note: 'Participação de cada origem no total', Icon: PieIcon },
  { id: 'funnel', title: 'Funil · conversão', note: 'Volume que avança ou se perde por etapa', Icon: Activity },
  { id: 'correlation', title: 'Dispersão · relação', note: 'Valor da oportunidade × dias até fechar', Icon: ScatterIcon },
  { id: 'boxplot', title: 'Box plot · distribuição', note: 'Tempo para fechar por origem · mediana, quartis e extremos', Icon: BarChart3 },
  { id: 'timeline', title: 'Timeline · duração por etapa', note: 'Tempo que cada oportunidade levou em cada etapa do ciclo', Icon: Activity },
  { id: 'pyramid', title: 'Pirâmide · comparação', note: 'Composição por etapa com os períodos espelhados em torno do zero', Icon: BarChart3 },
  { id: 'pareto', title: 'Pareto · concentração', note: 'Origens em ordem de volume e participação acumulada', Icon: BarChart3 },
  { id: 'radar', title: 'Radar · perfil', note: 'Compara dimensões do processo comercial', Icon: RadarIcon },
  { id: 'treemap', title: 'Treemap · hierarquia', note: 'Origem → campanha · área proporcional ao pipeline · passe nos blocos menores para ver detalhes', Icon: BarChart3 },
  { id: 'sunburst', title: 'Sunburst · níveis', note: 'A mesma hierarquia em anéis · compare origem, canal e participação', Icon: PieIcon },
  { id: 'sankey', title: 'Sankey · fluxo', note: 'Caminhos das origens até o resultado', Icon: GitBranch },
  { id: 'radial', title: 'Radial · meta', note: 'Progresso em relação a uma meta ou limite', Icon: Target },
  { id: 'heatmap', title: 'Heatmap · intensidade', note: 'Dias e horários com maior concentração de atividades', Icon: CalendarDays },
  { id: 'waterfall', title: 'Cascata · variação', note: 'Como entradas e perdas levam ao resultado final', Icon: BarChart3 },
] as const;

const SOURCE_DATA = [
  { name: 'Indicação', value: 38, color: '#6857E8' },
  { name: 'Orgânico', value: 27, color: '#9184F1' },
  { name: 'Mídia paga', value: 21, color: '#B9B0F7' },
  { name: 'Parcerias', value: 14, color: '#D9D4FB' },
];
const FUNNEL_DATA = [
  { name: 'Leads', value: 820, fill: '#DCD7FB' },
  { name: 'Qualificados', value: 540, fill: '#BDB4F5' },
  { name: 'Oportunidades', value: 310, fill: '#9283ED' },
  { name: 'Propostas', value: 184, fill: '#7562E5' },
  { name: 'Fechados', value: 96, fill: '#5744CF' },
];
const CORRELATION_DATA = [
  { x: 4, y: 18, z: 38 }, { x: 8, y: 12, z: 52 }, { x: 12, y: 34, z: 74 },
  { x: 16, y: 23, z: 45 }, { x: 21, y: 56, z: 91 }, { x: 26, y: 31, z: 64 },
  { x: 31, y: 72, z: 108 }, { x: 36, y: 44, z: 58 }, { x: 42, y: 86, z: 124 },
  { x: 48, y: 61, z: 82 }, { x: 54, y: 105, z: 139 }, { x: 61, y: 74, z: 96 },
  { x: 68, y: 126, z: 154 }, { x: 75, y: 91, z: 114 }, { x: 84, y: 142, z: 170 },
];
const BOX_PLOT_DATA = [
  { category: 'Indicação', min: 3, q1: 8, median: 14, q3: 22, max: 39 },
  { category: 'Orgânico', min: 5, q1: 12, median: 19, q3: 28, max: 47 },
  { category: 'Mídia paga', min: 2, q1: 6, median: 11, q3: 18, max: 32 },
  { category: 'Parcerias', min: 8, q1: 15, median: 24, q3: 34, max: 55 },
];
const TIMELINE_DATA = [
  { name: 'Norte · Enterprise', qualification: [0, 2], proposal: [2, 7], decision: [7, 13] },
  { name: 'Mira · Growth', qualification: [0, 3], proposal: [3, 6], decision: [6, 11] },
  { name: 'Orbe · Enterprise', qualification: [0, 1], proposal: [1, 8], decision: [8, 16] },
  { name: 'Lume · Scale', qualification: [0, 4], proposal: [4, 10], decision: [10, 14] },
  { name: 'Cora · Growth', qualification: [0, 2], proposal: [2, 5], decision: [5, 9] },
];
const PYRAMID_DATA = [
  { stage: 'Novos', previous: -31, current: 28 },
  { stage: 'Qualificados', previous: -24, current: 26 },
  { stage: 'Em negociação', previous: -19, current: 22 },
  { stage: 'Proposta', previous: -15, current: 17 },
  { stage: 'Fechados', previous: -11, current: 14 },
];
const PARETO_DATA = (() => {
  const values = [120, 75, 50, 35, 24, 16, 10];
  const names = ['Indicação', 'Orgânico', 'Busca paga', 'Parcerias', 'Eventos', 'Social', 'Outros'];
  const total = sum(values);
  let accumulated = 0;
  return values.map((value, index) => {
    accumulated += value;
    return { name: names[index], value, accumulated: Math.round((accumulated / total) * 100) };
  });
})();
const RADAR_DATA = [
  { dimension: 'Aquisição', atual: 82, referência: 68 },
  { dimension: 'Qualificação', atual: 72, referência: 76 },
  { dimension: 'Velocidade', atual: 64, referência: 58 },
  { dimension: 'Conversão', atual: 78, referência: 63 },
  { dimension: 'Retenção', atual: 88, referência: 80 },
];
const TREEMAP_DATA = [
  { name: 'Indicação', children: [
    { name: 'Clientes', size: 24, fill: '#6857E8' },
    { name: 'Parceiros', size: 14, fill: '#897BEF' },
  ] },
  { name: 'Orgânico', children: [
    { name: 'SEO', size: 16, fill: '#9184F1' },
    { name: 'Conteúdo', size: 11, fill: '#AAA0F4' },
  ] },
  { name: 'Mídia paga', children: [
    { name: 'Busca', size: 13, fill: '#B9B0F7' },
    { name: 'Social', size: 8, fill: '#C8C1F9' },
  ] },
  { name: 'Parcerias', children: [
    { name: 'Co-marketing', size: 9, fill: '#D0CAF9' },
    { name: 'Eventos', size: 5, fill: '#DFDBFC' },
  ] },
];
const SUNBURST_DATA = {
  name: 'Pipeline',
  children: [
    { name: 'Indicação', value: 38, fill: '#6857E8', children: [
      { name: 'Clientes', value: 24, fill: '#6857E8' },
      { name: 'Parceiros', value: 14, fill: '#897BEF' },
    ] },
    { name: 'Orgânico', value: 27, fill: '#9184F1', children: [
      { name: 'SEO', value: 16, fill: '#9184F1' },
      { name: 'Conteúdo', value: 11, fill: '#AAA0F4' },
    ] },
    { name: 'Mídia paga', value: 21, fill: '#B9B0F7', children: [
      { name: 'Busca', value: 13, fill: '#B9B0F7' },
      { name: 'Social', value: 8, fill: '#C8C1F9' },
    ] },
    { name: 'Parcerias', value: 14, fill: '#D0CAF9', children: [
      { name: 'Co-marketing', value: 9, fill: '#D0CAF9' },
      { name: 'Eventos', value: 5, fill: '#DFDBFC' },
    ] },
  ],
};
const SANKEY_DATA = {
  nodes: ['Indicação', 'Orgânico', 'Mídia paga', 'Qualificados', 'Oportunidades', 'Fechados'].map((name) => ({ name })),
  links: [
    { source: 0, target: 3, value: 92 }, { source: 1, target: 3, value: 74 }, { source: 2, target: 3, value: 58 },
    { source: 3, target: 4, value: 136 }, { source: 4, target: 5, value: 48 },
  ],
};
const GOAL_DATA = [{ name: 'Meta mensal', value: 82, fill: '#6755DE' }];
const HEATMAP_ROWS = [
  { day: 'SEG', values: [2, 3, 5, 7, 8, 6, 4, 7, 5, 2] },
  { day: 'TER', values: [3, 5, 7, 9, 8, 7, 5, 8, 6, 3] },
  { day: 'QUA', values: [2, 4, 8, 10, 9, 7, 6, 9, 6, 3] },
  { day: 'QUI', values: [1, 4, 6, 8, 7, 6, 8, 10, 7, 4] },
  { day: 'SEX', values: [1, 3, 5, 7, 8, 9, 10, 8, 5, 2] },
];
const WATERFALL_DATA = (() => {
  const steps = [
    { name: 'Base', change: 420, total: true }, { name: 'Novos', change: 110 }, { name: 'Upgrades', change: 62 },
    { name: 'Churn', change: -48 }, { name: 'Descontos', change: -24 }, { name: 'Final', change: 0, total: true },
  ];
  let running = 0;
    return steps.map((step) => {
      const start = running;
    if (step.total && step.name === 'Final') return { ...step, base: 0, amount: running, running, kind: 'total', waterfallRange: [0, running] };
    running = step.total ? step.change : running + step.change;
    const base = step.total ? 0 : Math.min(start, running);
    const amount = step.total ? running : Math.abs(step.change);
    return { ...step, base, amount, running, kind: step.total ? 'total' : step.change >= 0 ? 'up' : 'down', waterfallRange: [base, base + amount] };
  });
})();

function renderTreemapNode(node: TreemapNode) {
  const isLeaf = !node.children?.length;
  const leafFills: Record<string, string> = {
    Clientes: '#6857E8', Parceiros: '#897BEF', SEO: '#9184F1', Conteúdo: '#AAA0F4',
    Busca: '#B9B0F7', Social: '#C8C1F9', 'Co-marketing': '#D0CAF9', Eventos: '#DFDBFC',
  };
  const fill = isLeaf ? leafFills[node.name] ?? '#9184F1' : '#F8F7FC';
  const lightLabel = ['Clientes', 'Parceiros', 'SEO', 'Conteúdo'].includes(node.name);
  const textColor = lightLabel ? '#FFFFFF' : '#30294F';
  const groupTotals: Record<string, number> = { Indicação: 38, Orgânico: 27, 'Mídia paga': 21, Parcerias: 14 };
  return (
    <g>
      <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={isLeaf ? 5 : 7} fill={isLeaf ? fill : '#F8F7FC'} stroke="#FFFFFF" strokeWidth={isLeaf ? 2 : 3} />
      {!isLeaf && node.depth > 0 && node.width > 72 && node.height > 28 && <text x={node.x + 9} y={node.y + 18} fill="#514A70" stroke="none" fontSize={node.width > 104 ? 10 : 9} fontWeight={750}>{node.width > 104 ? `${node.name} · ${groupTotals[node.name]}%` : node.name}</text>}
      {isLeaf && node.width > 62 && node.height > 28 && <text x={node.x + 9} y={node.y + 21} fill={textColor} stroke={lightLabel ? '#4637A8' : 'none'} strokeOpacity={lightLabel ? 0.55 : 0} strokeWidth={lightLabel ? 2 : 0} paintOrder="stroke" strokeLinejoin="round" fontSize={11} fontWeight={700}>{node.name === 'Co-marketing' && node.width < 110 ? 'Co-mark.' : node.name}</text>}
    </g>
  );
}

function OtherChart({ id }: { id: typeof OTHER_CHARTS[number]['id'] }) {
  if (id === 'donut') return (
    <div className="idea-other-chart idea-donut-wrap">
      <ResponsiveContainer width="58%" height="100%"><PieChart>
        <Pie data={SOURCE_DATA} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3} stroke="#fff" strokeWidth={3} isAnimationActive={false}>
          {SOURCE_DATA.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
        </Pie>
        <Tooltip formatter={(value, name) => [`${value}%`, name]} contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
      </PieChart></ResponsiveContainer>
      <div className="idea-donut-legend">{SOURCE_DATA.map((entry) => <span key={entry.name}><i style={{ background: entry.color }} />{entry.name}<b>{entry.value}%</b></span>)}</div>
    </div>
  );
  if (id === 'funnel') return (
    <div className="idea-other-chart"><ResponsiveContainer width="100%" height="100%"><FunnelChart>
      <Tooltip formatter={(value) => [String(value), 'Registros']} contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
      <Funnel dataKey="value" data={FUNNEL_DATA} isAnimationActive={false}>
        {FUNNEL_DATA.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
      </Funnel>
    </FunnelChart></ResponsiveContainer></div>
  );
  if (id === 'correlation') return (
    <div className="idea-other-chart"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 12, bottom: 2, left: 0 }}>
      <CartesianGrid vertical={false} stroke="#ECECF2" />
      <XAxis type="number" dataKey="x" name="Valor" unit=" mil" domain={[0, 90]} axisLine={false} tickLine={false} tick={{ fill: '#9293a1', fontSize: 9 }} />
      <YAxis type="number" dataKey="y" name="Dias para fechar" domain={[0, 160]} width={28} axisLine={false} tickLine={false} tick={{ fill: '#9293a1', fontSize: 9 }} />
      <Tooltip cursor={{ strokeDasharray: '3 4' }} formatter={(value, name) => [String(value), name]} contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
      <Scatter data={CORRELATION_DATA} fill="#6957E8" fillOpacity={0.78} isAnimationActive={false} />
    </ScatterChart></ResponsiveContainer></div>
  );
  if (id === 'boxplot') return (
    <div className="idea-other-chart idea-boxplot"><ResponsiveContainer width="100%" height="100%"><BarChart data={BOX_PLOT_DATA} margin={{ top: 14, right: 12, bottom: 1, left: 0 }}>
      <CartesianGrid vertical={false} stroke="#ECECF2" />
      <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: '#77798b', fontSize: 9 }} />
      <YAxis type="number" domain={[0, 60]} width={29} axisLine={false} tickLine={false} tick={{ fill: '#9293a1', fontSize: 9 }} tickFormatter={(value) => `${value}d`} />
      <Tooltip labelFormatter={(label) => `Origem: ${label}`} formatter={(value) => [Array.isArray(value) ? `${value[0]}–${value[1]} dias` : String(value), 'Quartis']} contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
      <Bar dataKey={(entry) => [entry.q1, entry.q3]} fill="#A69AF3" stroke="#7562E5" strokeWidth={1} barSize={34} shape={(props: BarShapeProps) => {
        const point = props.payload as typeof BOX_PLOT_DATA[number];
        const medianY = props.height === 0 ? props.y : props.y + ((point.q3 - point.median) / (point.q3 - point.q1)) * props.height;
        return <g><Rectangle {...props} fill="#B9B0F7" stroke="#7562E5" strokeWidth={1} radius={3} /><line x1={props.x + 1} x2={props.x + props.width - 1} y1={medianY} y2={medianY} stroke="#4637A8" strokeWidth={2} /></g>;
      }} isAnimationActive={false}>
        <ErrorBar dataKey={(entry) => [entry.q1 - entry.min, entry.max - entry.q3]} width={7} stroke="#7562E5" strokeWidth={1.5} isAnimationActive={false} />
      </Bar>
    </BarChart></ResponsiveContainer></div>
  );
  if (id === 'timeline') return (
    <div className="idea-other-chart idea-timeline"><ResponsiveContainer width="100%" height="100%"><BarChart data={TIMELINE_DATA} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 4 }}>
      <CartesianGrid stroke="#ECECF2" strokeDasharray="2 4" />
      <XAxis type="number" domain={[0, 18]} tickFormatter={(value) => `${value}d`} axisLine={false} tickLine={false} tick={{ fill: '#9293a1', fontSize: 9 }} />
      <YAxis type="category" dataKey="name" width={132} axisLine={false} tickLine={false} tick={{ fill: '#77798b', fontSize: 10 }} />
      <Tooltip formatter={(value) => [Array.isArray(value) ? `${value[0]}–${value[1]} dias` : String(value), 'Intervalo']} contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
      <Bar dataKey="qualification" name="Qualificação" stackId="journey" fill="#D8D2FA" radius={4} maxBarSize={20} isAnimationActive={false} />
      <Bar dataKey="proposal" name="Proposta" stackId="journey" fill="#A99BF2" radius={4} maxBarSize={20} isAnimationActive={false} />
      <Bar dataKey="decision" name="Decisão" stackId="journey" fill="#6957E8" radius={4} maxBarSize={20} isAnimationActive={false} />
    </BarChart></ResponsiveContainer></div>
  );
  if (id === 'pyramid') return (
    <div className="idea-other-chart idea-pyramid">
      <div className="idea-pyramid-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={PYRAMID_DATA} layout="vertical" stackOffset="sign" margin={{ top: 8, right: 22, bottom: 4, left: 12 }}>
        <CartesianGrid vertical={false} stroke="#ECECF2" />
        <XAxis type="number" domain={[-40, 40]} tickFormatter={(value) => `${Math.abs(value)}%`} axisLine={false} tickLine={false} tick={{ fill: '#9293a1', fontSize: 9 }} />
        <YAxis type="category" dataKey="stage" width={104} axisLine={false} tickLine={false} tick={{ fill: '#77798b', fontSize: 9 }} />
        <ReferenceLine x={0} stroke="#D8D5E2" />
        <Tooltip formatter={(value) => [`${Math.abs(Number(value))}%`, Number(value) < 0 ? 'Período anterior' : 'Período atual']} contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="previous" name="Período anterior" stackId="period" fill="#B9B0F7" radius={[4, 0, 0, 4]} maxBarSize={20} isAnimationActive={false} />
        <Bar dataKey="current" name="Período atual" stackId="period" fill="#6957E8" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false} />
      </BarChart></ResponsiveContainer></div>
      <div className="idea-pyramid-legend"><span><i />Período anterior</span><span><i />Período atual</span></div>
    </div>
  );
  if (id === 'pareto') return (
    <div className="idea-other-chart idea-pareto"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={PARETO_DATA} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
      <CartesianGrid vertical={false} stroke="#ECECF2" />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#77798b', fontSize: 9 }} />
      <YAxis yAxisId="count" width={30} axisLine={false} tickLine={false} tick={{ fill: '#9293a1', fontSize: 9 }} />
      <YAxis yAxisId="share" orientation="right" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(value) => `${value}%`} width={38} axisLine={false} tickLine={false} tick={{ fill: '#9293a1', fontSize: 9 }} />
      <Tooltip formatter={(value, name) => [name === 'Acumulado' ? `${value}%` : String(value), name]} contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
      <ReferenceLine yAxisId="share" y={80} stroke="#B5ADEC" strokeDasharray="4 4" />
      <Bar yAxisId="count" dataKey="value" name="Oportunidades" fill="#B9B0F7" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
      <Line yAxisId="share" dataKey="accumulated" name="Acumulado" stroke="#5944CC" strokeWidth={2} dot={{ r: 3, fill: '#5944CC', stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 4 }} isAnimationActive={false} />
    </ComposedChart></ResponsiveContainer></div>
  );
  if (id === 'radar') return (
    <div className="idea-other-chart"><ResponsiveContainer width="100%" height="100%"><RadarChart data={RADAR_DATA} outerRadius="70%" margin={{ top: 8, right: 22, bottom: 4, left: 22 }}>
      <PolarGrid stroke="#EAE8F1" />
      <PolarAngleAxis dataKey="dimension" tick={{ fill: '#77798b', fontSize: 9 }} />
      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
      <Radar name="Kalidash" dataKey="atual" stroke="#6957E8" fill="#6957E8" fillOpacity={0.2} strokeWidth={2} isAnimationActive={false} />
      <Radar name="Referência" dataKey="referência" stroke="#B9BBC6" fill="#B9BBC6" fillOpacity={0.08} strokeDasharray="4 4" isAnimationActive={false} />
      <Tooltip contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
    </RadarChart></ResponsiveContainer></div>
  );
  if (id === 'treemap') return (
    <>
      <div className="idea-other-chart idea-treemap"><ResponsiveContainer width="100%" height="100%"><Treemap data={TREEMAP_DATA} dataKey="size" nameKey="name" aspectRatio={1.8} nodeInset={27} nodeGap={5} content={renderTreemapNode} isAnimationActive={false}>
        <Tooltip formatter={(value, name) => [`${value}% do pipeline`, name]} contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
      </Treemap></ResponsiveContainer></div>
      <div className="idea-treemap-analysis"><strong>Indicação lidera com 38%</strong><span>Clientes responde por 24 pontos do total.</span></div>
    </>
  );
  if (id === 'sunburst') return (
    <div className="idea-other-chart idea-sunburst">
      <div className="idea-sunburst-visual">
        <ResponsiveContainer width="100%" height="100%"><SunburstChart data={SUNBURST_DATA} dataKey="value" nameKey="name" innerRadius={34} outerRadius={100} ringPadding={3} padding={2} startAngle={-90} endAngle={270} textOptions={{ opacity: 0, fontSize: '0px' }}>
        <Tooltip formatter={(value, name) => [`${value}% do pipeline`, name]} contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
        </SunburstChart></ResponsiveContainer>
        <div className="idea-sunburst-center"><strong>100%</strong><span>pipeline</span></div>
      </div>
      <div className="idea-sunburst-legend">{SOURCE_DATA.map((entry) => <span key={entry.name}><i style={{ background: entry.color }} />{entry.name}<b>{entry.value}%</b></span>)}</div>
    </div>
  );
  if (id === 'radial') return (
    <div className="idea-other-chart idea-radial-wrap">
      <ResponsiveContainer width="100%" height="100%"><RadialBarChart data={GOAL_DATA} cx="50%" cy="58%" innerRadius="64%" outerRadius="88%" startAngle={210} endAngle={-30}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" cornerRadius={9} background={{ fill: '#EFEDF7' }} isAnimationActive={false} />
        <Tooltip formatter={(value) => [`${value}%`, 'Meta mensal']} contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
      </RadialBarChart></ResponsiveContainer>
      <div className="idea-radial-center"><strong>82%</strong><span>da meta mensal</span></div>
    </div>
  );
  if (id === 'heatmap') return (
    <div className="idea-other-chart idea-heatmap-wrap">
      <div className="idea-heatmap-hours"><span />{['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'].map((hour) => <span key={hour}>{hour}h</span>)}</div>
      <div className="idea-heatmap-body">{HEATMAP_ROWS.map((row) => <div className="idea-heatmap-row" key={row.day}><span className="idea-heatmap-day">{row.day}</span>{row.values.map((value, index) => {
        const colors = ['#F2F0FC', '#E2DDFB', '#C7BDF8', '#A491F0', '#7965E5', '#5944CC'];
        const color = colors[Math.min(colors.length - 1, Math.floor(value / 2))];
        return <span className="idea-heatmap-cell" key={`${row.day}-${index}`} style={{ background: color }} title={`${row.day}, ${String(index + 8).padStart(2, '0')}h · ${value} oportunidades`} aria-label={`${row.day}, ${String(index + 8).padStart(2, '0')} horas: ${value} oportunidades`} />;
      })}</div>)}</div>
      <div className="idea-heatmap-legend"><span>Menor volume</span><i /><i /><i /><i /><i /><i /><span>Maior</span></div>
    </div>
  );
  if (id === 'waterfall') return (
    <div className="idea-other-chart idea-waterfall-wrap"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={WATERFALL_DATA} margin={{ top: 12, right: 12, bottom: 8, left: 8 }}>
      <CartesianGrid vertical={false} stroke="#ECECF2" />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#77798b', fontSize: 10, fontFamily: 'Source Sans 3' }} />
      <YAxis width={42} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}`} tick={{ fill: '#9293a1', fontSize: 9, fontFamily: 'Source Sans 3' }} />
      <Tooltip formatter={(_, _name, item) => {
        const row = item.payload as typeof WATERFALL_DATA[number];
        const amount = row.total ? row.amount : Math.abs(row.change);
        const sign = row.total ? '' : row.change > 0 ? '+' : '−';
        return [`${sign}R$ ${amount} mil`, row.total ? 'MRR total' : 'Variação'];
      }} contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
      <Bar dataKey="waterfallRange" radius={3} maxBarSize={34} isAnimationActive={false}>
        {WATERFALL_DATA.map((entry) => <Cell key={entry.name} fill={entry.kind === 'up' ? '#4D9C83' : entry.kind === 'down' ? '#D17982' : '#6755DE'} />)}
      </Bar>
      <Line dataKey="running" type="stepAfter" stroke="#A99EF0" strokeDasharray="3 4" strokeWidth={1.2} dot={false} activeDot={false} isAnimationActive={false} />
    </ComposedChart></ResponsiveContainer></div>
  );
  return (
    <div className="idea-other-chart idea-sankey"><ResponsiveContainer width="100%" height="100%"><Sankey data={SANKEY_DATA} nodePadding={14} nodeWidth={10} link={{ stroke: '#9588ed', strokeOpacity: 0.24 }} node={{ fill: '#6957E8', stroke: '#fff' }} iterations={24}>
      <Tooltip contentStyle={{ border: '1px solid #e7e7ef', borderRadius: 8, fontSize: 11 }} />
    </Sankey></ResponsiveContainer></div>
  );
}

export default function AnalyticsChartGallery() {
  const [mode, setMode] = useState<ChartMode>('line');
  const days = useMemo(makeDays, []);
  const buckets = useMemo(() => makeBuckets(days), [days]);
  const currentTotal = sum(CURRENT);
  const previousTotal = sum(PREVIOUS);
  const growth = ((currentTotal - previousTotal) / previousTotal) * 100;
  const peak = days.reduce((best, point) => point.current > best.current ? point : best, days[0]);
  const modeDetails = {
    line: { title: 'Linha', note: 'Comparação diária no modelo aprovado', Icon: LineIcon },
    smooth: { title: 'Linha suave', note: 'Suaviza o percurso sem mudar os pontos', Icon: Waves },
    area: { title: 'Área', note: 'Destaca a intensidade ao longo do tempo', Icon: Waves },
    'range-area': { title: 'Faixa de variação', note: 'Mostra um intervalo esperado ao redor da série', Icon: Waves },
    'share-area': { title: 'Área de participação', note: 'Compara a composição percentual sem o efeito do total', Icon: Waves },
    step: { title: 'Degraus', note: 'Expõe cada mudança discreta de volume', Icon: Activity },
    dots: { title: 'Pontos ligados', note: 'Mantém a sequência sem desenhar as linhas', Icon: Sparkles },
    scatter: { title: 'Dispersão diária', note: 'Mostra cada dia como observação independente', Icon: Sparkles },
    bars: { title: 'Colunas agrupadas', note: 'Compara períodos lado a lado em blocos de cinco dias', Icon: BarChart3 },
    horizontal: { title: 'Barras horizontais', note: 'Compara os mesmos blocos em outra orientação', Icon: BarChart3 },
    stacked: { title: 'Colunas empilhadas', note: 'Soma os períodos; a comparação individual perde destaque', Icon: BarChart3 },
    'stacked-area': { title: 'Área empilhada', note: 'Mostra a soma dos períodos e reduz a leitura individual', Icon: Waves },
    composed: { title: 'Composto', note: 'Colunas atuais com período anterior em linha', Icon: Activity },
  };
  const active = modeDetails[mode];

  return (
      <div className="idea-dashboard idea-dashboard-embedded">
        <div className="idea-breadcrumb"><span>DASHBOARD</span><span className="idea-breadcrumb-dot">/</span><span>ESTUDO VISUAL</span><span className="idea-study-badge"><Sparkles size={12} /> DADOS DE DEMONSTRAÇÃO</span></div>

        <header className="idea-page-heading">
          <div>
            <h1>Modelos de gráfico</h1>
            <p>Explore as linguagens visuais. Os valores abaixo são demonstrativos e não vêm do CRM.</p>
          </div>
        </header>

        <section className="idea-main-card" aria-labelledby="idea-main-title">
          <div className="idea-main-card-head">
            <div>
              <div className="idea-overline"><span className="idea-live-dot" /> PIPELINE · OPORTUNIDADES</div>
              <h2 id="idea-main-title">Oportunidades criadas</h2>
              <p>Entradas diárias comparadas ao período anterior</p>
            </div>
            <div className="idea-chart-modes" role="tablist" aria-label="Modelo de gráfico">
              {MODES.map(({ id, label, Icon }) => (
                <button key={id} type="button" role="tab" aria-selected={mode === id} className={mode === id ? 'is-active' : ''} onClick={() => setMode(id)}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="idea-chart-summary">
            <div className="idea-chart-total">{currentTotal}<span> oportunidades</span></div>
            <div className={`idea-growth ${growth >= 0 ? 'is-positive' : 'is-negative'}`}>
              {growth >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{pct(growth)}
              <span>vs. período anterior</span>
            </div>
            <Legend />
          </div>

          <ChartSurface mode={mode} days={days} buckets={buckets} />

          <div className="idea-chart-footer">
            <span>29 dias atrás</span><span>Hoje</span>
          </div>
        </section>

        <div className="idea-under-chart">
          <section className="idea-variants" aria-labelledby="idea-variants-title">
            <div className="idea-section-heading">
              <div>
                <div className="idea-overline">MESMA SÉRIE · OUTRAS LINGUAGENS</div>
                <h2 id="idea-variants-title">Explore os modelos</h2>
              </div>
              <span>{MODES.length} modelos no mesmo sistema visual · selecione para testar</span>
            </div>
            <div className="idea-variant-grid">
              {MODES.map(({ id: variant }) => {
                const detail = modeDetails[variant];
                const Icon = detail.Icon;
                return (
                  <button key={variant} type="button" className={`idea-variant-card ${mode === variant ? 'is-selected' : ''}`} onClick={() => setMode(variant)} aria-pressed={mode === variant}>
                    <div className="idea-variant-head"><span className="idea-variant-icon"><Icon size={15} /></span><span className="idea-variant-label">{detail.title}</span>{mode === variant && <span className="idea-selected-mark">EM TESTE</span>}</div>
                    <ChartSurface mode={variant} days={days} buckets={buckets} compact />
                    <div className="idea-variant-note">{detail.note}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="idea-insight-card">
            <div className="idea-insight-top"><span className="idea-insight-icon"><Activity size={16} /></span><CircleHelp size={15} className="idea-help" /></div>
            <div className="idea-overline">PONTO DE ATENÇÃO</div>
            <h3>Um pico, sem ruído.</h3>
            <p>O melhor dia do período teve <strong>{peak.current} novas oportunidades</strong>, em {peak.date}.</p>
            <div className="idea-insight-rule" />
            <div className="idea-insight-foot"><span>MODELO DE LEITURA</span><span>{active.title.toUpperCase()}</span></div>
            <div className="idea-insight-note">{active.note}</div>
          </aside>
        </div>

        <section className="idea-other-section" aria-labelledby="idea-other-title">
          <div className="idea-section-heading">
            <div><div className="idea-overline">OUTRAS PERGUNTAS · OUTRAS FORMAS</div><h2 id="idea-other-title">Outras famílias de gráficos</h2></div>
            <span>Exemplos demonstrativos · cada modelo usa a medida adequada</span>
          </div>
          <div className="idea-other-grid">
            {OTHER_CHARTS.map(({ id, title, note, Icon }) => (
              <article className={`idea-other-card ${id === 'treemap' ? 'idea-treemap-card' : ''} ${id === 'sunburst' ? 'idea-sunburst-card' : ''} ${id === 'sankey' ? 'idea-sankey-card' : ''} ${id === 'waterfall' ? 'idea-waterfall-card' : ''} ${id === 'timeline' ? 'idea-timeline-card' : ''} ${id === 'pyramid' ? 'idea-pyramid-card' : ''} ${id === 'pareto' ? 'idea-pareto-card' : ''}`} key={id}>
                <div className="idea-variant-head"><span className="idea-variant-icon"><Icon size={15} /></span><span className="idea-variant-label">{title}</span></div>
                <OtherChart id={id} />
                <div className="idea-variant-note">{note}</div>
              </article>
            ))}
          </div>
        </section>

        <footer className="idea-page-foot"><span>Dados demonstrativos para estudo visual</span><span>KALIDASH · ANALYTICS</span></footer>
      </div>
  );
}
