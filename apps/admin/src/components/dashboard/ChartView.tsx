import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '../../lib/format';
import type { ChartResult, RowsResult, SeriesResult, StackedResult, StagesResult } from '../../lib/chartData';
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
/** Valor inteiro para tooltip e rótulos: R$ 1.234,00 ou 1.234. */
export const fmt = (n: number, unit: Unit) => (unit === 'money' ? formatCurrency(n) : int.format(n));
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

export default function ChartView({ cfg, result, height = 240 }: { cfg: ChartConfig; result: ChartResult; height?: number }) {
  switch (result.kind) {
    case 'series': return <Series cfg={cfg} r={result} height={height} />;
    case 'stacked': return <Stacked r={result} height={height} />;
    case 'stages': return <Stages r={result} />;
    case 'rows':
      return cfg.visual === 'donut' ? <Donut r={result} height={Math.min(height, 220)} /> : cfg.visual === 'pareto' ? <Pareto r={result} height={height} /> : <Bars r={result} />;
  }
}
