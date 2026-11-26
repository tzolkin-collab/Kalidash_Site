import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, TriangleAlert } from 'lucide-react';
import { useOpportunities } from '../lib/useOpportunities';
import { useStore } from '../lib/store';
import { useShell } from '../lib/shell';
import { leadsStore } from '../mocks/leads';
import { pipelinesStore } from '../mocks/pipelines';
import { formatCurrency, formatDateTime } from '../lib/format';
import { PERIODS } from '../lib/salesMetrics';
import type { Period } from '../lib/salesMetrics';
import { deltaPct, periodWindows } from '../lib/commercialMetrics';
import { GROUP_LABEL } from '../lib/channels';
import type { Touch } from '../lib/channels';
import {
  MIN_BASE, UNTRACKED_ALERT, byCampaign, byChannel, byLanding, byOrganicPiece, cohort, outcomes, quality, rate, signupsByPage, summary,
} from '../lib/acquisitionMetrics';
import type { GroupRow, Outcome, Window } from '../lib/acquisitionMetrics';
import { listLinks, shortLabel } from '../lib/campaignLinks';
import type { CampaignLink } from '../lib/campaignLinks';
import { loadTrackingHealth } from '../lib/analyticsApi';
import type { TrackingHealth } from '../lib/analyticsApi';
import { Badge, EmptyState, ErrorBanner, Page, PageHeader, StatCard } from '../components/ui';

// Analytics: de onde vem o resultado. Coorte = leads criados no período e o que eles geraram depois (pipeline e
// receita), por canal, com primeiro toque como padrão (ciclo B2B longo). Só leitura. Regras em docs/tracking.md
// (seção Analytics), cálculo em lib/acquisitionMetrics.ts e lib/channels.ts.

const ColumnsChart = lazy(() => import('../components/dashboard/RealCharts'));

