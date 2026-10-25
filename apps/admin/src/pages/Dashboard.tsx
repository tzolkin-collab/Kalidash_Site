import { useMemo, useState } from 'react';
import { FlaskConical, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../lib/format';
import { useOpportunities } from '../lib/useOpportunities';
import { useShell } from '../lib/shell';
import { useStore } from '../lib/store';
import { pipelinesStore } from '../mocks/pipelines';
import { leadsStore } from '../mocks/leads';
import { tasksStore } from '../mocks/tasks';
import { useCrmMode } from '../lib/crmMode';
import { useSyncMode } from '../lib/workflowSync';
import { leadMetrics, leadOrigins, overdueTasks, taskMetrics } from '../lib/dashboardMetrics';
import { PERIODS, salesMetrics, stageInfo, toCents } from '../lib/salesMetrics';
import { activePipelines, kanbanStages, resolveStage } from '../lib/stages';
import type { Period } from '../lib/salesMetrics';
import { StageBadge } from '../components/cells';
import { EmptyState, Page, PageHeader, StatCard } from '../components/ui';

// Métricas calculadas na hora a partir de /api/leads (as oportunidades reais); valor ganho e ticket
// médio seguem o período escolhido (data de ganho). Contas em lib/salesMetrics.ts, em centavos.
// Leads, origem e tarefas (WP3b) vêm das mesmas stores que Leads e Tarefas e só aparecem quando o CRM e o
// workflow estão na API (dado real); com os exemplos a seção explica e não mostra número. A galeria de gráficos de demonstração
// fica em /dashboard/demonstracao (DashboardDemo.tsx), separada das métricas reais.


const percent = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;

export default function Dashboard() {
  const { opportunities, loading, error, reload } = useOpportunities();
  const { navigate } = useShell();

  const [pipelines] = useStore(pipelinesStore);
  const [period, setPeriod] = useState<Period>('month');
  const crmMode = useCrmMode();
  const syncMode = useSyncMode();
  const [leads] = useStore(leadsStore);
  const [tasks] = useStore(tasksStore);
  const realLeads = crmMode === 'api';
  const realTasks = syncMode === 'api';
  const lm = useMemo(() => leadMetrics(leads, period), [leads, period]);
  const origins = useMemo(() => leadOrigins(leads, period), [leads, period]);
  const tm = useMemo(() => taskMetrics(tasks, period), [tasks, period]);
  const late = useMemo(() => overdueTasks(tasks), [tasks]);

  const stats = useMemo(() => {
    const m = salesMetrics(opportunities, pipelines, period);
    const funnelPipeline = activePipelines(pipelines)[0];
    const isKind = (stage: string, kind: string) => stageInfo(stage, pipelines)?.kind === kind;
    const sumCents = (list: typeof opportunities) => list.reduce((acc, o) => acc + toCents(o.value), 0);
    const won = opportunities.filter((o) => isKind(o.stage, 'WON'));
    const open = opportunities.filter((o) => isKind(o.stage, 'OPEN'));
    return {
      ...m,
      total: opportunities.length,
      conversion: opportunities.length ? won.length / opportunities.length : 0,
      // Funil do primeiro funil ativo; leads e perdidas ficam de fora, como nos totais de valor.
      byStage: kanbanStages(funnelPipeline).filter((s) => s.kind !== 'LOST').map((s) => {
        const items = opportunities.filter((o) => { const r = resolveStage(o, pipelines); return r.pipeline?.id === funnelPipeline?.id && r.stage?.id === s.id; });
        return { id: s.id, label: s.name, color: s.color, count: items.length, value: sumCents(items) / 100 };
      }),
      biggest: [...open].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 5),
    };
  }, [opportunities, pipelines, period]);

  const maxCount = Math.max(1, ...stats.byStage.map((s) => s.count));

  return (
    <Page>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do funil, dos leads e das tarefas (dado real da API)."
        actions={<button type="button" className="btn" onClick={reload} disabled={loading}><RefreshCw size={14} /> Atualizar</button>}
      />

      {error && <div className="opp-error" style={{ margin: '0 0 20px' }} role="alert">{error}</div>}

      <div className="chip-row" role="group" aria-label="Período do valor ganho">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" className={`chip ${period === p.id ? 'active' : ''}`} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <StatCard label="Oportunidades abertas" value={stats.openCount} hint={`${stats.total} no total`} />
        <StatCard label="Valor em aberto" value={formatCurrency(stats.openCents / 100)} hint="Tudo que está em andamento" />
        <StatCard
          label="Previsão ponderada"
          value={formatCurrency(stats.forecastCents / 100)}
          hint={stats.openWithoutProbability ? `Valor × probabilidade da etapa · ${stats.openWithoutProbability} sem probabilidade ficam de fora` : 'Valor × probabilidade da etapa'}
        />
        <StatCard label="Valor ganho" value={formatCurrency(stats.wonCents / 100)} tone="success" hint={`${stats.wonCount} ${stats.wonCount === 1 ? 'contrato' : 'contratos'} · ${PERIODS.find((p) => p.id === period)?.label.toLowerCase()}`} />
        <StatCard label="Ticket médio" value={formatCurrency(stats.averageCents / 100)} hint="Média do valor ganho no período" />
        <StatCard label="Taxa de conversão" value={percent(stats.conversion)} hint="Ganhas sobre o total" />
      </div>
      {stats.wonWithoutDate > 0 && period !== 'all' && (
        <p className="text-xs text-muted" style={{ margin: '-8px 0 16px' }}>
          {stats.wonWithoutDate} {stats.wonWithoutDate === 1 ? 'oportunidade ganha não tem' : 'oportunidades ganhas não têm'} data de fechamento e só {stats.wonWithoutDate === 1 ? 'entra' : 'entram'} em "Tudo".
        </p>
      )}

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
                    <StageBadge stage={o.stage} opp={o} />
                    <span className="font-semibold">{formatCurrency(o.value)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <h2 className="section-title" style={{ margin: '28px 0 12px' }}>Leads e origem</h2>
      {!realLeads ? (
        <p className="text-xs text-muted">Os leads só aparecem aqui quando o CRM está ligado na API (CRM_API=1). Hoje a tela de Leads usa dados de exemplo, e exemplo não entra nas métricas.</p>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Leads ativos" value={lm.active} hint={`${lm.unseen} ainda não ${lm.unseen === 1 ? 'foi aberto' : 'foram abertos'}`} />
            <StatCard label="Novos no período" value={lm.newInPeriod} hint={PERIODS.find((p) => p.id === period)?.label} />
            <StatCard label="Aguardando contato" value={lm.waitingContact} tone={lm.waitingContact ? 'warning' : undefined} hint="Ativos sem primeiro contato" />
            <StatCard label="Qualificados" value={lm.qualified} tone="success" hint={`${lm.discarded} descartados · ${percent(lm.qualifiedRate)} de qualificação`} />
          </div>
          <section className="section panel-card" style={{ marginTop: 16 }}>
            <h2 className="section-title">Origem dos leads</h2>
            {origins.length === 0 ? (
              <EmptyState title="Nenhum lead no período">Os leads que entrarem por formulário, LP ou cadastro aparecem aqui por fonte.</EmptyState>
            ) : (
              <div className="funnel">
                {origins.map((o) => (
                  <div key={`${o.origin}-${o.label}`} className="funnel-row">
                    <span className="funnel-label">{o.label}</span>
                    <div className="funnel-track" aria-hidden="true">
                      <div className="funnel-bar" style={{ width: `${(o.count / Math.max(1, origins[0].count)) * 100}%`, background: o.origin === 'INBOUND' ? 'var(--accent)' : 'var(--text-muted)' }} />
                    </div>
                    <span className="funnel-count">{o.count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <h2 className="section-title" style={{ margin: '28px 0 12px' }}>Tarefas</h2>
      {!realTasks ? (
        <p className="text-xs text-muted">As tarefas só aparecem aqui quando funis e tarefas estão ligados na API (WORKFLOW_API=1). Hoje a tela de Tarefas usa dados de exemplo.</p>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Tarefas abertas" value={tm.open} hint={`${tm.noDue} sem prazo`} />
            <StatCard label="Atrasadas" value={tm.overdue} tone={tm.overdue ? 'danger' : undefined} hint="Prazo vencido e não concluída" />
            <StatCard label="Vencem em 7 dias" value={tm.dueSoon} hint="Ainda dentro do prazo" />
            <StatCard label="Concluídas no período" value={tm.doneInPeriod} tone="success" hint={PERIODS.find((p) => p.id === period)?.label} />
          </div>
          <section className="section panel-card" style={{ marginTop: 16 }}>
            <h2 className="section-title">O que está atrasado</h2>
            {late.length === 0 ? (
              <EmptyState title="Nada atrasado">As tarefas com prazo vencido aparecem aqui, da mais antiga para a mais nova.</EmptyState>
            ) : (
              <ul className="top-list">
                {late.map((t) => (
                  <li key={t.id}>
                    <button type="button" className="top-item" onClick={() => navigate('/tarefas')}>
                      <span className="cell-stack">
                        <span className="cell-primary">{t.title}</span>
                        <span className="text-xs text-muted">{t.entityName}{t.assignee ? ` · ${t.assignee}` : ''}</span>
                      </span>
                      <span className="text-xs text-muted">prazo {new Date(t.dueAt as string).toLocaleDateString('pt-BR')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <p className="text-xs text-muted" style={{ marginTop: 24 }}>
        <FlaskConical size={12} style={{ verticalAlign: '-2px' }} />{' '}
        Quer ver modelos de gráfico? A <button type="button" className="link-btn" onClick={() => navigate('/dashboard/demonstracao')}>galeria de demonstração</button> usa números inventados e fica separada destas métricas.
      </p>
    </Page>
  );
}
