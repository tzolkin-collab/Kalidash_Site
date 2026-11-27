import { formatCurrency } from '../../lib/format';
import { MIN_BASE, rate } from '../../lib/acquisitionMetrics';

export const money = (cents: number) => formatCurrency(Math.round(cents) / 100);
export const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: v < 0.1 ? 1 : 0 })}%`);
export const SMALL = `Menos de ${MIN_BASE} casos: a taxa ainda não diz nada.`;
/** Proporção com base suficiente vira %, abaixo disso mostra a contagem ("1 de 3"). */
export const share = (n: number, base: number) => (rate(n, base) === null ? `${n} de ${base}` : pct(rate(n, base)));
export const times = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })}×`);
export const moneyOrDash = (c: number | null) => (c === null ? '—' : money(c));
const compactMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
export const compact = (v: number, isMoney: boolean) => (isMoney ? compactMoney.format(v / 100) : v.toLocaleString('pt-BR'));
export const dayLabel = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
