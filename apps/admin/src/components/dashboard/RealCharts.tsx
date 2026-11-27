import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Gráficos de colunas dos widgets com dado real (tendência semanal, atividade por dia). Carregado sob demanda:
// recharts é pesado e só entra na página quando um destes widgets está no layout.

export type ColumnSeries = { key: string; label: string; color: string };

export default function ColumnsChart({ data, series, height = 220 }: { data: Record<string, string | number>[]; series: ColumnSeries[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={40} />
          <Tooltip cursor={{ fill: 'var(--bg-surface-hover)' }} contentStyle={{ border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }} />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
