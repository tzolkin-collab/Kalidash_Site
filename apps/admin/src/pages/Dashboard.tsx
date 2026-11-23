import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, ChevronLeft, ChevronRight, FlaskConical, GripVertical, Pencil, Plus, RefreshCw, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useOpportunities } from '../lib/useOpportunities';
import { useShell } from '../lib/shell';
import { useStore } from '../lib/store';
import { useAuth } from '../lib/auth';
import { pipelinesStore } from '../mocks/pipelines';
import { leadsStore } from '../mocks/leads';
import { tasksStore } from '../mocks/tasks';
import { useCrmMode } from '../lib/crmMode';
import { useSyncMode } from '../lib/workflowSync';
import { leadMetrics, leadOrigins, overdueTasks, taskMetrics } from '../lib/dashboardMetrics';
import { activityByDay, activityByPerson, activityKinds, cpfReveals, discardReasons, firstContact, deltaPct, leadCampaigns, leadsBetween, lostCents, lostReasons, openByPipeline, openTasksByAssignee, periodWindows, salesCycle, weeklyTrend, winRate, wonBetween, wonByOwner } from '../lib/commercialMetrics';
import { historyStore } from '../lib/history';
import { loadRecentHistory } from '../lib/historySync';
import { PERIODS, salesMetrics, stageInfo, toCents } from '../lib/salesMetrics';
import { activePipelines, kanbanStages, resolveStage } from '../lib/stages';
import type { Period } from '../lib/salesMetrics';
import { CUSTOM_SPANS, SPANS, SPAN_LABEL, addCustom, addItem, clearLayout, defaultLayout, isCustomId, layoutKey, loadLayout, moveItem, normalizeLayout, removeItem, saveLayout, setSpan, updateCustom } from '../lib/dashboardLayout';
import { chartTitle } from '../lib/chartSpec';
import type { ChartCtx } from '../lib/chartData';
import { PRESETS } from '../lib/dashboardPresets';
import type { Layout, Span } from '../lib/dashboardLayout';
import { GROUPS, WIDGETS, WIDGET_BY_ID } from '../components/dashboard/widgets';
import ChartBuilder from '../components/dashboard/ChartBuilder';
import ChartWidget from '../components/dashboard/ChartWidget';
import type { DashData } from '../components/dashboard/widgets';
import { Badge, CustomSelect, EmptyState, ErrorBanner, Page, PageHeader, PopupDialog, SidePanel } from '../components/ui';

// A Dashboard é uma grade de widgets (components/dashboard/widgets.tsx). Cada pessoa escolhe o que ver, em que
// ordem e com que largura (modo "Personalizar"); o layout fica no navegador (lib/dashboardLayout.ts).
// Métricas calculadas na hora a partir de /api/leads (as oportunidades reais); valor ganho e ticket médio seguem
// o período escolhido (data de ganho). Contas em lib/salesMetrics.ts, em centavos. Leads e tarefas só têm número
// quando o CRM e o workflow estão na API; os widgets "Exemplo" usam os gráficos da galeria, com números inventados.