const money = (cents: number) => formatCurrency(Math.round(cents) / 100);
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: v < 0.1 ? 1 : 0 })}%`);
const SMALL = `Menos de ${MIN_BASE} casos: a taxa não diz nada ainda.`;

function Delta({ cur, prev }: { cur: number; prev?: number }) {
  if (prev === undefined) return null;
  const d = deltaPct(cur, prev);
  if (d === null) return <span className="text-xs text-muted">sem base no período anterior</span>;
  const up = d >= 0;
  return <span className="text-xs" style={{ color: up ? 'var(--success, #15803d)' : 'var(--danger, #b91c1c)' }}>{up ? '+' : ''}{pct(d)} vs. período anterior</span>;
}

/** Barra de participação dentro da célula (pipeline do canal ÷ maior pipeline). */
function Share({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return <div aria-hidden style={{ height: 4, borderRadius: 2, background: 'var(--border-subtle)', marginTop: 4 }}><div style={{ width: `${w}%`, height: 4, borderRadius: 2, background: 'var(--accent, #4f46e5)' }} /></div>;
}

function GroupTable({ rows, first, onPick, picked, empty }: { rows: GroupRow[]; first: string; onPick?: (k: string) => void; picked?: string; empty: string }) {
  if (!rows.length) return <EmptyState title={empty} />;
  const max = Math.max(...rows.map((r) => r.pipelineCents), 0);
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr><th>{first}</th><th>Leads</th><th>Qualificados</th><th>Pipeline gerado</th><th>Receita</th><th>Lead → venda</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const conv = rate(r.won, r.leads);
              return (
                <tr key={r.key} className={onPick ? 'clickable' : undefined} onClick={onPick ? () => onPick(r.key) : undefined} aria-selected={picked === r.key} style={picked === r.key ? { background: 'var(--bg-surface-hover)' } : undefined}>
                  <td>
                    <div className="cell-stack">
                      <span className="cell-primary">{r.label}</span>
                      {r.group && <span className="text-xs text-muted">{GROUP_LABEL[r.group]}</span>}
                    </div>
                  </td>
                  <td>{r.leads}</td>
                  <td>{r.qualified}</td>
                  <td>{money(r.pipelineCents)}<Share value={r.pipelineCents} max={max} /></td>
                  <td>{r.wonCents ? money(r.wonCents) : '—'}{r.won ? <span className="text-xs text-muted"> · {r.won}</span> : null}</td>
                  <td title={conv === null ? SMALL : undefined}>{pct(conv)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{ margin: '28px 0 0' }}>
      <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>{title}</h2>
      {hint && <p className="text-xs text-muted" style={{ margin: '0 0 12px' }}>{hint}</p>}
      {children}
    </section>
  );
}

/** Leads da coorte por semana (últimas 12 semanas da janela), com os qualificados. */
function weekly(rows: Outcome[], w: Window): Record<string, string | number>[] {
  const end = w ? w.to : Date.now();
  const weeks = 12;
  const start = end - weeks * 7 * 86_400_000;
  const out = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(start + i * 7 * 86_400_000);
    return { label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, leads: 0, qualificados: 0 };
  });
  for (const o of rows) {
    const t = Date.parse(o.lead.createdAt);
    const i = Math.floor((t - start) / (7 * 86_400_000));
    if (i < 0 || i >= weeks) continue;
    out[i].leads++;
    if (o.qualified) out[i].qualificados++;
  }
  return out;
}

const STATUS_LABEL: Record<string, string> = { sent: 'Enviado', failed: 'Falhou', skipped: 'Sem config.', pending: 'Pendente' };

export default function Analytics() {
  const { navigate } = useShell();
  const { opportunities, error: oppError, reload } = useOpportunities();
  const [pipelines] = useStore(pipelinesStore);
  const [leads] = useStore(leadsStore);
  const [period, setPeriod] = useState<Period>('90d');
  const [touch, setTouch] = useState<Touch>('first');
  const [channel, setChannel] = useState<string>('');
  const [links, setLinks] = useState<CampaignLink[]>([]);
  const [health, setHealth] = useState<TrackingHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    listLinks().then(setLinks).catch(() => setLinks([]));
    loadTrackingHealth(30).then(setHealth).catch((e: unknown) => setHealthError(e instanceof Error ? e.message : 'erro'));
  }, []);

  const win = useMemo<Window>(() => {
    const w = periodWindows(period);
    return w ? { from: w.from, to: w.to } : null;
  }, [period]);
  const prevWin = useMemo<Window>(() => {
    const w = periodWindows(period);
    return w ? { from: w.prevFrom, to: w.prevTo } : null;
  }, [period]);

  const all = useMemo(() => outcomes(cohort(leads, win), opportunities, pipelines, touch), [leads, win, opportunities, pipelines, touch]);
  const channels = useMemo(() => byChannel(all), [all]);
  const rows = useMemo(() => (channel ? all.filter((o) => o.channel.key === channel) : all), [all, channel]);
  const prevRows = useMemo(() => {
    if (!prevWin) return null;
    const p = outcomes(cohort(leads, prevWin), opportunities, pipelines, touch);
    return channel ? p.filter((o) => o.channel.key === channel) : p;
  }, [leads, prevWin, opportunities, pipelines, touch, channel]);

  const s = useMemo(() => summary(rows), [rows]);
  const prev = useMemo(() => (prevRows ? summary(prevRows) : null), [prevRows]);
  const q = useMemo(() => quality(all), [all]);
  const campaigns = useMemo(() => byCampaign(rows, touch), [rows, touch]);
  const organic = useMemo(() => byOrganicPiece(rows), [rows]);
  const landings = useMemo(() => byLanding(rows).slice(0, 10), [rows]);
  const signups = useMemo(() => signupsByPage(rows.map((o) => o.lead)).slice(0, 8), [rows]);
  const topLinks = useMemo(() => [...links].sort((a, b) => b.clicks - a.clicks || (b.leads ?? 0) - (a.leads ?? 0)).slice(0, 6), [links]);
  const pickedLabel = channels.find((c) => c.key === channel)?.label;

  const healthTable = useMemo(() => {
    if (!health) return [];
    const names = [...new Set(health.counts.map((c) => c.name))].sort();
    return names.map((name) => {
      const by = (layer: 'meta' | 'ga4') => Object.fromEntries(health.counts.filter((c) => c.name === name && c.layer === layer).map((c) => [c.status, c.count])) as Record<string, number>;
      return { name, meta: by('meta'), ga4: by('ga4') };
    });
  }, [health]);

  const statusCell = (m: Record<string, number>) => {
    const parts = Object.entries(m).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b));
    if (!parts.length) return <span className="text-muted">—</span>;
    return (
      <div className="tag-row">
        {parts.map(([st, n]) => <Badge key={st} tone={st === 'sent' ? 'success' : st === 'failed' ? 'danger' : 'neutral'}>{STATUS_LABEL[st] ?? st} {n}</Badge>)}
      </div>
    );
  };

  return (
    <Page>
      <PageHeader
        title="Analytics"
        subtitle="De onde vem o resultado: leads criados no período e o pipeline e a receita que eles geraram, por canal, campanha e conteúdo."
      />
      {oppError && <ErrorBanner title="Não consegui carregar as oportunidades" onRetry={reload}>Pipeline e receita ficam zerados até carregar.</ErrorBanner>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="chip-row" role="group" aria-label="Período" style={{ margin: 0 }}>
          {PERIODS.map((p) => (
            <button key={p.id} type="button" className={`chip ${period === p.id ? 'active' : ''}`} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="Atribuição" style={{ margin: 0 }}>
          <button type="button" className={`chip ${touch === 'first' ? 'active' : ''}`} aria-pressed={touch === 'first'} onClick={() => setTouch('first')} title="Quem trouxe a pessoa pela primeira vez (padrão em ciclo longo)">Primeiro toque</button>
          <button type="button" className={`chip ${touch === 'last' ? 'active' : ''}`} aria-pressed={touch === 'last'} onClick={() => setTouch('last')} title="A última campanha antes do formulário">Último toque</button>
        </div>
        {channel && (
          <button type="button" className="chip active" onClick={() => setChannel('')} aria-label="Limpar filtro de canal">Canal: {pickedLabel} ×</button>
        )}
      </div>

      {q.alert && (
        <div className="notice" role="status" style={{ marginTop: 16 }}>
          <TriangleAlert size={16} />
          <span>{pct(q.untrackedShare)} dos leads do site chegaram sem origem (acima de {pct(UNTRACKED_ALERT)}): a leitura por canal ainda não é confiável. Veja "Qualidade dos dados" no fim da página.</span>
        </div>
      )}

      <Section title="Resultado" hint="Coorte: leads criados no período e tudo o que geraram depois, mesmo que a venda feche mais tarde.">
        <div className="stat-grid">
          <StatCard label="Pipeline gerado" value={money(s.pipelineCents)} hint={<><span>{s.opps} oportunidades</span><br /><Delta cur={s.pipelineCents} prev={prev?.pipelineCents} /></>} />
          <StatCard label="Receita ganha" value={money(s.wonCents)} hint={<><span>{s.won} vendas</span><br /><Delta cur={s.wonCents} prev={prev?.wonCents} /></>} />
          <StatCard label="Leads" value={s.leads} hint={<><span>{s.qualified} qualificados ({pct(s.leadToQualified)})</span><br /><Delta cur={s.leads} prev={prev?.leads} /></>} />
          <StatCard label="Lead → venda" value={pct(s.leadToWon)} hint={s.leadToWon === null ? SMALL : `ciclo mediano ${s.medianCycleDays === null ? '—' : `${Math.round(s.medianCycleDays)} dias`}`} />
        </div>
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <p className="text-xs text-muted" style={{ margin: '0 0 8px' }}>Leads por semana{channel ? ` · ${pickedLabel}` : ''}</p>
          <Suspense fallback={<div style={{ height: 200 }} />}>
            <ColumnsChart height={200} data={weekly(rows, win)} series={[{ key: 'leads', label: 'Leads', color: 'var(--accent, #4f46e5)' }, { key: 'qualificados', label: 'Qualificados', color: 'var(--success, #15803d)' }]} />
          </Suspense>
        </div>
      </Section>

      <Section title="Canais" hint={`Ordenado por pipeline gerado. ${touch === 'first' ? 'Primeiro toque: quem abriu a porta.' : 'Último toque: a campanha antes do formulário.'} Clique num canal para filtrar a página.`}>
        <GroupTable rows={channels} first="Canal" picked={channel} onPick={(k) => setChannel((cur) => (cur === k ? '' : k))} empty="Nenhum lead no período" />
      </Section>

      <Section title="Campanhas" hint="utm_campaign do toque escolhido. Leads sem campanha ficam de fora.">
        <GroupTable rows={campaigns} first="Campanha" empty="Nenhum lead com campanha no período" />
      </Section>

      <Section title="Orgânico por peça" hint="Rede, tema e peça (utm_content) dos links orgânicos: o que cada post, stories ou mensagem trouxe.">
        <GroupTable rows={organic} first="Peça" empty="Nenhum lead do orgânico com UTM no período. Use os Links de divulgação nos posts." />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <Section title="Páginas de entrada" hint="Onde a pessoa chegou ao site pela primeira vez.">
          {landings.length ? (
            <div className="table-card"><div className="table-scroll"><table className="data-table">
              <thead><tr><th>Página</th><th>Leads</th><th>Pipeline</th></tr></thead>
              <tbody>{landings.map((r) => <tr key={r.key}><td className="text-xs">{r.label}</td><td>{r.leads}</td><td>{money(r.pipelineCents)}</td></tr>)}</tbody>
            </table></div></div>
          ) : <EmptyState title="Sem página de entrada nos leads do período" />}
        </Section>
        <Section title="Newsletter e material por página" hint="Inscrições do blog no período.">
          {signups.length ? (
            <div className="table-card"><div className="table-scroll"><table className="data-table">
              <thead><tr><th>Página</th><th>Newsletter</th><th>Material</th></tr></thead>
              <tbody>{signups.map((r) => <tr key={r.page}><td className="text-xs">{r.page}</td><td>{r.newsletter}</td><td>{r.material}</td></tr>)}</tbody>
            </table></div></div>
          ) : <EmptyState title="Nenhuma inscrição no período" />}
        </Section>
      </div>

      <Section title="Links de divulgação" hint="Cliques no link curto e leads com as mesmas UTMs (todo o período).">
        {topLinks.length ? (
          <div className="table-card"><div className="table-scroll"><table className="data-table">
            <thead><tr><th>Link</th><th>Campanha</th><th>Cliques</th><th>Leads</th><th>Clique → lead</th></tr></thead>
            <tbody>{topLinks.map((l) => (
              <tr key={l.id}>
                <td><div className="cell-stack"><span className="cell-primary">{l.label}</span><code className="text-xs">{shortLabel(l.code)}</code></div></td>
                <td className="text-xs">{l.utm_campaign}</td>
                <td>{l.clicks}</td>
                <td>{l.leads ?? '—'}</td>
                <td title={rate(l.leads ?? 0, l.clicks) === null ? SMALL : undefined}>{pct(rate(l.leads ?? 0, l.clicks))}</td>
              </tr>
            ))}</tbody>
          </table></div></div>
        ) : <EmptyState title="Nenhum link de divulgação ainda" action={<button type="button" className="btn btn-sm" onClick={() => navigate('/links')}>Criar links <ArrowRight size={12} /></button>} />}
      </Section>

      <Section title="Qualidade dos dados" hint="Leads do site no período (outbound e projetos conectados ficam fora) e as entregas de conversão dos últimos 30 dias.">
        <div className="stat-grid">
          <StatCard label="Sem origem" value={pct(q.untrackedShare)} tone={q.alert ? 'warning' : undefined} hint={`${q.untracked} de ${q.inbound} leads · alerta acima de ${pct(UNTRACKED_ALERT)}`} />
          <StatCard label="Com UTM" value={pct(rate(q.withUtm, q.inbound))} hint={`${q.withUtm} de ${q.inbound} leads`} />
          <StatCard label="Com cookie da Meta" value={pct(rate(q.withMetaCookie, q.inbound))} hint="_fbp, _fbc ou fbclid: sobe a nota de correspondência" />
        </div>
        {healthError && <ErrorBanner title="Não consegui ler as entregas de conversão">{healthError}</ErrorBanner>}
        {health && (
          <>
            <div className="tag-row" style={{ margin: '12px 0' }}>
              <Badge tone={health.configured.meta ? 'success' : 'warning'}>Meta CAPI {health.configured.meta ? 'ligada' : 'sem credencial'}</Badge>
              <Badge tone={health.configured.ga4 ? 'success' : 'neutral'}>GA4 servidor {health.configured.ga4 ? 'ligado' : 'pelo navegador'}</Badge>
              <Badge tone={health.offline ? 'success' : 'neutral'}>Conversões offline {health.offline ? 'ligadas' : 'desligadas'}</Badge>
            </div>
            {healthTable.length ? (
              <div className="table-card"><div className="table-scroll"><table className="data-table">
                <thead><tr><th>Evento</th><th>Meta</th><th>GA4</th></tr></thead>
                <tbody>{healthTable.map((r) => <tr key={r.name}><td className="cell-primary">{r.name}</td><td>{statusCell(r.meta)}</td><td>{statusCell(r.ga4)}</td></tr>)}</tbody>
              </table></div></div>
            ) : <EmptyState title="Nenhum envio de conversão nos últimos 30 dias" />}
            {health.errors.length > 0 && (
              <div className="card" style={{ padding: 16, marginTop: 12 }}>
                <p className="text-xs text-muted" style={{ margin: '0 0 8px' }}>Últimos erros</p>
                {health.errors.map((e, i) => (
                  <p key={i} className="text-xs" style={{ margin: '4px 0' }}><strong>{e.name}</strong> · {e.source} · {formatDateTime(e.at)}: {e.error}</p>
                ))}
              </div>
            )}
          </>
        )}
        <div className="tag-row" style={{ marginTop: 12 }}>
          <a className="btn btn-sm" href="https://business.facebook.com/events_manager2" target="_blank" rel="noreferrer">Gerenciador de Eventos <ExternalLink size={12} /></a>
          <a className="btn btn-sm" href="https://analytics.google.com/" target="_blank" rel="noreferrer">GA4 <ExternalLink size={12} /></a>
          <a className="btn btn-sm" href="https://clarity.microsoft.com/" target="_blank" rel="noreferrer">Clarity <ExternalLink size={12} /></a>
        </div>
      </Section>
    </Page>
  );
}
