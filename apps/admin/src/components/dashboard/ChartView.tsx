import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, SunburstChart, Tooltip, Treemap, XAxis, YAxis } from 'recharts';
import type { TreemapNode } from 'recharts';
import { formatCurrency } from '../../lib/format';
import type { BoxResult, ChartResult, GoalResult, MatrixResult, PointsResult, RowsResult, SeriesResult, StackedResult, StagesResult, TreeResult } from '../../lib/chartData';
import { OTHERS } from '../../lib/chartData';
import type { ChartConfig, Unit } from '../../lib/chartSpec';

// Desenha o resultado de runChart (lib/chartData.ts) no visual escolhido. Um só lugar para cores, formatação e
// tooltip: mudou aqui, mudou em todo gráfico configurável. Carregado sob demanda (recharts é pesado).

const CURRENT = '#6755DE';
const PREVIOUS = '#C9C4F5';
const NEUTRAL = '#C9CBD6';
/** Roxos da marca primeiro; depois tons distintos para quando há muitos grupos. */
const PALETTE = ['#6755DE', '#9184F1', '#B9B0F7', '#3B82F6', '#0EA5A4', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#64748B', '#EF4444', '#84CC16'];
const colorOf = (label: string, i: number) => (label === OTHERS ? NEUTRAL : PALETTE[i % PALETTE.length]);

const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
/** Valor inteiro para tooltip e rótulos: R$ 1.234,00 ou 1.234. */
export const fmt = (n: number, unit: Unit) => (unit === 'money' ? formatCurrency(n) : unit === 'days' ? `${dec.format(n)} ${Math.abs(n - 1) < 0.05 ? 'dia' : 'dias'}` : int.format(n));
/** Valor curto para o eixo: R$ 1,2 mil. */
const axis = (n: number, unit: Unit) => {
  const abs = Math.abs(n);
  const v = abs >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : abs >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : int.format(n);
  return unit === 'money' ? `R$ ${v}` : v;
};

const TICK = { fontSize: 11, fill: 'var(--text-muted)' };
const TOOLTIP = { border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 };
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;

function Series({ cfg, r, height }: { cfg: ChartConfig; r: SeriesResult; height: number }) {
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={TICK} interval="preserveStartEnd" minTickGap={18} />
      <YAxis axisLine={false} tickLine={false} tick={TICK} width={r.unit === 'money' ? 64 : 40} allowDecimals={false} tickFormatter={(v: number) => axis(v, r.unit)} />
      <Tooltip contentStyle={TOOLTIP} formatter={(v) => fmt(Number(v), r.unit)} cursor={{ stroke: 'var(--border-focus)' }} />
      {r.hasPrev && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
    </>
  );
  const margin = { top: 8, right: 8, bottom: 0, left: 0 };
  return (
    <ResponsiveContainer width="100%" height={height}>
      {cfg.visual === 'columns' ? (
        <BarChart data={r.points} margin={margin} barCategoryGap="22%">
          {common}
          {r.hasPrev && <Bar dataKey="prev" name="Período anterior" fill={PREVIOUS} radius={[3, 3, 0, 0]} isAnimationActive={false} />}
          <Bar dataKey="value" name="Período atual" fill={CURRENT} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      ) : cfg.visual === 'area' ? (
        <AreaChart data={r.points} margin={margin}>
          {common}
          {r.hasPrev && <Area dataKey="prev" name="Período anterior" stroke={NEUTRAL} fill={PREVIOUS} fillOpacity={0.25} strokeDasharray="4 3" isAnimationActive={false} />}
          <Area dataKey="value" name="Período atual" stroke={CURRENT} fill={CURRENT} fillOpacity={0.14} strokeWidth={2} isAnimationActive={false} />
        </AreaChart>
      ) : (
        <LineChart data={r.points} margin={margin}>
          {common}
          {r.hasPrev && <Line dataKey="prev" name="Período anterior" stroke={NEUTRAL} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
          <Line dataKey="value" name="Período atual" stroke={CURRENT} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

function Stacked({ r, height }: { r: StackedResult; height: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={r.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={TICK} interval="preserveStartEnd" minTickGap={18} />
        <YAxis axisLine={false} tickLine={false} tick={TICK} width={r.unit === 'money' ? 64 : 40} allowDecimals={false} tickFormatter={(v: number) => axis(v, r.unit)} />
        <Tooltip contentStyle={TOOLTIP} formatter={(v) => fmt(Number(v), r.unit)} cursor={{ fill: 'var(--bg-surface-hover)' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {r.groups.map((g, i) => <Bar key={g} dataKey={g} stackId="s" fill={colorOf(g, i)} isAnimationActive={false} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

function Donut({ r, height }: { r: RowsResult; height: number }) {
  return (
    <div className="cv-donut" style={{ height }}>
      <div className="cv-donut-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={r.rows} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="var(--bg-surface)" strokeWidth={2} isAnimationActive={false}>
              {r.rows.map((row, i) => <Cell key={row.label} fill={colorOf(row.label, i)} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP} formatter={(v, name) => [fmt(Number(v), r.unit), name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="cv-legend">
        {r.rows.map((row, i) => (
          <li key={row.label}>
            <i style={{ background: colorOf(row.label, i) }} />
            <span className="cv-legend-label" title={row.label}>{row.label}</span>
            <b>{fmt(row.value, r.unit)}</b>
            <span className="cv-legend-pct">{pct(r.total ? row.value / r.total : 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bars({ r }: { r: RowsResult }) {
  const max = Math.max(1, ...r.rows.map((x) => x.value));
  return (
    <div className="funnel">
      {r.rows.map((row, i) => (
        <div key={row.label} className="funnel-row funnel-row-rank">
          <span className="funnel-label" title={row.label}>{row.label}</span>
          <div className="funnel-track" aria-hidden="true"><div className="funnel-bar" style={{ width: `${(row.value / max) * 100}%`, background: row.label === OTHERS ? NEUTRAL : CURRENT, opacity: i === 0 ? 1 : 0.82 }} /></div>
          <span className="funnel-count">{fmt(row.value, r.unit)}</span>
        </div>
      ))}
    </div>
  );
}

function Pareto({ r, height }: { r: RowsResult; height: number }) {
  const data = r.rows.map((row, i) => ({ label: row.label, value: row.value, acc: r.total ? r.rows.slice(0, i + 1).reduce((n, x) => n + x.value, 0) / r.total : 0 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={TICK} interval={0} />
        <YAxis yAxisId="v" axisLine={false} tickLine={false} tick={TICK} width={r.unit === 'money' ? 64 : 40} allowDecimals={false} tickFormatter={(v: number) => axis(v, r.unit)} />
        <YAxis yAxisId="p" orientation="right" domain={[0, 1]} axisLine={false} tickLine={false} tick={TICK} width={40} tickFormatter={pct} />
        <Tooltip contentStyle={TOOLTIP} formatter={(v, name) => [name === 'Acumulado' ? pct(Number(v)) : fmt(Number(v), r.unit), name]} cursor={{ fill: 'var(--bg-surface-hover)' }} />
        <Bar yAxisId="v" dataKey="value" name="Valor" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={d.label} fill={d.label === OTHERS ? NEUTRAL : CURRENT} fillOpacity={i === 0 ? 1 : 0.85} />)}
        </Bar>
        <Line yAxisId="p" dataKey="acc" name="Acumulado" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Stages({ r }: { r: StagesResult }) {
  const max = Math.max(1, ...r.rows.map((x) => x.value));
  return (
    <div className="funnel">
      {r.rows.map((row) => (
        <div key={row.label} className="funnel-row funnel-row-rank">
          <span className="funnel-label" title={row.label}>{row.label}</span>
          <div className="funnel-track" aria-hidden="true"><div className="funnel-bar" style={{ width: `${(row.value / max) * 100}%`, background: row.color }} /></div>
          <span className="funnel-count">{fmt(row.value, r.unit)}</span>
        </div>
      ))}
    </div>
  );
}


// ---- Hierarquia: treemap e sunburst ---------------------------------------------------------------------------------

const lighten = (hex: string) => `${hex}CC`;

function Tree({ cfg, r, height }: { cfg: ChartConfig; r: TreeResult; height: number }) {
  if (cfg.visual === 'sunburst') {
    const data = {
      name: 'Total',
      value: r.total, // o recharts calcula os ângulos a partir do valor da raiz
      children: r.nodes.map((n, i) => ({ name: n.name, value: n.value, fill: colorOf(n.name, i), children: n.children.map((k) => ({ name: k.name, value: k.value, fill: lighten(colorOf(n.name, i)) })) })),
    };
    return (
      <div className="cv-donut" style={{ height: Math.min(height, 260) }}>
        <div className="cv-donut-chart" style={{ flexBasis: '52%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <SunburstChart data={data} dataKey="value" nameKey="name" innerRadius={26} ringPadding={2} padding={2} startAngle={-90} endAngle={360} textOptions={{ opacity: 0, fontSize: '0px' }}>
              <Tooltip contentStyle={TOOLTIP} formatter={(v, name) => [fmt(Number(v), r.unit), name]} />
            </SunburstChart>
          </ResponsiveContainer>
        </div>
        <ul className="cv-legend">
          {r.nodes.map((n, i) => (
            <li key={n.name}><i style={{ background: colorOf(n.name, i) }} /><span className="cv-legend-label" title={n.name}>{n.name}</span><b>{fmt(n.value, r.unit)}</b><span className="cv-legend-pct">{pct(r.total ? n.value / r.total : 0)}</span></li>
          ))}
        </ul>
      </div>
    );
  }
  const data = r.nodes.map((n, i) => ({ name: n.name, fill: colorOf(n.name, i), children: n.children.map((k) => ({ name: k.name, size: k.value, fill: lighten(colorOf(n.name, i)) })) }));
  const content = (node: TreemapNode) => {
    const leaf = !node.children?.length;
    const fill = String(node.fill ?? PALETTE[0]);
    return (
      <g>
        <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={4} fill={leaf ? fill : 'var(--bg-surface-hover)'} stroke="var(--bg-surface)" strokeWidth={leaf ? 2 : 3} />
        {!leaf && node.depth > 0 && node.width > 70 && node.height > 26 && <text x={node.x + 9} y={node.y + 17} fill="var(--text-secondary)" stroke="none" fontSize={11} fontWeight={700}>{node.name}</text>}
        {leaf && node.width > 54 && node.height > 26 && <text x={node.x + 8} y={node.y + 18} fill="#fff" stroke="none" fontSize={11} fontWeight={600}>{node.name}</text>}
      </g>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap data={data} dataKey="size" nameKey="name" aspectRatio={1.8} nodeInset={22} content={content} isAnimationActive={false}>
        <Tooltip contentStyle={TOOLTIP} formatter={(v, name) => [fmt(Number(v), r.unit), name]} />
      </Treemap>
    </ResponsiveContainer>
  );
}

// ---- Mapa de calor ----------------------------------------------------------------------------------------------------

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function Heatmap({ r }: { r: MatrixResult }) {
  return (
    <div className="cv-heat" role="table" aria-label="Mapa de calor por dia da semana e hora">
      <div className="cv-heat-hours" aria-hidden="true">
        <span />
        {Array.from({ length: 24 }, (_, h) => <span key={h}>{h % 3 === 0 ? `${h}h` : ''}</span>)}
      </div>
      {r.cells.map((row, d) => (
        <div key={WEEKDAYS[d]} className="cv-heat-row" role="row">
          <span className="cv-heat-day">{WEEKDAYS[d]}</span>
          {row.map((v, h) => (
            <span key={h} role="cell" className="cv-heat-cell" title={`${WEEKDAYS[d]}, ${h}h: ${fmt(v, r.unit)}`} style={{ background: v ? CURRENT : 'var(--bg-surface-hover)', opacity: v ? 0.18 + 0.82 * (v / r.max) : 1 }} />
          ))}
        </div>
      ))}
      <div className="cv-heat-scale text-xs text-muted"><span>Menos</span><i /><span>Mais ({fmt(r.max, r.unit)} no pico)</span></div>
    </div>
  );
}

// ---- Dispersão ----------------------------------------------------------------------------------------------------------

function Points({ r, height }: { r: PointsResult; height: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
        <CartesianGrid stroke="var(--border-subtle)" />
        <XAxis type="number" dataKey="x" name="Dias até fechar" axisLine={false} tickLine={false} tick={TICK} unit=" d" label={{ value: 'Dias até fechar', position: 'insideBottom', offset: -10, fontSize: 11, fill: 'var(--text-muted)' }} />
        <YAxis type="number" dataKey="y" name="Valor" axisLine={false} tickLine={false} tick={TICK} width={64} tickFormatter={(v: number) => axis(v, r.unit)} />
        <Tooltip contentStyle={TOOLTIP} cursor={{ strokeDasharray: '3 3' }} formatter={(v, name) => [name === 'Valor' ? fmt(Number(v), r.unit) : fmt(Number(v), 'days'), name]} />
        <Scatter data={r.points} fill={CURRENT} fillOpacity={0.75} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ---- Box plot -------------------------------------------------------------------------------------------------------------

function Box({ r }: { r: BoxResult }) {
  const max = Math.max(1, ...r.rows.map((x) => x.max));
  const at = (n: number) => `${(n / max) * 100}%`;
  return (
    <div className="cv-box">
      {r.rows.map((row) => (
        <div key={row.label} className="cv-box-row">
          <span className="cv-box-label" title={`${row.label} · ${row.n} ${row.n === 1 ? 'venda' : 'vendas'}`}>{row.label}</span>
          <div className="cv-box-track" title={`Mín ${fmt(row.min, 'days')} · Q1 ${fmt(row.q1, 'days')} · Mediana ${fmt(row.median, 'days')} · Q3 ${fmt(row.q3, 'days')} · Máx ${fmt(row.max, 'days')}`}>
            <i className="cv-box-whisker" style={{ left: at(row.min), width: `calc(${at(row.max)} - ${at(row.min)})` }} />
            <i className="cv-box-body" style={{ left: at(row.q1), width: `max(4px, calc(${at(row.q3)} - ${at(row.q1)}))` }} />
            <i className="cv-box-median" style={{ left: at(row.median) }} />
          </div>
          <span className="cv-box-value">{fmt(row.median, 'days')}</span>
        </div>
      ))}
      <div className="cv-box-axis text-xs text-muted"><span>0</span><span>{fmt(max / 2, 'days')}</span><span>{fmt(max, 'days')}</span></div>
      <p className="text-xs text-muted" style={{ margin: '6px 0 0' }}>Caixa: do 1º ao 3º quartil · traço: mediana · linha: do menor ao maior.</p>
    </div>
  );
}

// ---- Meta (radial) ----------------------------------------------------------------------------------------------------------

function Goal({ r }: { r: GoalResult }) {
  const rate = Math.min(1, Math.max(0, r.rate));
  const R = 52;
  const C = 2 * Math.PI * R;
  const done = r.rate >= 1;
  return (
    <div className="cv-goal">
      <svg viewBox="0 0 140 140" className="cv-goal-ring" role="img" aria-label={`${pct(r.rate)} da meta`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--bg-surface-hover)" strokeWidth="14" />
        {rate > 0 && <circle cx="70" cy="70" r={R} fill="none" stroke={done ? 'var(--dash-up, #008a52)' : CURRENT} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${C * rate} ${C}`} transform="rotate(-90 70 70)" />}
        <text x="70" y="76" textAnchor="middle" fontSize="26" fontWeight="600" fill="var(--text-primary)">{pct(r.rate)}</text>
      </svg>
      <div className="cv-goal-text">
        <strong>{fmt(r.value, r.unit)}</strong>
        <span>de {fmt(r.goal, r.unit)}</span>
        <span className="text-xs text-muted">{done ? 'Meta batida' : `Faltam ${fmt(Math.max(0, r.goal - r.value), r.unit)}`}</span>
      </div>
    </div>
  );
}

export default function ChartView({ cfg, result, height = 240 }: { cfg: ChartConfig; result: ChartResult; height?: number }) {
  switch (result.kind) {
    case 'series': return <Series cfg={cfg} r={result} height={height} />;
    case 'stacked': return <Stacked r={result} height={height} />;
    case 'stages': return <Stages r={result} />;
    case 'tree': return <Tree cfg={cfg} r={result} height={height} />;
    case 'matrix': return <Heatmap r={result} />;
    case 'points': return <Points r={result} height={height} />;
    case 'box': return <Box r={result} />;
    case 'goal': return <Goal r={result} />;
    case 'rows':
      return cfg.visual === 'donut' ? <Donut r={result} height={Math.min(height, 220)} /> : cfg.visual === 'pareto' ? <Pareto r={result} height={height} /> : <Bars r={result} />;
  }
}
