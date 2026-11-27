import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Check, Copy, ExternalLink, ImageUp, Plus } from 'lucide-react';
import type { Article } from '../../domain';
import { listArticles, uploadImage } from '../../lib/blog';
import { CHANNELS, SITE_PAGES, createLink, linkInputFor, listLinks, normalizeUTM, shortLabel, shortUrl } from '../../lib/campaignLinks';
import type { CampaignLink, ChannelPreset } from '../../lib/campaignLinks';
import { FORMATS, archiveCreative, belongsTo, captionWithLink, createCreative, creativeLeads, listCreatives, placementTip, savePostUrls } from '../../lib/creatives';
import type { Creative, CreativeFormat } from '../../lib/creatives';
import { providerOfSource } from '../../lib/brandLogos';
import { formatDate } from '../../lib/format';
import { useStore } from '../../lib/store';
import { leadsStore } from '../../mocks/leads';
import { CustomSelect, EmptyState, ErrorBanner, Field, SidePanel } from '../../components/ui';
import { BrandLogo } from '../../components/analytics/SourceLogo';

// Criativos orgânicos: cadastra a peça, o sistema dá o ID e um link curto por lugar de publicação, e a equipe cola.
// Cliques vêm do link curto; leads, do ID no fim do utm_content.

const DEFAULT_CHANNELS = ['ig-bio', 'ig-stories', 'li-post', 'wa-status'];
const logoOf = (source: string, name: string, size = 20) => <BrandLogo provider={providerOfSource(source) ?? ''} name={name} size={size} />;
const formatLabel = (f: string) => FORMATS.find((x) => x.id === f)?.label ?? f;
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Erro desconhecido.');

/** Canal (rede + lugar) de um link do criativo. */
const channelOfLink = (l: CampaignLink, id: string) => CHANNELS.find((c) => c.source === l.utm_source && l.utm_content === `${c.content}_${id}`);

async function linkFor(c: Creative, ch: ChannelPreset): Promise<CampaignLink> {
  return createLink({ ...linkInputFor(c.destination, c.campaign, ch, c.id), label: `${c.title} · ${ch.network} (${ch.place})`.slice(0, 160) });
}

function Media({ creative }: { creative: Pick<Creative, 'mediaUrl' | 'format' | 'title'> }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="tr-media" data-format={creative.format}>
      {creative.mediaUrl && !failed
        ? <img src={creative.mediaUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        : <span>{formatLabel(creative.format)} sem imagem</span>}
    </div>
  );
}

