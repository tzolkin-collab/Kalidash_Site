import type { MetricKind } from '../../lib/paidMedia';
import { formatCurrency } from '../../lib/format';

export function show(v: number | null, kind: MetricKind): string {
  if (v === null) return '—';
  if (kind === 'money') return formatCurrency(Math.round(v) / 100);
  if (kind === 'pct') return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) < 0.1 ? 2 : 0 })}%`;
  if (kind === 'times') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×`;
  return v.toLocaleString('pt-BR');
}
