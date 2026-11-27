import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Copy, Link2, MousePointerClick, Tag } from 'lucide-react';
import type { Article } from '../domain';
import { listArticles } from '../lib/blog';
import { formatDate } from '../lib/format';
import {
  CHANNELS, SITE_PAGES, archiveLink, createLink, fullUrl, linkInputFor, listLinks, normalizeUTM, shortLabel, shortUrl,
} from '../lib/campaignLinks';
import type { CampaignLink, ChannelPreset } from '../lib/campaignLinks';
import { Badge, CustomSelect, EmptyState, ErrorBanner, Field, InfoPop, Page, PageHeader, StatCard, Tabs } from '../components/ui';

// Links de divulgação (tagueamento orgânico). A equipe escolhe o conteúdo e recebe, para cada canal orgânico, o link
// curto (kalidash.com.br/l/…) e o link completo com as UTMs da convenção (docs/tracking.md). Assim todo clique que
// vem de post, stories, bio ou WhatsApp chega ao site com origem, e o lead fica com a campanha certa.

type Aba = 'gerar' | 'criados';

const OTHER = '__outro';

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function Links({ embedded }: { embedded?: boolean }) {
  const [aba, setAba] = useState<Aba>('gerar');
  const [articles, setArticles] = useState<Article[]>([]);
  const [links, setLinks] = useState<CampaignLink[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLinks(await listLinks());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Não foi possível carregar os links.');
    }
  }, []);

  useEffect(() => {
    listLinks()
      .then((all) => { setLinks(all); setLoadError(null); })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Não foi possível carregar os links.'));
    listArticles().then((all) => setArticles(all.filter((a) => a.published))).catch(() => setArticles([]));
  }, []);

  const stats = useMemo(() => ({
    links: links.length,
    clicks: links.reduce((n, l) => n + l.clicks, 0),
    leads: links.reduce((n, l) => n + (l.leads ?? 0), 0),
  }), [links]);

  const content = (
    <>
      {!embedded && <PageHeader title="Links de divulgação" subtitle="Links curtos com as UTMs da convenção." />}
      {embedded && <p className="tr-hint" style={{ marginBottom: 16 }}>Para quando não há uma peça específica. Os links criados nos criativos orgânicos também aparecem em “Links criados”.</p>}
      {loadError && <ErrorBanner title="Não foi possível carregar os links" onRetry={() => void reload()}>{loadError}</ErrorBanner>}

      <div className="stat-grid">
        <StatCard label="Links criados" value={stats.links} hint="Links curtos ativos" />
        <StatCard label="Cliques" value={stats.clicks} hint="Pessoas que abriram um link curto" />
        <StatCard label="Leads" value={stats.leads} hint="Leads cuja última campanha é a de um link" />
      </div>

      <div className="info-row">
        <InfoPop icon={Link2} label="Link curto ou completo?" title="Qual link usar">
          O link curto (kalidash.com.br/l/…) é para stories, bio e WhatsApp: fácil de ler e conta os cliques. O completo funciona igual, mas é longo; use onde o endereço não aparece (botão, e-mail).
        </InfoPop>
        <InfoPop icon={Tag} label="Peça (opcional)" title="Diferenciar posts da mesma campanha">
          Preencha "Peça" para separar dois posts do mesmo tema, ex.: "reels_01" e "carrossel_02". Vira o fim do utm_content.
        </InfoPop>
        <InfoPop icon={MousePointerClick} label="Cliques e leads" title="O que cada número conta">
          Cliques: aberturas do link curto (prévias do WhatsApp e do LinkedIn não contam). Leads: leads cuja última campanha bate com a do link.
        </InfoPop>
      </div>

      <Tabs
        tabs={[
          { id: 'gerar' as const, label: 'Gerar links' },
          { id: 'criados' as const, label: 'Links criados', count: links.length },
        ]}
        value={aba}
        onChange={setAba}
      />

      {aba === 'gerar'
        ? <Generator articles={articles} links={links} onCreated={(l) => setLinks((cur) => cur.some((x) => x.id === l.id) ? cur : [l, ...cur])} />
        : <CreatedList links={links} onArchived={(id) => setLinks((cur) => cur.filter((l) => l.id !== id))} />}
    </>
  );
  return embedded ? content : <Page>{content}</Page>;
}

