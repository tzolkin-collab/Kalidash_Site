import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Point, Unit } from '../../lib/analyticsSeries';
import { compact, dayLabel, money } from './format';

// Linha do período atual (área leve) contra o anterior (tracejado). Um eixo só; carregado sob demanda (recharts).

const UNIT: Record<Unit, string> = { day: 'Dia', week: 'Semana', month: 'Mês' };

export default function TrendChart({ points, unit, label, isMoney, height = 280 }: { points: Point[]; unit: Unit; label: string; isMoney: boolean; height?: number }) {
  // Período anterior todo zerado não vira linha: seria só um traço no eixo.
  const hasPrev = points.some((p) => !!p.previous);
  const value = (v: number) => (isMoney ? money(v) : v.toLocaleString('pt-BR'));
  const when = (p: Point) => (unit === 'day' ? dayLabel(p.end) : `${dayLabel(p.start)} a ${dayLabel(p.end)}`);
  return (
    <figure className="an-chart" aria-label={`${label} ao longo do período`}>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
            <XAxis dataKey="end" tickFormatter={dayLabel} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} minTickGap={28} tickMargin={8} />
            <YAxis orientation="right" allowDecimals={false} tickFormatter={(v: number) => compact(v, isMoney)} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} width={isMoney ? 72 : 36} />
            <Tooltip
              cursor={{ stroke: 'var(--border-focus)' }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
                if (!p) return null;
                return (
                  <div className="an-tip">
                    <div className="an-tip-when">{UNIT[unit]}: {when(p)}</div>
                    <div><span className="an-key" />{label} <strong>{value(p.current)}</strong></div>
                    {p.previous !== null && <div><span className="an-key" data-prev />Período anterior <strong>{value(p.previous)}</strong></div>}
                  </div>
                );
              }}
            />
            {hasPrev && <Line dataKey="previous" type="linear" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />}
            <Area dataKey="current" type="linear" stroke="var(--accent)" strokeWidth={2} fill="var(--accent)" fillOpacity={0.08} dot={false} activeDot={{ r: 4, stroke: 'var(--bg-surface)', strokeWidth: 2 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {hasPrev && (
        <figcaption className="an-legend">
          <span><span className="an-key" />Período escolhido</span>
          <span><span className="an-key" data-prev />Período anterior</span>
        </figcaption>
      )}
    </figure>
  );
}
