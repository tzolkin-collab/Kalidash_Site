import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, ChevronLeft, ChevronRight, FlaskConical, GripVertical, Pencil, Plus, RefreshCw, RotateCcw, Save, SlidersHorizontal, X } from 'lucide-react';
import { useOpportunities } from '../lib/useOpportunities';
import { useShell } from '../lib/shell';
import { useStore } from '../lib/store';
import { useAuth } from '../lib/auth';
import { useCan } from '../lib/permissions';
import { API_URL } from '../lib/api';
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
import { funnelPrefKey, funnelRows, loadFunnelPref, pickFunnelPipeline, saveFunnelPref } from '../lib/funnelData';
import { activePipelines } from '../lib/stages';
import type { Period } from '../lib/salesMetrics';
import { CUSTOM_SPANS, SPANS, SPAN_LABEL, addCustom, addItem, clearLayout, defaultLayout, isCustomId, layoutKey, loadLayout, moveItem, normalizeLayout, removeItem, saveLayout, setSpan, updateCustom } from '../lib/dashboardLayout';
import { chartTitle, normalizeChart } from '../lib/chartSpec';
import { runChart } from '../lib/chartData';
import { MAX_NAME, MAX_VIEWS, addView, loadViews, removeView, saveViews, viewsKey } from '../lib/dashboardViews';
import type { ChartCtx } from '../lib/chartData';
import { PRESETS } from '../lib/dashboardPresets';
import type { Layout, Span } from '../lib/dashboardLayout';
import { GROUPS, WIDGETS, WIDGET_BY_ID } from '../components/dashboard/widgets';
import ChartBuilder from '../components/dashboard/ChartBuilder';
import ChartWidget from '../components/dashboard/ChartWidget';
import type { DashData, SiteMetrics, SiteState } from '../components/dashboard/widgets';
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
  const vkey = viewsKey(auth.user?.id);
  const [views, setViews] = useState(() => loadViews(vkey, WIDGETS));
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [viewError, setViewError] = useState<string | null>(null);
  const [builder, setBuilder] = useState<{ id?: string } | null>(null);
  const [applied, setApplied] = useState<{ name: string; before: Layout } | null>(null);
  // Métricas do site (GA4): só busca se a pessoa pode ver e se algum widget do site está na Dashboard.
  const can = useCan();
  const canSite = can.has('analytics:read');
  const [site, setSite] = useState<SiteState>({ status: 'loading' });
  const wantsSite = layout.some((i) => i.id.startsWith('site-'));
  useEffect(() => {
    if (!wantsSite) return;
    if (auth.status !== 'in') { setSite({ status: 'offline' }); return; }
    if (!canSite) { setSite({ status: 'forbidden' }); return; }
    let alive = true;
    setSite({ status: 'loading' });
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/api/site-metrics?period=${period}`);
        const body = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.status === 404) setSite({ status: 'unconfigured', error: 'Esta API ainda não tem a rota de métricas do site. Atualize a API.' });
        else if (res.status === 403) setSite({ status: 'forbidden' });
        else if (body.configured === false) setSite({ status: 'unconfigured', error: typeof body.error === 'string' ? body.error : undefined });
        else if (!res.ok) setSite({ status: 'error', error: typeof body.error === 'string' ? body.error : `A API respondeu ${res.status}.` });
        else setSite({ status: 'ok', data: body as SiteMetrics });
      } catch {
        if (alive) setSite({ status: 'offline' });
      }
    })();
    return () => { alive = false; };
  }, [period, wantsSite, canSite, auth.status]);
  // Uma vez por pessoa: quem já tinha um layout salvo ganha os widgets do site logo depois do resumo de vendas.
  useEffect(() => {
    if (auth.status !== 'in' || !auth.user?.id) return;
    const flag = `kalidash.dashboard.site-added.v1.${auth.user.id}`;
    try {
      if (localStorage.getItem(flag)) return;
      localStorage.setItem(flag, '1');
    } catch { return; }
    if (layout.some((i) => i.id.startsWith('site-'))) return;
    const add = WIDGETS.filter((w) => w.group === 'Site' && w.inDefault).map((w) => ({ id: w.id, span: w.defaultSpan }));
    const at = Math.max(0, layout.findIndex((i) => i.id === 'hero-today') + 1);
    update([...layout.slice(0, at), ...add, ...layout.slice(at)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, auth.user?.id]);

  const fkey = funnelPrefKey(auth.user?.id);
  const [funnelPref, setFunnelPref] = useState<string | null>(() => loadFunnelPref(fkey));
  useEffect(() => { setFunnelPref(loadFunnelPref(fkey)); }, [fkey]);
  const funnelPipe = pickFunnelPipeline(pipelines, funnelPref);
  const chooseFunnel = (id: string) => { setFunnelPref(id); saveFunnelPref(fkey, id); };
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => { setLayout(loadLayout(key, WIDGETS)); }, [key]);
  useEffect(() => { setViews(loadViews(vkey, WIDGETS)); }, [vkey]);
  // Os widgets de atividade leem o histórico recente (as 500 últimas ações); só existe com o CRM na API.
  useEffect(() => { if (crmMode === 'api') void loadRecentHistory(); }, [crmMode]);

  const update = (next: Layout) => { setLayout(next); saveLayout(key, next); };
  const commitViews = (next: typeof views) => { setViews(next); saveViews(vkey, next); };
  const submitView = () => {
    const r = addView(views, viewName, layout);
    if (r.error) { setViewError(r.error); return; }
    commitViews(r.views);
    setSaveOpen(false);
    setViewName('');
    setViewError(null);
  };
  // Aplica um modelo pronto e guarda o layout anterior para o "Desfazer".
  const applyPreset = (name: string, items: Layout) => { setApplied({ name, before: layout }); update(normalizeLayout(items, WIDGETS)); };

  const stats = useMemo(() => {
    const m = salesMetrics(opportunities, pipelines, period);
    const isKind = (stage: string, kind: string) => stageInfo(stage, pipelines)?.kind === kind;
    const sumCents = (list: typeof opportunities) => list.reduce((acc, o) => acc + toCents(o.value), 0);
    const won = opportunities.filter((o) => isKind(o.stage, 'WON'));
    const open = opportunities.filter((o) => isKind(o.stage, 'OPEN'));
    return {
      ...m,
      total: opportunities.length,
      conversion: opportunities.length ? won.length / opportunities.length : 0,
      // Funil escolhido no widget (ou o primeiro ativo): etapas de lead contam leads; as demais, oportunidades.
      byStage: funnelRows(funnelPipe, opportunities, leads, pipelines).map((r) => ({ id: r.id, label: r.label, color: r.color, count: r.count, value: r.cents / 100, isLead: r.isLeadStage })),
      biggest: [...open].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 5),
    };
  }, [opportunities, pipelines, period, leads, funnelPipe]);

  const data: DashData = {
    period, loading, stats, navigate, site,
    funnel: { pipelineId: funnelPipe?.id, name: funnelPipe?.name ?? '', options: activePipelines(pipelines).map((p) => ({ id: p.id, name: p.name })), choose: chooseFunnel },
    realLeads: crmMode === 'api',
    realTasks: syncMode === 'api',
    lm: useMemo(() => leadMetrics(leads, period), [leads, period]),
    origins: useMemo(() => leadOrigins(leads, period), [leads, period]),
    tm: useMemo(() => taskMetrics(tasks, period), [tasks, period]),
    late: useMemo(() => overdueTasks(tasks), [tasks]),
    realHistory: crmMode === 'api',
    hero: useMemo(() => {
      const w = periodWindows(period);
      // Mini gráficos: ritmo semanal das últimas 12 semanas (independe do período escolhido).
      const weekly = (measure: 'won-value' | 'leads-created') => {
        const cfg = normalizeChart({ visual: 'line', measure, granularity: 'week' });
        const res = cfg ? runChart(cfg, { opps: opportunities, pipelines, leads, tasks, history, period }) : null;
        return res?.kind === 'series' ? res.points.map((p) => p.value) : [];
      };
      const sparks = { wonSpark: weekly('won-value'), leadsSpark: weekly('leads-created') };
      if (!w) {
        return { wonCents: stats.wonCents, wonCount: stats.wonCount, wonDelta: null, newLeads: leads.filter((l) => !l.archivedAt).length, leadsDelta: null, hasPrevious: false, ...sparks };
      }
      const cur = wonBetween(opportunities, pipelines, w.from, w.to);
      const prev = wonBetween(opportunities, pipelines, w.prevFrom, w.prevTo);
      const nl = leadsBetween(leads, w.from, w.to);
      return { wonCents: cur.cents, wonCount: cur.count, wonDelta: deltaPct(cur.cents, prev.cents), newLeads: nl, leadsDelta: deltaPct(nl, leadsBetween(leads, w.prevFrom, w.prevTo)), hasPrevious: true, ...sparks };
    }, [opportunities, pipelines, period, leads, tasks, history, stats.wonCents, stats.wonCount]),
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
  const chartCtx: ChartCtx = useMemo(() => ({ opps: opportunities, pipelines, leads, tasks, history, period, funnelPipelineId: funnelPipe?.id }), [opportunities, pipelines, leads, tasks, history, period, funnelPipe?.id]);

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
          {views.map((v) => (
            <span key={v.id} className="dash-view">
              <button type="button" className="chip" title="Visão salva por você" onClick={() => applyPreset(v.name, v.items)}>{v.name}</button>
              <button type="button" className="dash-view-x" aria-label={`Apagar a visão ${v.name}`} title="Apagar visão" onClick={() => commitViews(removeView(views, v.id))}><X size={12} /></button>
            </span>
          ))}
          <button type="button" className="chip chip-dashed" disabled={views.length >= MAX_VIEWS} title={views.length >= MAX_VIEWS ? `O limite é de ${MAX_VIEWS} visões` : 'Guardar a Dashboard como está, com um nome'} onClick={() => { setViewError(null); setSaveOpen(true); }}><Save size={12} /> Salvar visão atual</button>
        </div>
      )}
      {editing && applied && (
        <div className="notice" role="status">
          <span><strong>{applied.name}</strong> aplicado. Ajuste o que quiser abaixo.</span>
          <button type="button" className="btn btn-sm" onClick={() => { update(applied.before); setApplied(null); }}>Desfazer</button>
        </div>
      )}

      {layout.length === 0 ? (
        <EmptyState title="Nenhum widget na Dashboard">
          <button type="button" className="btn btn-solid" onClick={() => { setEditing(true); setCatalogOpen(true); }}><Plus size={14} /> Adicionar widget</button>
        </EmptyState>
      ) : (
        <div className="dash-wrap"><div className="dash-grid" data-editing={editing}>
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
                data-id={item.id}
                data-dragging={dragId === item.id}
                data-over={editing && overId === item.id && dragId !== item.id}
              >
                {editing && (
                  <div className="dash-edit-bar">
                    <span
                      className="dash-grip"
                      role="button"
                      aria-label={`Arrastar ${def.title}`}
                      title="Arraste para mudar a posição"
                      onPointerDown={(e) => {
                        // Arrastar por ponteiro (mouse, toque e caneta): o arrastar nativo do HTML falha com
                        // toque e em vários navegadores. O bloco sob o ponteiro vira o destino.
                        if (e.button !== 0) return;
                        e.preventDefault();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setDragId(item.id);
                        setOverId(null);
                      }}
                      onPointerMove={(e) => {
                        if (dragId !== item.id) return;
                        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.dash-item');
                        const target = el?.dataset.id ?? null;
                        if (target !== overId) setOverId(target);
                      }}
                      onPointerUp={() => { if (dragId === item.id && overId) onDrop(overId); setDragId(null); setOverId(null); }}
                      onPointerCancel={() => { setDragId(null); setOverId(null); }}
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
        </div></div>
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

      {saveOpen && (
        <PopupDialog
          title="Salvar esta visão"
          description="Guarda a Dashboard como está agora (widgets, ordem, larguras e gráficos) com um nome, para voltar a ela com um clique."
          onClose={() => setSaveOpen(false)}
          footer={(
            <>
              <button type="button" className="btn" onClick={() => setSaveOpen(false)}>Cancelar</button>
              <button type="button" className="btn btn-solid" onClick={submitView}>Salvar visão</button>
            </>
          )}
        >
          <label className="field">
            <span className="field-label">Nome da visão</span>
            <input className="input" autoFocus value={viewName} maxLength={MAX_NAME} placeholder="Ex.: Reunião de segunda" onChange={(e) => { setViewName(e.target.value); setViewError(null); }} onKeyDown={(e) => { if (e.key === 'Enter') submitView(); }} />
            {viewError && <span className="field-error">{viewError}</span>}
          </label>
        </PopupDialog>
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
