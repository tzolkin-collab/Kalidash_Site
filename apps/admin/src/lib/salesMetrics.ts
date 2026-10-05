import type { Pipeline, StageKind } from '../domain';
import type { Opportunity } from '../types';

// Métricas de valor das oportunidades (Dashboard). Sem dependências de React para poder ser testado
// com `node --test`. Somas em centavos inteiros: somar reais em ponto flutuante acumula erro.

export type Period = 'month' | '30d' | '90d' | 'year' | 'all';

export const PERIODS: { id: Period; label: string }[] = [
  { id: 'month', label: 'Este mês' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: '90d', label: 'Últimos 90 dias' },
  { id: 'year', label: 'Este ano' },
  { id: 'all', label: 'Tudo' },
];

/** Etapas gravadas antes das pipelines existirem (valores soltos na coluna `stage`). */
const LEGACY: Record<string, { kind: StageKind; probability?: number }> = {
  INBOUND: { kind: 'OPEN', probability: 10 },
  QUALIFICATION: { kind: 'OPEN', probability: 20 },
  PROPOSAL: { kind: 'OPEN', probability: 40 },
  NEGOTIATION: { kind: 'OPEN', probability: 60 },
  WON: { kind: 'WON' },
  LOST: { kind: 'LOST' },
};

export type StageInfo = { kind: StageKind; probability?: number };

/** Resolve a etapa de uma oportunidade (id de pipeline ou valor legado). `undefined` = desconhecida. */
export function stageInfo(stage: string, pipelines: Pipeline[]): StageInfo | undefined {
  for (const p of pipelines) {
    const s = p.stages.find((x) => x.id === stage);
    if (s) return { kind: s.kind, probability: s.probability };
  }
  return LEGACY[stage];
}

export const toCents = (reais: number | null | undefined) => Math.round((reais || 0) * 100);

/** Início do período (ms) ou `null` para "Tudo". */
export function periodStart(period: Period, now: Date): number | null {
  switch (period) {
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    case 'year': return new Date(now.getFullYear(), 0, 1).getTime();
    case '30d': return now.getTime() - 30 * 86_400_000;
    case '90d': return now.getTime() - 90 * 86_400_000;
    default: return null;
  }
}

export type SalesMetrics = {
  openCount: number;
  openCents: number;
  /** Valor em aberto × probabilidade da etapa (previsão ponderada). */
  forecastCents: number;
  /** Abertas cuja etapa não tem probabilidade: ficam fora da previsão. */
  openWithoutProbability: number;
  wonCount: number;
  wonCents: number;
  /** Ganhas sem data de fechamento: só entram em "Tudo". */
  wonWithoutDate: number;
  averageCents: number;
  lostCount: number;
};

export function salesMetrics(opps: Opportunity[], pipelines: Pipeline[], period: Period, now = new Date()): SalesMetrics {
  const from = periodStart(period, now);
  const m: SalesMetrics = { openCount: 0, openCents: 0, forecastCents: 0, openWithoutProbability: 0, wonCount: 0, wonCents: 0, wonWithoutDate: 0, averageCents: 0, lostCount: 0 };

  for (const o of opps) {
    if (o.isLead) continue; // leads ficam fora dos totais de valor (docs/dominio.md)
    const info = stageInfo(o.stage, pipelines);
    const cents = toCents(o.value);
    if (!info || info.kind === 'LEAD') continue;

    if (info.kind === 'OPEN') {
      m.openCount++;
      m.openCents += cents;
      if (info.probability == null) m.openWithoutProbability++;
      else m.forecastCents += Math.round((cents * info.probability) / 100);
    } else if (info.kind === 'WON') {
      const at = o.wonAt ? Date.parse(o.wonAt) : NaN;
      if (Number.isNaN(at)) {
        m.wonWithoutDate++;
        if (from !== null) continue;
      } else if (from !== null && (at < from || at > now.getTime())) {
        continue;
      }
      m.wonCount++;
      m.wonCents += cents;
    } else if (info.kind === 'LOST') {
      m.lostCount++;
    }
  }
  m.averageCents = m.wonCount ? Math.round(m.wonCents / m.wonCount) : 0;
  return m;
}
