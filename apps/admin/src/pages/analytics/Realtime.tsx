import { useCallback, useEffect, useRef, useState } from 'react';
import { ago, recentBuckets } from '../../lib/analyticsSeries';
import { API_URL } from '../../lib/api';
import type { Lead } from '../../domain';
import { attributionOf, channelOf } from '../../lib/channels';
import { accountDomain, providerOfSource } from '../../lib/brandLogos';
import { useStore } from '../../lib/store';
import { companiesStore } from '../../mocks/people';
import { ProviderLogo } from '../../components/ProviderLogo';
import { BrandLogo, ChannelLogo } from '../../components/analytics/SourceLogo';
import type { Touch } from '../../lib/channels';
import { listLinks } from '../../lib/campaignLinks';
import type { CampaignLink } from '../../lib/campaignLinks';
import { ErrorBanner } from '../../components/ui';
import { BarList, Card } from '../../components/analytics/parts';

// Tempo real: o que o CRM e os links curtos registram, relido a cada 15 s enquanto a aba está visível. Não há
// visitantes ao vivo: o CRM não coleta pageview (isso mora no GA4 e no Clarity).

const EVERY = 15_000;

async function fetchLeads(): Promise<Lead[]> {
  const out: Lead[] = [];
  for (let offset = 0; ; offset += 500) {
    const res = await fetch(`${API_URL}/api/crm/leads?limit=500&offset=${offset}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`erro ${res.status}`);
    const page = (await res.json()) as Lead[];
    out.push(...page);
    const total = Number(res.headers.get('X-Total-Count') ?? out.length);
    if (!page.length || out.length >= total) return out;
  }
}

function MinuteBars({ values, label, from }: { values: number[]; label: string; from: string }) {
  const max = Math.max(...values, 1);
  return (
    <figure className="an-live-chart">
      <div className="an-minibars an-minibars-tall" role="img" aria-label={label}>
        {values.map((n, i) => <span key={i} data-zero={!n || undefined} title={`${n}`} style={{ height: n ? `${(n / max) * 100}%` : undefined }} />)}
      </div>
      <figcaption><span>{from}</span><span>agora</span></figcaption>
    </figure>
  );
}

export default function Realtime({ touch, go }: { touch: Touch; go: (path: string) => void }) {
  const [companies] = useStore(companiesStore);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [links, setLinks] = useState<CampaignLink[]>([]);
  const [at, setAt] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const base = useRef<Map<string, number> | null>(null);
  const [clicks, setClicks] = useState<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    try {
      const [l, k] = await Promise.all([fetchLeads(), listLinks().catch(() => [] as CampaignLink[])]);
      if (!base.current) base.current = new Map(k.map((x) => [x.id, x.clicks]));
      setClicks(new Map(k.map((x) => [x.id, Math.max(0, x.clicks - (base.current!.get(x.id) ?? 0))])));
      setLeads(l.filter((x) => !x.archivedAt));
      setLinks(k);
      setAt(Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro');
    }
  }, []);

  useEffect(() => {
    const tick = () => { if (!document.hidden) void load(); };
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(tick, EVERY);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearTimeout(first); window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [load]);

  if (!leads) {
    return error
      ? <ErrorBanner title="Não consegui ler o tempo real" onRetry={() => void load()}>{error}</ErrorBanner>
      : <p className="an-empty">Lendo os últimos registros…</p>;
  }

  const dates = leads.map((l) => l.createdAt);
  const minutes = recentBuckets(dates, 30, 60_000, at);
  const hours = recentBuckets(dates, 24, 3_600_000, at);
  const last30 = minutes.reduce((x, y) => x + y, 0);
  const last24 = hours.reduce((x, y) => x + y, 0);
  const sorted = [...leads].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const feed = sorted.slice(0, 8);
  const recent = sorted.filter((l) => at - Date.parse(l.createdAt) < 86_400_000);
  // Conta do lead: a empresa dele (site cadastrado) ou o domínio do e-mail corporativo.
  const account = (l: Lead) => {
    const company = companies.find((c) => c.id === l.companyId);
    return { name: company?.name ?? l.name, domain: accountDomain(company?.website, l.email) };
  };
  const channelDomain = (l: Lead) => { const x = attributionOf(l); return l.customData?.projectId ? accountDomain(x.page_url || x.landing_page) : undefined; };
  const byChannel = new Map<string, { label: string; n: number; domain?: string }>();
  for (const l of recent) {
    const c = channelOf(l, touch);
    byChannel.set(c.key, { label: c.label, n: (byChannel.get(c.key)?.n ?? 0) + 1, domain: channelDomain(l) });
  }
  const newClicks = [...clicks.values()].reduce((x, y) => x + y, 0);
  const clicked = [...links].filter((l) => l.clicks > 0).sort((a, b) => Date.parse(b.lastClickAt ?? '') - Date.parse(a.lastClickAt ?? '') || b.clicks - a.clicks).slice(0, 6);

  return (
    <>
      {error && <ErrorBanner title="A última leitura falhou" onRetry={() => void load()}>Mostrando os dados das {new Date(at).toLocaleTimeString('pt-BR')}.</ErrorBanner>}
      <p className="an-live"><span className="an-live-dot" data-off={!!error || undefined} />Atualiza a cada 15 segundos · última leitura às {new Date(at).toLocaleTimeString('pt-BR')}</p>

      <section className="an-panel an-live-panel" aria-label="Leads nos últimos 30 minutos">
        <div>
          <div className="an-metric-label">Leads nos últimos 30 minutos</div>
          <div className="an-live-value">{last30}</div>
          <dl className="an-pairs">
            <div><dt>Últimas 24 horas</dt><dd>{last24}</dd></div>
            <div><dt>Cliques em links desde que abriu</dt><dd>{newClicks}</dd></div>
          </dl>
        </div>
        <div>
          <div className="an-metric-label">Por minuto</div>
          <MinuteBars values={minutes} label={`${last30} leads nos últimos 30 minutos, minuto a minuto`} from="há 30 min" />
          <div className="an-metric-label">Por hora</div>
          <MinuteBars values={hours} label={`${last24} leads nas últimas 24 horas, hora a hora`} from="há 24 h" />
        </div>
      </section>

      <div className="an-grid">
        <Card title="Últimos leads" note="Os mais recentes primeiro" action="Abrir leads" onAction={() => go('/leads')} span="half">
          {feed.length ? (
            <ul className="an-feed">
              {feed.map((l) => {
                const c = channelOf(l, touch);
                const acc = account(l);
                return (
                  <li key={l.id}>
                    <ProviderLogo name={acc.name} domain={acc.domain} size={32} />
                    <span className="an-feed-name">{l.name}<small><ChannelLogo channel={c.key} name={c.label} domain={channelDomain(l)} size={14} />{c.label}</small></span>
                    <time dateTime={l.createdAt}>{ago(l.createdAt, at)}</time>
                  </li>
                );
              })}
            </ul>
          ) : <p className="an-none">Nenhum lead ainda.</p>}
        </Card>
        <Card title="Canais nas últimas 24 horas">
          <BarList
            empty="Nenhum lead nas últimas 24 horas." head={['Canal', 'Leads']}
            rows={[...byChannel].sort((a, b) => b[1].n - a[1].n).map(([key, v]) => ({ icon: <ChannelLogo channel={key} name={v.label} domain={v.domain} />, key, label: v.label, value: v.n, display: String(v.n) }))}
          />
        </Card>
        <Card title="Links clicados" note="Total de cliques de cada link curto" action="Ver links" onAction={() => go('/trafego/links')}>
          <BarList
            empty="Nenhum clique em link de divulgação ainda." head={['Link', 'Cliques']}
            rows={clicked.map((l) => ({
              key: l.id, label: l.label, icon: <BrandLogo provider={providerOfSource(l.utm_source) ?? ''} name={l.utm_source} />,
              sub: [clicks.get(l.id) ? `+${clicks.get(l.id)} agora há pouco` : '', l.lastClickAt ? `último ${ago(l.lastClickAt, at)}` : ''].filter(Boolean).join(' · ') || undefined,
              value: l.clicks, display: String(l.clicks),
            }))}
          />
        </Card>
      </div>
      <p className="an-note">Aqui aparece o que o CRM registra: leads e cliques nos links curtos. Visitantes no site neste momento ficam no GA4 e no Clarity; o admin ainda não coleta esse dado.</p>
    </>
  );
}
