import { lazy, Suspense } from 'react';
import { Page, PageHeader, SampleBanner } from '../components/ui';

const AnalyticsChartGallery = lazy(() => import('../components/dashboard/AnalyticsChartGallery'));

// Galeria de modelos de gráfico: estudo visual com números inventados. Mora numa rota própria
// (/dashboard/demonstracao) para nunca ficar ao lado das métricas reais do Dashboard.
export default function DashboardDemo() {
  return (
    <Page>
      <PageHeader title="Galeria de gráficos" subtitle="Estudo visual de modelos de gráfico." back={{ label: 'Dashboard', to: '/dashboard' }} />
      <SampleBanner>Tudo nesta página é demonstração: os números são inventados e não vêm do CRM. As métricas reais estão no Dashboard.</SampleBanner>
      <Suspense fallback={<div className="page-loading" role="status">Carregando modelos de gráfico…</div>}>
        <AnalyticsChartGallery />
      </Suspense>
    </Page>
  );
}