export default function Dashboard() {
  const { opportunities, loading, error, reload } = useOpportunities();
  const { navigate } = useShell();
  const auth = useAuth();
  const key = layoutKey(auth.user?.id);

  const [pipelines] = useStore(pipelinesStore);
  const [period, setPeriod] = useState<Period>('month');
  const crmMode = useCrmMode();
  const syncMode = useSyncMode();
  const [leads] = useStore(leadsStore);
  const [tasks] = useStore(tasksStore);
  const [history] = useStore(historyStore);

  const [layout, setLayout] = useState<Layout>(() => loadLayout(key, WIDGETS));
  const [editing, setEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [builder, setBuilder] = useState<{ id?: string } | null>(null);
  const [applied, setApplied] = useState<{ name: string; before: Layout } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => { setLayout(loadLayout(key, WIDGETS)); }, [key]);
  // Os widgets de atividade leem o histórico recente (as 500 últimas ações); só existe com o CRM na API.
  useEffect(() => { if (crmMode === 'api') void loadRecentHistory(); }, [crmMode]);

  const update = (next: Layout) => { setLayout(next); saveLayout(key, next); };
  // Aplica um modelo pronto e guarda o layout anterior para o "Desfazer".
  const applyPreset = (name: string, items: Layout) => { setApplied({ name, before: layout }); update(normalizeLayout(items, WIDGETS)); };

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

  const data: DashData = {
    period, loading, stats, navigate,
    realLeads: crmMode === 'api',
    realTasks: syncMode === 'api',
    lm: useMemo(() => leadMetrics(leads, period), [leads, period]),
    origins: useMemo(() => leadOrigins(leads, period), [leads, period]),
    tm: useMemo(() => taskMetrics(tasks, period), [tasks, period]),
    late: useMemo(() => overdueTasks(tasks), [tasks]),
    realHistory: crmMode === 'api',
    hero: useMemo(() => {
      const w = periodWindows(period);
      if (!w) {
        return { wonCents: stats.wonCents, wonCount: stats.wonCount, wonDelta: null, newLeads: leads.filter((l) => !l.archivedAt).length, leadsDelta: null, hasPrevious: false };
      }
      const cur = wonBetween(opportunities, pipelines, w.from, w.to);
      const prev = wonBetween(opportunities, pipelines, w.prevFrom, w.prevTo);
      const nl = leadsBetween(leads, w.from, w.to);
      return { wonCents: cur.cents, wonCount: cur.count, wonDelta: deltaPct(cur.cents, prev.cents), newLeads: nl, leadsDelta: deltaPct(nl, leadsBetween(leads, w.prevFrom, w.prevTo)), hasPrevious: true };
    }, [opportunities, pipelines, period, leads, stats.wonCents, stats.wonCount]),
    c: useMemo(() => ({
      owners: wonByOwner(opportunities, pipelines, period),
      lost: lostReasons(opportunities, pipelines),
      lostCents: lostCents(opportunities, pipelines),
      cycle: salesCycle(opportunities, pipelines, period),
      winRate: winRate(opportunities, pipelines),
      trend: weeklyTrend(opportunities, pipelines, 8),
      byPipeline: openByPipeline(opportunities, pipelines),
      firstContact: firstContact(leads, period),
      discard: discardReasons(leads),
      campaigns: leadCampaigns(leads, period),
      actPerson: activityByPerson(history, period),
      actKinds: activityKinds(history, period),
      actDays: activityByDay(history, 14),
      reveals: cpfReveals(history, period),
      tasksByAssignee: openTasksByAssignee(tasks),
    }), [opportunities, pipelines, period, leads, history, tasks]),
  };

  // Dados que os gráficos configuráveis leem (o mesmo CRM de sempre; a janela de tempo vem de cada gráfico).
  const chartCtx: ChartCtx = useMemo(() => ({ opps: opportunities, pipelines, leads, tasks, history, period }), [opportunities, pipelines, leads, tasks, history, period]);

  const onDrop = (targetId: string) => {
    if (dragId && dragId !== targetId) {
      update(moveItem(layout, layout.findIndex((i) => i.id === dragId), layout.findIndex((i) => i.id === targetId)));
    }
    setDragId(null);
    setOverId(null);
  };

  const hiddenCount = WIDGETS.filter((w) => !layout.some((i) => i.id === w.id)).length;

  return (
    <Page>
      <PageHeader
        title="Dashboard"
        subtitle={editing ? 'Arraste pela alça para reordenar, escolha a largura de cada bloco e tire o que não precisa.' : 'Visão geral do funil, dos leads e das tarefas. Personalize para ver só o que importa.'}
        actions={editing ? (
          <>
            <button type="button" className="btn" onClick={() => { setCatalogOpen(false); setBuilder({}); }}><BarChart3 size={14} /> Adicionar gráfico</button>
            <button type="button" className="btn" onClick={() => { setBuilder(null); setCatalogOpen(true); }}><Plus size={14} /> Adicionar widget{hiddenCount ? ` (${hiddenCount})` : ''}</button>
            <button type="button" className="btn" onClick={() => setResetOpen(true)}><RotateCcw size={14} /> Restaurar padrão</button>
            <button type="button" className="btn btn-solid" onClick={() => { setEditing(false); setCatalogOpen(false); setApplied(null); }}><Check size={14} /> Concluir</button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={reload} disabled={loading}><RefreshCw size={14} /> Atualizar</button>
            <button type="button" className="btn" onClick={() => setEditing(true)}><SlidersHorizontal size={14} /> Personalizar</button>
          </>
        )}
      />

      {error && <ErrorBanner title={error} onRetry={reload}>Os números abaixo ficam zerados até carregar.</ErrorBanner>}

      <div className="chip-row" role="group" aria-label="Período do valor ganho">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" className={`chip ${period === p.id ? 'active' : ''}`} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      {stats.wonWithoutDate > 0 && period !== 'all' && (
        <p className="text-xs text-muted" style={{ margin: '0 0 16px' }}>
          {stats.wonWithoutDate} {stats.wonWithoutDate === 1 ? 'oportunidade ganha não tem' : 'oportunidades ganhas não têm'} data de fechamento e só {stats.wonWithoutDate === 1 ? 'entra' : 'entram'} em "Tudo".
        </p>
      )}

      {editing && (
        <div className="dash-presets" role="group" aria-label="Modelos prontos">
          <span className="dash-presets-label">Modelos prontos</span>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip" title={p.description} onClick={() => applyPreset(p.name, p.items)}>{p.name}</button>
          ))}
          <button type="button" className="chip" title="O layout de fábrica da Dashboard" onClick={() => applyPreset('Padrão', defaultLayout(WIDGETS))}>Padrão</button>
        </div>
      )}
      {editing && applied && (
        <div className="notice" role="status">
          <span>Modelo <strong>{applied.name}</strong> aplicado. Ajuste o que quiser abaixo.</span>
          <button type="button" className="btn btn-sm" onClick={() => { update(applied.before); setApplied(null); }}>Desfazer</button>
        </div>
      )}

      {layout.length === 0 ? (
        <EmptyState title="Nenhum widget na Dashboard">
          <button type="button" className="btn btn-solid" onClick={() => { setEditing(true); setCatalogOpen(true); }}><Plus size={14} /> Adicionar widget</button>
        </EmptyState>
      ) : (
        <div className="dash-grid" data-editing={editing}>
          {layout.map((item, index) => {
            const base = WIDGET_BY_ID.get(item.id);
            const chart = isCustomId(item.id) ? item.config : undefined;
            const def = base ?? (chart ? { title: chartTitle(chart), spans: CUSTOM_SPANS, example: false, render: () => <ChartWidget cfg={chart} ctx={chartCtx} /> } : null);
            if (!def) return null;
            return (
              <div
                key={item.id}
                className="dash-item"
                data-span={item.span}
                data-dragging={dragId === item.id}
                data-over={editing && overId === item.id && dragId !== item.id}
                onDragOver={editing && dragId ? (e) => { e.preventDefault(); if (overId !== item.id) setOverId(item.id); } : undefined}
                onDrop={editing ? (e) => { e.preventDefault(); onDrop(item.id); } : undefined}
              >
                {editing && (
                  <div className="dash-edit-bar">
                    <span
                      className="dash-grip"
                      draggable
                      role="button"
                      aria-label={`Arrastar ${def.title}`}
                      title="Arraste para mudar a posição"
                      onDragStart={(e) => {
                        const box = e.currentTarget.closest('.dash-item');
                        if (box) e.dataTransfer.setDragImage(box, 16, 16);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(item.id);
                      }}
                      onDragEnd={() => { setDragId(null); setOverId(null); }}
                    ><GripVertical size={15} /></span>
                    <span className="dash-edit-title" title={def.title}>{def.title}{def.example && <Badge tone="info">Exemplo</Badge>}</span>
                    <CustomSelect
                      className="select select-sm dash-width"
                      value={String(item.span)}
                      onChange={(e) => update(setSpan(layout, item.id, Number(e.target.value) as Span, WIDGETS))}
                      aria-label={`Largura de ${def.title}`}
                    >
                      {SPANS.filter((s) => def.spans.includes(s)).map((s) => <option key={s} value={String(s)}>{SPAN_LABEL[s]}</option>)}
                    </CustomSelect>
                    {chart && <button type="button" className="icon-btn bare" onClick={() => setBuilder({ id: item.id })} aria-label={`Editar ${def.title}`} title="Editar gráfico"><Pencil size={14} /></button>}
                    <button type="button" className="icon-btn bare" disabled={index === 0} onClick={() => update(moveItem(layout, index, index - 1))} aria-label={`Mover ${def.title} para antes`} title="Mover para antes"><ChevronLeft size={15} /></button>
                    <button type="button" className="icon-btn bare" disabled={index === layout.length - 1} onClick={() => update(moveItem(layout, index, index + 1))} aria-label={`Mover ${def.title} para depois`} title="Mover para depois"><ChevronRight size={15} /></button>
                    <button type="button" className="icon-btn bare" onClick={() => update(removeItem(layout, item.id))} aria-label={`Tirar ${def.title}`} title="Tirar da Dashboard"><X size={15} /></button>
                  </div>
                )}
                <div className="dash-body">{def.render(data)}</div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted" style={{ marginTop: 24 }}>
        <FlaskConical size={12} style={{ verticalAlign: '-2px' }} />{' '}
        Os widgets marcados como Exemplo usam números inventados. Veja todos os modelos na <button type="button" className="link-btn" onClick={() => navigate('/dashboard/demonstracao')}>galeria de demonstração</button>.
      </p>

      {builder && (
        <ChartBuilder
          initial={builder.id ? layout.find((i) => i.id === builder.id)?.config : undefined}
          ctx={chartCtx}
          onClose={() => setBuilder(null)}
          onSave={(cfg) => { update(builder.id ? updateCustom(layout, builder.id, cfg) : addCustom(layout, cfg).layout); setBuilder(null); }}
        />
      )}

      {catalogOpen && (
        <SidePanel
          title="Adicionar widget"
          subtitle="Escolha o que passa a aparecer na sua Dashboard. Só você vê este layout."
          onClose={() => setCatalogOpen(false)}
          footer={<button type="button" className="btn btn-solid" onClick={() => setCatalogOpen(false)}>Fechar</button>}
        >
          {GROUPS.map((group) => (
            <section key={group} className="dash-catalog-group">
              <h3 className="section-title">{group}</h3>
              <ul className="row-list">
                {WIDGETS.filter((w) => w.group === group).map((w) => {
                  const added = layout.some((i) => i.id === w.id);
                  return (
                    <li key={w.id} className="row-item">
                      <w.Icon size={16} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                      <div className="cell-stack">
                        <span className="cell-primary">{w.title}{w.example && <> <Badge tone="info">Exemplo</Badge></>}</span>
                        <span className="text-xs text-muted">{w.description}</span>
                      </div>
                      {added
                        ? <button type="button" className="btn btn-sm" onClick={() => update(removeItem(layout, w.id))}>Tirar</button>
                        : <button type="button" className="btn btn-sm btn-solid" onClick={() => update(addItem(layout, w.id, WIDGETS))}><Plus size={12} /> Adicionar</button>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </SidePanel>
      )}

      {resetOpen && (
        <PopupDialog
          title="Restaurar o layout padrão?"
          description="Os widgets voltam para a ordem e a largura de fábrica. O layout que você montou é descartado."
          tone="warning"
          onClose={() => setResetOpen(false)}
          footer={(
            <>
              <button type="button" className="btn" onClick={() => setResetOpen(false)}>Cancelar</button>
              <button type="button" className="btn btn-solid" onClick={() => { clearLayout(key); setLayout(defaultLayout(WIDGETS)); setResetOpen(false); }}>Restaurar</button>
            </>
          )}
        />
      )}
    </Page>
  );
}
