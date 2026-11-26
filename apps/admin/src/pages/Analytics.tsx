import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, ExternalLink, X } from 'lucide-react';
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
  MIN_BASE, UNTRACKED_ALERT, byCampaign, byChannel, byLanding, byOrganicPiece, cohort, outcomes, quality, rate, readout, signupsByPage, summary,
} from '../lib/acquisitionMetrics';
import type { GroupRow, Outcome, Window } from '../lib/acquisitionMetrics';
import { listLinks, shortLabel } from '../lib/campaignLinks';
import type { CampaignLink } from '../lib/campaignLinks';
import { loadTrackingHealth } from '../lib/analyticsApi';
import type { TrackingHealth } from '../lib/analyticsApi';
import { Delta, Spark } from '../components/dashboard/widgets';
import { ErrorBanner, Page, PageHeader } from '../components/ui';

// Analytics: de onde vem o resultado. Coorte = leads criados no período e o que eles geraram depois (pipeline e
// receita), por canal, com primeiro toque como padrão (ciclo B2B longo). Só leitura. Regras em docs/tracking.md
// (seção 9), cálculo em lib/acquisitionMetrics.ts e lib/channels.ts.
//
// Composição: uma frase de leitura, o resumo em faixa (mesmo desenho do Dashboard), a tabela de canais como peça
// principal e só as quebras que têm dado; as que ainda não têm viram uma lista curta com o próximo passo.