export default function Organic() {
  const [creatives, setCreatives] = useState<Creative[] | null>(null);
  const [links, setLinks] = useState<CampaignLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leads] = useStore(leadsStore);
  const [open, setOpen] = useState<'new' | string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [c, l] = await Promise.all([listCreatives(), listLinks()]);
      setCreatives(c);
      setLinks(l);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(t);
  }, [reload]);

  const stats = useMemo(() => new Map((creatives ?? []).map((c) => {
    const mine = links.filter((l) => belongsTo(l.utm_content, c.id));
    return [c.id, { links: mine, clicks: mine.reduce((n, l) => n + l.clicks, 0), leads: creativeLeads(leads, c.id).length }];
  })), [creatives, links, leads]);

  const selected = creatives?.find((c) => c.id === open);
  const addLinks = (more: CampaignLink[]) => setLinks((cur) => [...more.filter((m) => !cur.some((x) => x.id === m.id)), ...cur]);

  return (
    <>
      <div className="tr-toolbar">
        <p>Cadastre a peça, copie o link de cada lugar e publique. O clique e o lead voltam para ela.</p>
        <button type="button" className="btn btn-solid" onClick={() => setOpen('new')}><Plus size={14} /> Novo criativo</button>
      </div>
      {error && <ErrorBanner title="Não foi possível carregar os criativos" onRetry={() => void reload()}>{error}</ErrorBanner>}

      {creatives && !creatives.length && (
        <EmptyState title="Nenhum criativo orgânico ainda" action={<button type="button" className="btn btn-solid" onClick={() => setOpen('new')}><Plus size={14} /> Novo criativo</button>}>
          Ao salvar, a peça ganha um ID e um link curto para cada lugar onde for divulgada.
        </EmptyState>
      )}

      {!!creatives?.length && (
        <ul className="tr-gallery">
          {creatives.map((c) => {
            const s = stats.get(c.id)!;
            const sources = [...new Set(s.links.map((l) => l.utm_source))];
            return (
              <li key={c.id}>
                <button type="button" className="tr-item" onClick={() => setOpen(c.id)}>
                  <Media creative={c} />
                  <span className="tr-item-body">
                    <strong>{c.title}</strong>
                    <small>{formatLabel(c.format)} · {c.campaign} · <code>{c.id}</code></small>
                    <span className="tr-item-logos">{sources.map((src) => <span key={src}>{logoOf(src, src)}</span>)}{!sources.length && <small>sem link ainda</small>}</span>
                    <span className="tr-metrics">
                      <span><b>{s.clicks}</b> {s.clicks === 1 ? 'clique' : 'cliques'}</span>
                      <span><b>{s.leads}</b> {s.leads === 1 ? 'lead' : 'leads'}</span>
                      <span>{c.postUrls.length ? 'publicado' : 'não publicado'}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open === 'new' && (
        <NewCreative
          onClose={() => setOpen(null)}
          onCreated={(c, made) => { setCreatives((cur) => [c, ...(cur ?? [])]); addLinks(made); setOpen(c.id); }}
        />
      )}
      {selected && (
        <CreativePanel
          key={selected.id}
          creative={selected}
          links={stats.get(selected.id)!.links}
          leads={stats.get(selected.id)!.leads}
          onClose={() => setOpen(null)}
          onLink={(l) => addLinks([l])}
          onPosts={(postUrls) => setCreatives((cur) => (cur ?? []).map((c) => (c.id === selected.id ? { ...c, postUrls } : c)))}
          onArchived={() => { setCreatives((cur) => (cur ?? []).filter((c) => c.id !== selected.id)); setOpen(null); }}
        />
      )}
    </>
  );
}

function NewCreative({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Creative, links: CampaignLink[]) => void }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [format, setFormat] = useState<CreativeFormat>('post');
  const [destination, setDestination] = useState('/diagnostico');
  const [campaign, setCampaign] = useState('diagnostico');
  const [touched, setTouched] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [channels, setChannels] = useState<string[]>(DEFAULT_CHANNELS);
  const [busy, setBusy] = useState<'' | 'upload' | 'save'>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listArticles().then((all) => setArticles(all.filter((a) => a.published))).catch(() => setArticles([])); }, []);

  const pickDestination = (value: string) => {
    setDestination(value);
    if (touched) return;
    const page = SITE_PAGES.find((p) => p.path === value);
    const art = articles.find((a) => `/blog/${a.slug}` === value);
    setCampaign(page ? page.campaign : art ? normalizeUTM(art.slug.replace(/-/g, '_')) : '');
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy('upload');
    setError(null);
    try { setMediaUrl(await uploadImage(file)); } catch (e) { setError(`A imagem não subiu: ${errorText(e)} Dá para salvar sem ela.`); } finally { setBusy(''); }
  };

  const ready = !!title.trim() && !!normalizeUTM(campaign) && channels.length > 0;

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      const c = await createCreative({ title, caption, format, campaign, destination, mediaUrl, postUrls: [] });
      const made: CampaignLink[] = [];
      // Um link que falhar não desfaz o criativo: dá para gerar de novo dentro dele.
      for (const ch of CHANNELS.filter((x) => channels.includes(x.id))) {
        try { made.push(await linkFor(c, ch)); } catch { /* aparece como "Gerar link" no criativo */ }
      }
      onCreated(c, made);
    } catch (e) {
      setError(errorText(e));
      setBusy('');
    }
  };

  const networks = [...new Set(CHANNELS.map((c) => c.network))];

  return (
    <SidePanel
      title="Novo criativo orgânico"
      subtitle="O ID e os links são criados ao salvar."
      onClose={onClose}
      footer={<button type="button" className="btn btn-solid" disabled={!ready || busy !== ''} onClick={() => void save()}>{busy === 'save' ? 'Criando…' : 'Salvar e gerar links'}</button>}
    >
      <div className="tr-form">
        {error && <ErrorBanner title="Não deu certo">{error}</ErrorBanner>}
        <Field label="Nome da peça"><input className="input" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="ex.: Reels sobre projetos de IA" /></Field>
        <Field label="Formato">
          <CustomSelect className="select" value={format} onChange={(e) => setFormat(e.target.value as CreativeFormat)} aria-label="Formato">
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </CustomSelect>
        </Field>
        <Field label="Legenda" hint={`${caption.length} de 3000 caracteres`}><textarea className="input" rows={6} maxLength={3000} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="O texto que vai junto com a publicação" /></Field>
        <Field label="Para onde o link leva">
          <CustomSelect className="select" value={destination} onChange={(e) => pickDestination(e.target.value)} aria-label="Página de destino">
            {SITE_PAGES.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
            {articles.map((a) => <option key={a.id} value={`/blog/${a.slug}`}>Artigo: {a.title}</option>)}
          </CustomSelect>
        </Field>
        <Field label="Tema" hint={campaign && normalizeUTM(campaign) !== campaign ? `Vai como: ${normalizeUTM(campaign)}` : 'Peças do mesmo tema são comparadas juntas.'}>
          <input className="input" value={campaign} onChange={(e) => { setCampaign(e.target.value); setTouched(true); }} />
        </Field>
        <Field label="Imagem de capa (opcional)" hint="JPG, PNG, GIF ou WebP até 8 MB.">
          <span className="tr-upload">
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={busy !== ''} onChange={(e) => void upload(e.target.files?.[0])} />
            {busy === 'upload' && <span><ImageUp size={14} /> Enviando…</span>}
          </span>
        </Field>
        {mediaUrl && <Media creative={{ mediaUrl, format, title }} />}
        <fieldset className="tr-channels">
          <legend>Onde vai divulgar</legend>
          {networks.map((n) => (
            <div key={n}>
              <span className="tr-network">{logoOf(CHANNELS.find((c) => c.network === n)!.source, n, 18)}{n}</span>
              {CHANNELS.filter((c) => c.network === n).map((c) => (
                <label key={c.id}>
                  <input type="checkbox" checked={channels.includes(c.id)} onChange={(e) => setChannels((cur) => (e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id)))} />
                  {c.place}
                </label>
              ))}
            </div>
          ))}
        </fieldset>
      </div>
    </SidePanel>
  );
}

