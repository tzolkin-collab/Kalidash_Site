import { useMemo } from 'react';
import { OTHER_CHARTS, OtherChart, ChartSurface, makeBuckets, makeDays } from './AnalyticsChartGallery';
import type { ChartMode } from './AnalyticsChartGallery';

// Gráficos de exemplo da galeria, prontos para virar widget da Dashboard. Os números são inventados (iguais aos
// da galeria); o catálogo marca cada um como "Exemplo". Carregado sob demanda (recharts é pesado).

export type OtherChartId = typeof OTHER_CHARTS[number]['id'];
export const OTHER_CHART_LIST = OTHER_CHARTS;

/** Série diária "Oportunidades criadas" em um dos modelos da galeria. */
export function SeriesDemo({ mode }: { mode: ChartMode }) {
  const days = useMemo(makeDays, []);
  const buckets = useMemo(() => makeBuckets(days), [days]);
  return (
    <div className="idea-dashboard-widget">
      <ChartSurface mode={mode} days={days} buckets={buckets} compact />
    </div>
  );
}

/** Um dos outros modelos (rosca, funil, pareto…). */
export function OtherDemo({ id }: { id: OtherChartId }) {
  return (
    <div className={`idea-dashboard-widget idea-${id}-card`}>
      <OtherChart id={id} />
    </div>
  );
}