const money = (cents: number) => formatCurrency(Math.round(cents) / 100);
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: v < 0.1 ? 1 : 0 })}%`);
const SMALL = `Menos de ${MIN_BASE} casos: a taxa ainda não diz nada.`;
const WEEK = 7 * 86_400_000;
/** Proporção com base suficiente vira %, abaixo disso mostra a contagem ("1 de 3"). */
const share = (n: number, base: number) => (rate(n, base) === null ? `${n} de ${base}` : pct(rate(n, base)));
const leadsWord = (n: number) => (n === 1 ? 'lead' : 'leads');

/** Série semanal (12 semanas até o fim da janela) para as minilinhas do resumo. */
function weekly(rows: Outcome[], w: Window, value: (o: Outcome) => number): number[] {
  const end = w ? w.to : Date.now();
  const start = end - 12 * WEEK;
  const out = Array(12).fill(0) as number[];
  for (const o of rows) {
    const i = Math.floor((Date.parse(o.lead.createdAt) - start) / WEEK);
    if (i >= 0 && i < 12) out[i] += value(o);
  }
  return out;
}

/** Barra de participação dentro da célula (pipeline do canal ÷ maior pipeline). */
function Share({ value, max }: { value: number; max: number }) {
  if (!max) return null;
  return <span className="an-share" aria-hidden><span style={{ width: `${Math.max(3, Math.round((value / max) * 100))}%` }} /></span>;
}

function GroupTable({ rows, first, onPick, picked }: { rows: GroupRow[]; first: string; onPick?: (k: string) => void; picked?: string }) {
  const max = Math.max(...rows.map((r) => r.pipelineCents), 0);
  return (
    <div className="table-scroll">
      <table className="data-table an-table">
        <thead>
          <tr><th>{first}</th><th className="an-num">Leads</th><th className="an-num">Qualificados</th><th className="an-num">Pipeline gerado</th><th className="an-num">Receita</th><th className="an-num">Lead → venda</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const conv = rate(r.won, r.leads);
            const group = r.group ? GROUP_LABEL[r.group] : '';
            const pick = onPick ? () => onPick(r.key) : undefined;
            return (
              <tr
                key={r.key}
                className={onPick ? 'clickable' : undefined}
                onClick={pick}
                onKeyDown={pick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } } : undefined}
                tabIndex={onPick ? 0 : undefined}
                aria-selected={onPick ? picked === r.key : undefined}
              >
                <td>
                  <span className="cell-primary">{r.label}</span>
                  {group && group !== r.label && <span className="an-sub">{group}</span>}
                </td>
                <td className="an-num">{r.leads}</td>
                <td className="an-num">{r.qualified}</td>
                <td className="an-num">{money(r.pipelineCents)}<Share value={r.pipelineCents} max={max} /></td>
                <td className="an-num">{r.wonCents ? money(r.wonCents) : '—'}{r.won ? <span className="an-sub">{r.won} {r.won === 1 ? 'venda' : 'vendas'}</span> : null}</td>
                <td className="an-num" title={conv === null ? SMALL : undefined}>{pct(conv)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, note, children, id }: { title: string; note?: string; children: ReactNode; id?: string }) {
  return (
    <section className="an-section" id={id}>
      <header className="an-section-head">
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </header>
      {children}
    </section>
  );
}

const STATUS_LABEL: Record<string, string> = { sent: 'enviados', failed: 'falharam', skipped: 'sem configuração', pending: 'pendentes' };

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

  const windows = useMemo(() => periodWindows(period), [period]);
  const win = useMemo<Window>(() => (windows ? { from: windows.from, to: windows.to } : null), [windows]);
  const prevWin = useMemo<Window>(() => (windows ? { from: windows.prevFrom, to: windows.prevTo } : null), [windows]);

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
  const reading = useMemo(() => readout(summary(all), channels, q, money), [all, channels, q]);
  const campaigns = useMemo(() => byCampaign(rows, touch), [rows, touch]);
  const organic = useMemo(() => byOrganicPiece(rows), [rows]);
  const landings = useMemo(() => byLanding(rows).slice(0, 10), [rows]);
  const signups = useMemo(() => signupsByPage(rows.map((o) => o.lead)).slice(0, 8), [rows]);
  const topLinks = useMemo(() => [...links].sort((a, b) => b.clicks - a.clicks || (b.leads ?? 0) - (a.leads ?? 0)).slice(0, 6), [links]);
  const pickedLabel = channels.find((c) => c.key === channel)?.label;
  const hasPrev = !!prev;
  const d = (cur: number, before?: number) => <Delta value={before === undefined ? null : deltaPct(cur, before)} hasPrevious={hasPrev} />;

  const layers = useMemo(() => {
    if (!health) return [];
    const line = (layer: 'meta' | 'ga4') => {
      const names = [...new Set(health.counts.filter((c) => c.layer === layer).map((c) => c.name))].sort();
      return names.map((name) => {
        const parts = health.counts.filter((c) => c.layer === layer && c.name === name && c.count > 0).sort((a, b) => a.status.localeCompare(b.status));
        return `${name}: ${parts.map((p) => `${p.count} ${STATUS_LABEL[p.status] ?? p.status}`).join(', ')}`;
      }).join(' · ');
    };
    const failed = (layer: 'meta' | 'ga4') => health.counts.some((c) => c.layer === layer && c.status === 'failed' && c.count > 0);
    return [
      { name: 'Meta (API de Conversões)', state: failed('meta') ? 'bad' : health.configured.meta ? 'ok' : 'warn', status: failed('meta') ? 'Com falhas' : health.configured.meta ? 'Ligada' : 'Sem credencial', detail: line('meta') || 'Nenhum envio no período' },
      { name: 'GA4 pelo servidor', state: failed('ga4') ? 'bad' : health.configured.ga4 ? 'ok' : 'idle', status: failed('ga4') ? 'Com falhas' : health.configured.ga4 ? 'Ligado' : 'Só pelo navegador', detail: line('ga4') || 'Nenhum envio no período' },
      { name: 'Conversões offline', state: health.offline ? 'ok' : 'idle', status: health.offline ? 'Ligadas' : 'Desligadas', detail: 'Lead qualificado e venda do CRM voltam para a Meta e o GA4' },
    ];
  }, [health]);

  // Quebras sem dado no período viram uma linha com o próximo passo, em vez de uma seção vazia.
  const pending: { name: string; why: string; action?: ReactNode }[] = [];
  if (!campaigns.length) pending.push({ name: 'Campanhas', why: 'Nenhum lead com utm_campaign. Todo anúncio precisa de UTM (convenção em docs/tracking.md).' });
  if (!organic.length) pending.push({ name: 'Orgânico por peça', why: 'Nenhum lead veio de um link orgânico com UTM.', action: <button type="button" className="an-link" onClick={() => navigate('/links')}>Criar links <ArrowRight size={14} /></button> });
  if (!signups.length) pending.push({ name: 'Newsletter e material', why: 'Nenhuma inscrição pelo blog no período.' });
  if (!topLinks.length) pending.push({ name: 'Links de divulgação', why: 'Nenhum link criado. Cada post ganha um link curto com as UTMs certas.', action: <button type="button" className="an-link" onClick={() => navigate('/links')}>Criar links <ArrowRight size={14} /></button> });

  return (
    <Page>
      <PageHeader title="Analytics" subtitle="Qual canal gera pipeline e receita, para decidir onde colocar dinheiro e tempo." />
      {oppError && <ErrorBanner title="Não consegui carregar as oportunidades" onRetry={reload}>Pipeline e receita ficam zerados até carregar.</ErrorBanner>}

      <div className="an-toolbar">
        <div className="chip-row" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" className={`chip ${period === p.id ? 'active' : ''}`} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>
          ))}
        </div>
        <div className="an-seg" role="group" aria-label="Atribuição">
          <button type="button" aria-pressed={touch === 'first'} onClick={() => setTouch('first')} title="Quem trouxe a pessoa pela primeira vez (padrão em ciclo longo)">Primeiro toque</button>
          <button type="button" aria-pressed={touch === 'last'} onClick={() => setTouch('last')} title="A última campanha antes do formulário">Último toque</button>
        </div>
        {channel && (
          <button type="button" className="chip active an-filter" onClick={() => setChannel('')} aria-label="Limpar filtro de canal">{pickedLabel} <X size={12} /></button>
        )}
      </div>

      <p className="an-reading" data-alert={q.alert || undefined}>
        {reading}
        {q.alert && <> <a href="#an-quality" className="an-link" onClick={(e) => { e.preventDefault(); document.getElementById('an-quality')?.scrollIntoView({ behavior: 'smooth' }); }}>Ver qualidade dos dados</a></>}
      </p>

      <section className="dash-hero an-hero" aria-label="Resumo do período">
        <div className="dash-hero-item">
          <div className="dash-hero-label">Pipeline gerado</div>
          <div className="dash-hero-value">{money(s.pipelineCents)}</div>
          <div className="dash-hero-foot">{d(s.pipelineCents, prev?.pipelineCents)}</div>
          <Spark values={weekly(rows, win, (o) => o.pipelineCents)} label="Pipeline gerado nas últimas 12 semanas" />
        </div>
        <div className="dash-hero-item">
          <div className="dash-hero-label">Receita ganha</div>
          <div className="dash-hero-value">{money(s.wonCents)}</div>
          <div className="dash-hero-foot">{s.won ? `${s.won} ${s.won === 1 ? 'venda' : 'vendas'} · ` : ''}{d(s.wonCents, prev?.wonCents)}</div>
          <Spark values={weekly(rows, win, (o) => (o.won ? o.pipelineCents : 0))} label="Receita ganha nas últimas 12 semanas" />
        </div>
        <div className="dash-hero-item">
          <div className="dash-hero-label">Leads</div>
          <div className="dash-hero-value">{s.leads}<span className="an-hero-of">{s.qualified} {s.qualified === 1 ? 'qualificado' : 'qualificados'}</span></div>
          <div className="dash-hero-foot">{d(s.leads, prev?.leads)}</div>
          <Spark values={weekly(rows, win, () => 1)} label="Leads nas últimas 12 semanas" />
        </div>
        <div className="dash-hero-item">
          <div className="dash-hero-label">Lead → venda</div>
          <div className="dash-hero-value" title={s.leadToWon === null ? SMALL : undefined}>{pct(s.leadToWon)}</div>
          <div className="dash-hero-foot">{s.leadToWon === null ? `Aparece com ${MIN_BASE} leads ou mais` : `Ciclo mediano: ${s.medianCycleDays === null ? '—' : `${Math.round(s.medianCycleDays)} dias`}`}</div>
        </div>
      </section>

      <Section title="Canais" note={`${touch === 'first' ? 'Primeiro toque: quem abriu a porta.' : 'Último toque: a campanha antes do formulário.'} Clique num canal para filtrar a página.`}>
        {channels.length ? <GroupTable rows={channels} first="Canal" picked={channel} onPick={(k) => setChannel((cur) => (cur === k ? '' : k))} /> : <p className="an-empty">Nenhum lead no período.</p>}
      </Section>

      {campaigns.length > 0 && (
        <Section title="Campanhas" note="utm_campaign do toque escolhido.">
          <GroupTable rows={campaigns} first="Campanha" />
        </Section>
      )}

      {organic.length > 0 && (
        <Section title="Orgânico por peça" note="Rede, tema e peça (utm_content) de cada link orgânico.">
          <GroupTable rows={organic} first="Peça" />
        </Section>
      )}

      {(landings.length > 0 || signups.length > 0) && (
        <div className="an-split">
          {landings.length > 0 && (
            <Section title="Páginas de entrada" note="Onde a pessoa chegou ao site pela primeira vez.">
              <table className="data-table an-table">
                <thead><tr><th>Página</th><th className="an-num">Leads</th><th className="an-num">Pipeline</th></tr></thead>
                <tbody>{landings.map((r) => <tr key={r.key}><td><code className="an-path">{r.label}</code></td><td className="an-num">{r.leads}</td><td className="an-num">{money(r.pipelineCents)}</td></tr>)}</tbody>
              </table>
            </Section>
          )}
          {signups.length > 0 && (
            <Section title="Newsletter e material" note="Inscrições do blog por artigo.">
              <table className="data-table an-table">
                <thead><tr><th>Página</th><th className="an-num">Newsletter</th><th className="an-num">Material</th></tr></thead>
                <tbody>{signups.map((r) => <tr key={r.page}><td><code className="an-path">{r.page}</code></td><td className="an-num">{r.newsletter}</td><td className="an-num">{r.material}</td></tr>)}</tbody>
              </table>
            </Section>
          )}
        </div>
      )}

      {topLinks.length > 0 && (
        <Section title="Links de divulgação" note="Cliques no link curto e leads com as mesmas UTMs, desde a criação.">
          <div className="table-scroll">
            <table className="data-table an-table">
              <thead><tr><th>Link</th><th>Campanha</th><th className="an-num">Cliques</th><th className="an-num">Leads</th><th className="an-num">Clique → lead</th></tr></thead>
              <tbody>{topLinks.map((l) => (
                <tr key={l.id}>
                  <td><span className="cell-primary">{l.label}</span><code className="an-sub">{shortLabel(l.code)}</code></td>
                  <td><code className="an-path">{l.utm_campaign}</code></td>
                  <td className="an-num">{l.clicks}</td>
                  <td className="an-num">{l.leads ?? '—'}</td>
                  <td className="an-num" title={rate(l.leads ?? 0, l.clicks) === null ? SMALL : undefined}>{pct(rate(l.leads ?? 0, l.clicks))}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Section>
      )}

      {pending.length > 0 && (
        <Section title="Ainda sem dados" note="Estas quebras aparecem aqui assim que tiverem leads.">
          <dl className="an-rules">
            {pending.map((p) => (
              <div key={p.name} className="an-rule">
                <dt>{p.name}</dt>
                <dd>{p.why}</dd>
                <dd className="an-rule-end">{p.action}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Section id="an-quality" title="Qualidade dos dados" note="Leads do site no período; outbound e projetos conectados ficam fora. Envios dos últimos 30 dias.">
        <dl className="an-rules">
          <div className="an-rule" data-state={q.alert ? 'warn' : undefined}>
            <dt>Sem origem</dt>
            <dd className="an-rule-value">{share(q.untracked, q.inbound)}</dd>
            <dd>{q.untracked} de {q.inbound} {leadsWord(q.inbound)} sem UTM nem referrer. Acima de {pct(UNTRACKED_ALERT)}, a leitura por canal não é confiável.</dd>
          </div>
          <div className="an-rule">
            <dt>Com UTM</dt>
            <dd className="an-rule-value">{share(q.withUtm, q.inbound)}</dd>
            <dd>Leads que chegaram por um link com UTM.</dd>
          </div>
          <div className="an-rule">
            <dt>Com cookie da Meta</dt>
            <dd className="an-rule-value">{share(q.withMetaCookie, q.inbound)}</dd>
            <dd>Leads com _fbp, _fbc ou fbclid: sobe a nota de correspondência da Meta.</dd>
          </div>
          {layers.map((l) => (
            <div key={l.name} className="an-rule">
              <dt>{l.name}</dt>
              <dd className="an-rule-value"><span className="an-state" data-state={l.state}>{l.status}</span></dd>
              <dd>{l.detail}</dd>
            </div>
          ))}
        </dl>
        {healthError && <ErrorBanner title="Não consegui ler os envios de conversão">{healthError}</ErrorBanner>}
        {health && health.errors.length > 0 && (
          <div className="an-errors">
            <h3>Últimos erros</h3>
            {health.errors.map((e, i) => (
              <p key={i}><strong>{e.name}</strong> · {e.source} · {formatDateTime(e.at)} — {e.error}</p>
            ))}
          </div>
        )}
        <p className="an-outlinks">
          Conferir na fonte:
          <a className="an-link" href="https://business.facebook.com/events_manager2" target="_blank" rel="noreferrer">Gerenciador de Eventos <ExternalLink size={13} /></a>
          <a className="an-link" href="https://analytics.google.com/" target="_blank" rel="noreferrer">GA4 <ExternalLink size={13} /></a>
          <a className="an-link" href="https://clarity.microsoft.com/" target="_blank" rel="noreferrer">Clarity <ExternalLink size={13} /></a>
        </p>
      </Section>
    </Page>
  );
}