function CreativePanel({ creative: c, links, leads, onClose, onLink, onPosts, onArchived }: {
  creative: Creative; links: CampaignLink[]; leads: number; onClose: () => void;
  onLink: (l: CampaignLink) => void; onPosts: (urls: string[]) => void; onArchived: () => void;
}) {
  const [copied, setCopied] = useState('');
  const [post, setPost] = useState('');
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await work(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setError('O navegador não deixou copiar. Selecione o link e copie à mão.');
    }
  };
  const missing = CHANNELS.filter((ch) => !links.some((l) => channelOfLink(l, c.id)?.id === ch.id));

  return (
    <SidePanel title={c.title} subtitle={`ID ${c.id} · ${formatLabel(c.format)} · tema ${c.campaign}`} onClose={onClose}>
      <div className="tr-form">
        {error && <ErrorBanner title="Não deu certo">{error}</ErrorBanner>}
        <Media creative={c} />
        <p className="tr-metrics tr-metrics-big">
          <span><b>{links.reduce((n, l) => n + l.clicks, 0)}</b> cliques</span>
          <span><b>{leads}</b> {leads === 1 ? 'lead' : 'leads'}</span>
        </p>

        <h3>Links para publicar</h3>
        <ul className="tr-links">
          {links.map((l) => {
            const ch = channelOfLink(l, c.id);
            const tip = ch ? placementTip(ch.id) : '';
            return (
              <li key={l.id}>
                <div className="tr-link-head">
                  {logoOf(l.utm_source, l.utm_source, 24)}
                  <span><strong>{ch ? `${ch.network} · ${ch.place}` : l.label}</strong><code>{shortLabel(l.code)}</code></span>
                  <small>{l.clicks} {l.clicks === 1 ? 'clique' : 'cliques'}</small>
                </div>
                {tip && <p>{tip}</p>}
                <div className="tr-actions">
                  <button type="button" className="btn btn-sm" onClick={() => void copy(l.id, shortUrl(l.code))}>{copied === l.id ? <Check size={12} /> : <Copy size={12} />} {copied === l.id ? 'Copiado' : 'Copiar link'}</button>
                  {c.caption && <button type="button" className="btn btn-sm" onClick={() => void copy(`c${l.id}`, captionWithLink(c.caption, shortUrl(l.code)))}>{copied === `c${l.id}` ? <Check size={12} /> : <Copy size={12} />} {copied === `c${l.id}` ? 'Copiado' : 'Copiar legenda e link'}</button>}
                </div>
              </li>
            );
          })}
        </ul>
        {missing.length > 0 && (
          <div className="tr-row">
            <CustomSelect className="select" value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Outro lugar de publicação">
              <option value="">Outro lugar…</option>
              {missing.map((ch) => <option key={ch.id} value={ch.id}>{ch.network} · {ch.place}</option>)}
            </CustomSelect>
            <button type="button" className="btn" disabled={!adding || busy} onClick={() => void run(async () => { onLink(await linkFor(c, missing.find((m) => m.id === adding)!)); setAdding(''); })}>Gerar link</button>
          </div>
        )}

        <h3>Publicações</h3>
        {c.postUrls.length === 0 && <p className="tr-hint">Depois de publicar, cole aqui o endereço do post.</p>}
        <ul className="tr-posts">
          {c.postUrls.map((u) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noreferrer">{u.replace(/^https?:\/\/(www\.)?/, '')} <ExternalLink size={12} /></a>
              <button type="button" className="link-btn" disabled={busy} onClick={() => void run(async () => { const next = c.postUrls.filter((x) => x !== u); await savePostUrls(c.id, next); onPosts(next); })}>remover</button>
            </li>
          ))}
        </ul>
        <div className="tr-row">
          <input className="input" type="url" value={post} onChange={(e) => setPost(e.target.value)} placeholder="https://www.instagram.com/p/…" aria-label="Endereço da publicação" />
          <button type="button" className="btn" disabled={!post.trim() || busy} onClick={() => void run(async () => { const next = [...new Set([...c.postUrls, post.trim()])]; await savePostUrls(c.id, next); onPosts(next); setPost(''); })}>Guardar</button>
        </div>

        {c.caption && (<><h3>Legenda</h3><p className="tr-caption">{c.caption}</p></>)}
        <p className="tr-hint">Criado por {c.createdBy || 'alguém da equipe'}{c.createdAt ? ` em ${formatDate(c.createdAt)}` : ''}. Leva para <code>{c.destination}</code>.</p>
        <button
          type="button" className="btn btn-danger" disabled={busy}
          onClick={() => { if (window.confirm(`Arquivar "${c.title}"? Os links já publicados continuam funcionando.`)) void run(async () => { await archiveCreative(c.id); onArchived(); }); }}
        >
          <Archive size={14} /> Arquivar criativo
        </button>
      </div>
    </SidePanel>
  );
}
