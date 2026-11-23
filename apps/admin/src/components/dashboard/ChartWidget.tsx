import { lazy, Suspense, useMemo } from 'react';
import { BUCKETS, isEmptyResult, runChart } from '../../lib/chartData';
import type { ChartCtx } from '../../lib/chartData';
import { MEASURE_BY_ID, VISUAL_BY_ID, chartTitle } from '../../lib/chartSpec';
import type { ChartConfig } from '../../lib/chartSpec';
import { PERIODS } from '../../lib/salesMetrics';
import { EmptyState } from '../ui';

const ChartView = lazy(() => import('./ChartView'));

/** A que dado o gráfico se refere, em uma frase curta (período, janela ou "situação atual"). */
export function chartScope(cfg: ChartConfig, ctx: Pick<ChartCtx, 'period'>): string {
  const m = MEASURE_BY_ID.get(cfg.measure);
  const shape = VISUAL_BY_ID.get(cfg.visual)?.shape;
  if (!m || !shape) return '';
  if (shape === 'series' || shape === 'stacked') {
    const n = BUCKETS[cfg.granularity];
    const span = cfg.granularity === 'day' ? `Últimos ${n} dias` : `Últimas ${n} semanas`;
    return cfg.compare ? `${span} · comparado ao período anterior` : span;
  }
  if (shape === 'stages') return 'Primeiro funil ativo · situação atual';
  if (m.hasDate) return PERIODS.find((p) => p.id === ctx.period)?.label ?? '';
  return m.id.startsWith('lost') ? 'Em todo o histórico' : 'Situação atual';
}

/** O gráfico em si (sem moldura): usado no widget da Dashboard e na prévia do construtor. */
export function ChartBody({ cfg, ctx, height }: { cfg: ChartConfig; ctx: ChartCtx; height?: number }) {
  const result = useMemo(() => runChart(cfg, ctx), [cfg, ctx]);
  if (isEmptyResult(result)) {
    return <EmptyState title="Sem dados para este gráfico">Nada a mostrar com esta medida e este período. Escolha outra medida ou outro período.</EmptyState>;
  }
  return (
    <Suspense fallback={<div className="page-loading" role="status">Carregando gráfico…</div>}>
      <ChartView cfg={cfg} result={result} height={height} />
    </Suspense>
  );
}

/** Widget da Dashboard: título automático (ou o escolhido), escopo e o gráfico. */
export default function ChartWidget({ cfg, ctx }: { cfg: ChartConfig; ctx: ChartCtx }) {
  return (
    <section className="panel-card dash-panel">
      <h2 className="section-title">{chartTitle(cfg)}</h2>
      <p className="text-xs text-muted dash-note">{chartScope(cfg, ctx)}</p>
      <ChartBody cfg={cfg} ctx={ctx} />
    </section>
  );
}
