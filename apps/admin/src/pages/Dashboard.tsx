import { lazy, Suspense, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatCurrency } from '../lib/format';
import { useOpportunities } from '../lib/useOpportunities';
import { useShell } from '../lib/shell';
import { StageBadge } from '../components/cells';
import { EmptyState, Page, PageHeader, StatCard } from '../components/ui';

const AnalyticsChartGallery = lazy(() => import('../components/dashboard/AnalyticsChartGallery'));

// Métricas calculadas na hora a partir de /api/leads (as oportunidades reais).
// Leads, tarefas e origem entram quando as fases 3 e 4 do plano chegarem.

const STAGES = [
  { id: 'INBOUND', label: 'Entrada', color: 'var(--pipe-triage)' },
  { id: 'QUALIFICATION', label: 'Qualificação', color: 'var(--pipe-progress)' },
  { id: 'WON', label: 'Ganho', color: 'var(--pipe-won)' },
];

const percent = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;

export default function Dashboard() {
  const { opportunities, loading, error, reload } = useOpportunities();
  const { navigate } = useShell();

  const stats = useMemo(() => {
    const won = opportunities.filter((o) => o.stage === 'WON');
    const open = opportunities.filter((o) => o.stage !== 'WON');
    const sum = (list: typeof opportunities) => list.reduce((acc, o) => acc + (o.value || 0), 0);
    return {
      total: opportunities.length,
      openCount: open.length,
      openValue: sum(open),
      wonCount: won.length,
      wonValue: sum(won),
      conversion: opportunities.length ? won.length / opportunities.length : 0,
      average: won.length ? sum(won) / won.length : 0,
      byStage: STAGES.map((s) => {
        const items = opportunities.filter((o) => o.stage === s.id);
        return { ...s, count: items.length, value: sum(items) };
      }),
      biggest: [...open].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 5),
    };
  }, [opportunities]);

  const maxCount = Math.max(1, ...stats.byStage.map((s) => s.count));

  return (
    <Page>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do funil de vendas em tempo real."
        actions={<button type="button" className="btn" onClick={reload} disabled={loading}><RefreshCw size={14} /> Atualizar</button>}
      />

      {error && <div className="opp-error" style={{ margin: '0 0 20px' }} role="alert">{error}</div>}

      <div className="stat-grid">
        <StatCard label="Oportunidades abertas" value={stats.openCount} hint={`${stats.total} no total`} />
        <StatCard label="Valor em aberto" value={formatCurrency(stats.openValue)} hint="Entrada + Qualificação" />
        <StatCard label="Valor ganho" value={formatCurrency(stats.wonValue)} tone="success" hint={`${stats.wonCount} ${stats.wonCount === 1 ? 'contrato' : 'contratos'}`} />
        <StatCard label="Taxa de conversão" value={percent(stats.conversion)} hint="Ganhas sobre o total" />
        <StatCard label="Ticket médio (ganhas)" value={formatCurrency(stats.average)} />
      </div>

      <div className="two-col">
        <section className="section panel-card">
          <h2 className="section-title">Funil por etapa</h2>
          {stats.total === 0 && !loading ? (
            <EmptyState title="Ainda não há oportunidades">Crie a primeira em Oportunidades para ver o funil.</EmptyState>
          ) : (
            <div className="funnel">
              {stats.byStage.map((s) => (
                <div key={s.id} className="funnel-row">
                  <span className="funnel-label">{s.label}</span>
                  <div className="funnel-track" aria-hidden="true">
                    <div className="funnel-bar" style={{ width: `${(s.count / maxCount) * 100}%`, background: s.color }} />
                  </div>
                  <span className="funnel-count">{s.count}</span>
                  <span className="funnel-value">{formatCurrency(s.value)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="section panel-card">
          <h2 className="section-title">Maiores oportunidades abertas</h2>
          {stats.biggest.length === 0 ? (
            <EmptyState title="Nada em aberto">As oportunidades abertas aparecem aqui, da maior para a menor.</EmptyState>
          ) : (
            <ul className="top-list">
              {stats.biggest.map((o) => (
                <li key={o.id}>
                  <button type="button" className="top-item" onClick={() => navigate('/oportunidades')}>
                    <span className="cell-stack">
                      <span className="cell-primary">{o.title}</span>
                      <span className="text-xs text-muted">{o.companyName || o.contactName || 'Sem contato'}</span>
                    </span>
                    <StageBadge stage={o.stage} />
                    <span className="font-semibold">{formatCurrency(o.value)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Suspense fallback={<div className="page-loading" role="status">Carregando modelos de gráfico…</div>}>
        <AnalyticsChartGallery />
      </Suspense>
    </Page>
  );
}