function Generator({ articles, links, onCreated }: { articles: Article[]; links: CampaignLink[]; onCreated: (l: CampaignLink) => void }) {
  const [target, setTarget] = useState('/');
  const [otherPath, setOtherPath] = useState('');
  const [campaign, setCampaign] = useState('home');
  const [campaignTouched, setCampaignTouched] = useState(false);
  const [piece, setPiece] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const destination = target === OTHER ? otherPath.trim() : target;

  // Tema padrão: o slug do artigo ou o nome da página. Só troca enquanto a pessoa não editou.
  const pickTarget = (value: string) => {
    setTarget(value);
    if (campaignTouched) return;
    const page = SITE_PAGES.find((p) => p.path === value);
    const art = articles.find((a) => `/blog/${a.slug}` === value);
    setCampaign(page ? page.campaign : art ? normalizeUTM(art.slug.replace(/-/g, '_')) : '');
  };

  const flash = (key: string) => {
    setCopied(key);
    window.setTimeout(() => setCopied((cur) => (cur === key ? null : cur)), 1600);
  };

  const existing = (ch: ChannelPreset) => {
    const input = linkInputFor(destination, campaign, ch, piece);
    return links.find((l) => l.destination === normalizeDest(destination) && l.utm_source === input.utm_source && l.utm_medium === input.utm_medium && l.utm_campaign === input.utm_campaign && l.utm_content === input.utm_content);
  };

  const ensureShort = async (ch: ChannelPreset): Promise<CampaignLink | null> => {
    const have = existing(ch);
    if (have) return have;
    const l = await createLink(linkInputFor(destination, campaign, ch, piece));
    onCreated(l);
    return l;
  };

  const copyShort = async (ch: ChannelPreset) => {
    setBusy(ch.id);
    setError(null);
    try {
      const l = await ensureShort(ch);
      if (l && await copy(shortUrl(l.code))) flash(`short:${ch.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar o link curto.');
    } finally {
      setBusy(null);
    }
  };

  const createAll = async () => {
    setBusy('all');
    setError(null);
    try {
      for (const ch of CHANNELS) await ensureShort(ch);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar os links curtos.');
    } finally {
      setBusy(null);
    }
  };

  const ready = !!normalizeUTM(campaign) && (target !== OTHER || /^\/[^/\\]/.test(destination) || destination === '/');

  return (
    <>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="form-grid">
          <Field label="Conteúdo que vai ser divulgado">
            <CustomSelect className="select" value={target} onChange={(e) => pickTarget(e.target.value)} aria-label="Conteúdo">
              {SITE_PAGES.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
              {articles.map((a) => <option key={a.id} value={`/blog/${a.slug}`}>Artigo: {a.title}</option>)}
              <option value={OTHER}>Outra página do site…</option>
            </CustomSelect>
          </Field>
          {target === OTHER && (
            <Field label="Caminho da página" hint="Só páginas do site, começando com /. Ex.: /blog/guia-ia#material">
              <input className="input" value={otherPath} onChange={(e) => setOtherPath(e.target.value)} placeholder="/blog/…" />
            </Field>
          )}
          <Field label="Tema (utm_campaign)" hint={campaign && normalizeUTM(campaign) !== campaign ? `Vai como: ${normalizeUTM(campaign)}` : 'Mesmo tema em todos os canais, para comparar.'}>
            <input className="input" value={campaign} onChange={(e) => { setCampaign(e.target.value); setCampaignTouched(true); }} placeholder="ex.: guia_ia" />
          </Field>
          <Field label="Peça (opcional)" hint={piece ? `utm_content: stories_${normalizeUTM(piece)}` : 'Para separar posts do mesmo tema.'}>
            <input className="input" value={piece} onChange={(e) => setPiece(e.target.value)} placeholder="ex.: reels_01" />
          </Field>
        </div>
      </div>

      {error && <ErrorBanner title="Não deu certo">{error}</ErrorBanner>}

      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" disabled={!ready || busy !== null} onClick={() => void createAll()}>
          {busy === 'all' ? 'Criando…' : 'Criar todos os links curtos'}
        </button>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Canal</th><th>Link curto</th><th>Link completo</th></tr>
            </thead>
            <tbody>
              {CHANNELS.map((ch) => {
                const have = ready ? existing(ch) : undefined;
                const full = ready ? fullUrl(linkInputFor(destination, campaign, ch, piece)) : '';
                return (
                  <tr key={ch.id}>
                    <td>
                      <div className="cell-stack">
                        <span className="cell-primary">{ch.network}</span>
                        <span className="text-xs text-muted">{ch.place}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {have && <code className="text-xs">{shortLabel(have.code)}</code>}
                        <button type="button" className="btn btn-sm" disabled={!ready || busy !== null} onClick={() => void copyShort(ch)}>
                          <Copy size={12} /> {copied === `short:${ch.id}` ? 'Copiado' : busy === ch.id ? 'Criando…' : have ? 'Copiar' : 'Criar e copiar'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="text-xs text-muted" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={full}>{full || '—'}</span>
                        <button type="button" className="btn btn-sm" disabled={!full} onClick={() => void copy(full).then((ok) => ok && flash(`full:${ch.id}`))}>
                          <Copy size={12} /> {copied === `full:${ch.id}` ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/** Igual à API para comparar com os links já criados: caminho com / no começo. */
function normalizeDest(d: string): string {
  const t = d.trim() || '/';
  return t.startsWith('/') ? t : `/${t}`;
}

function CreatedList({ links, onArchived }: { links: CampaignLink[]; onArchived: (id: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const archive = async (l: CampaignLink) => {
    if (!window.confirm(`Arquivar ${shortLabel(l.code)}? Quem abrir esse link depois vai para a home do site, sem a campanha.`)) return;
    setBusy(l.id);
    try {
      await archiveLink(l.id);
      onArchived(l.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível arquivar.');
    } finally {
      setBusy(null);
    }
  };

  if (!links.length) return <EmptyState title="Nenhum link criado ainda">Na aba "Gerar links", escolha um conteúdo e crie os links curtos dos canais.</EmptyState>;

  return (
    <>
      {error && <ErrorBanner title="Não deu certo">{error}</ErrorBanner>}
      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Link</th><th>Página</th><th>Campanha</th><th>Cliques</th><th>Leads</th><th>Criado</th><th /></tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="cell-stack">
                      <span className="cell-primary">{l.label || `${l.utm_source} · ${l.utm_content}`}</span>
                      <code className="text-xs">{shortLabel(l.code)}</code>
                    </div>
                  </td>
                  <td className="text-xs">{l.destination}</td>
                  <td>
                    <div className="tag-row">
                      <Badge tone="info">{l.utm_campaign}</Badge>
                      <span className="text-xs text-muted">{l.utm_source} / {l.utm_medium}{l.utm_content ? ` / ${l.utm_content}` : ''}</span>
                    </div>
                  </td>
                  <td>{l.clicks}</td>
                  <td>{l.leads ?? '—'}</td>
                  <td className="text-muted">{l.createdAt ? formatDate(l.createdAt) : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-sm" onClick={() => void copy(shortUrl(l.code)).then((ok) => { if (ok) { setCopied(l.id); window.setTimeout(() => setCopied(null), 1600); } })}>
                        <Copy size={12} /> {copied === l.id ? 'Copiado' : 'Copiar'}
                      </button>
                      <button type="button" className="icon-btn" title="Arquivar" aria-label="Arquivar" disabled={busy === l.id} onClick={() => void archive(l)}>
                        <Archive size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
