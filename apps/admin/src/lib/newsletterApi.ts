import { useEffect } from 'react';
import type { Article } from '../domain';
import { API_URL } from './api';
import { resolveAssetUrl, SITE_URL } from './site';
import { createStore, useStore } from './store';

// Edições da newsletter (apps/api/newsletter_editions.go): cada edição usa um modelo salvo em E-mails e sai pelo
// Resend Broadcasts, para um segmento (público). 'off' quando a API não tem EMAIL_AUTOMATIONS=1 (rota 404).

export type EditionStatus = 'DRAFT' | 'SENDING' | 'SCHEDULED' | 'SENT' | 'FAILED';

export type NewsletterEdition = {
  id: string;
  name: string;
  templateId: string;
  template: string;
  subject: string;
  previewText: string;
  audience: string;
  status: EditionStatus;
  broadcastId?: string;
  scheduledAt?: string;
  sentAt?: string;
  lastError?: string;
  createdBy: string;
  sentBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type NewsletterAudience = { id: string; label: string; configured: boolean };

export type SyncState = { running: boolean; total: number; done: number; failed: number; finishedAt?: string; error?: string };

export type NewsletterState = {
  mode: 'loading' | 'api' | 'off';
  configured: boolean;
  from: string;
  audiences: NewsletterAudience[];
  editions: NewsletterEdition[];
  sync: SyncState;
  error?: string;
};

export type EditionInput = { name: string; templateId: string; subject: string; previewText: string; audience: string };

const emptySync: SyncState = { running: false, total: 0, done: 0, failed: 0 };

export const newsletterStore = createStore<NewsletterState>({ mode: 'loading', configured: false, from: '', audiences: [], editions: [], sync: emptySync });

export function useNewsletterBoot() {
  const [s] = useStore(newsletterStore);
  useEffect(() => {
    if (s.mode === 'loading') void loadNewsletter();
  }, [s.mode]);
  return s;
}

async function errorOf(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch { /* corpo sem JSON */ }
  if (res.status === 403) return 'Só Admin e Gerente enviam a newsletter.';
  return `A API respondeu ${res.status}.`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(await errorOf(res));
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function loadNewsletter(): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/email/newsletter`);
    if (!res.ok) {
      newsletterStore.set((s) => ({ ...s, mode: 'off', error: res.status === 404 ? undefined : `A API respondeu ${res.status}.` }));
      return;
    }
    const data = (await res.json()) as Omit<NewsletterState, 'mode'>;
    newsletterStore.set({ mode: 'api', configured: data.configured, from: data.from, audiences: data.audiences, editions: data.editions, sync: data.sync ?? emptySync });
  } catch {
    newsletterStore.set((s) => ({ ...s, mode: 'off' }));
  }
}

const upsert = (e: NewsletterEdition) =>
  newsletterStore.set((s) => ({ ...s, editions: s.editions.some((x) => x.id === e.id) ? s.editions.map((x) => (x.id === e.id ? e : x)) : [e, ...s.editions] }));

export async function saveEdition(input: EditionInput, id?: string): Promise<NewsletterEdition> {
  const e = id
    ? await call<NewsletterEdition>(`/api/email/newsletter/editions/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })
    : await call<NewsletterEdition>('/api/email/newsletter/editions', { method: 'POST', body: JSON.stringify(input) });
  upsert(e);
  return e;
}

export async function deleteEdition(id: string): Promise<void> {
  await call<void>(`/api/email/newsletter/editions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  newsletterStore.set((s) => ({ ...s, editions: s.editions.filter((x) => x.id !== id) }));
}

/** Manda a edição só para quem está logado. Devolve o e-mail de destino. */
export async function testEdition(id: string): Promise<string> {
  const r = await call<{ to: string }>(`/api/email/newsletter/editions/${encodeURIComponent(id)}/test`, { method: 'POST' });
  return r.to;
}

/** Envia agora (sem data) ou agenda. Em falha a edição volta com o erro e fica como FAILED. */
export async function sendEdition(id: string, scheduledAt?: string): Promise<NewsletterEdition> {
  const res = await fetch(`${API_URL}/api/email/newsletter/editions/${encodeURIComponent(id)}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scheduledAt ? { scheduledAt } : {}),
  });
  if (!res.ok) {
    let msg = `A API respondeu ${res.status}.`;
    try {
      const body = await res.json();
      if (body?.edition) upsert(body.edition);
      if (typeof body?.error === 'string') msg = body.error;
    } catch { /* sem JSON */ }
    throw new Error(msg);
  }
  const e = (await res.json()) as NewsletterEdition;
  upsert(e);
  return e;
}

export async function startSync(): Promise<void> {
  const st = await call<SyncState>('/api/email/newsletter/sync', { method: 'POST' });
  newsletterStore.set((s) => ({ ...s, sync: st }));
}

export const EDITION_STATUS: Record<EditionStatus, { label: string; tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  SENDING: { label: 'Enviando', tone: 'info' },
  SCHEDULED: { label: 'Agendada', tone: 'warning' },
  SENT: { label: 'Enviada', tone: 'success' },
  FAILED: { label: 'Falhou', tone: 'danger' },
};

// ---- modelo a partir de um artigo ----

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FONT = "font-family:Arial,Helvetica,sans-serif;";
const INLINE: Record<string, string> = {
  p: `${FONT}font-size:16px;line-height:26px;color:#2b2b2b;margin:0 0 16px;`,
  h1: `${FONT}font-size:26px;line-height:32px;color:#111;margin:24px 0 12px;`,
  h2: `${FONT}font-size:22px;line-height:28px;color:#111;margin:24px 0 12px;`,
  h3: `${FONT}font-size:18px;line-height:24px;color:#111;margin:20px 0 10px;`,
  ul: `${FONT}font-size:16px;line-height:26px;color:#2b2b2b;margin:0 0 16px;padding-left:22px;`,
  ol: `${FONT}font-size:16px;line-height:26px;color:#2b2b2b;margin:0 0 16px;padding-left:22px;`,
  li: 'margin:0 0 6px;',
  blockquote: `${FONT}font-size:16px;line-height:26px;color:#555;margin:0 0 16px;padding:4px 0 4px 16px;border-left:3px solid #ddd;`,
  a: 'color:#111;text-decoration:underline;',
  img: 'max-width:100%;height:auto;display:block;border-radius:8px;margin:8px 0 16px;',
};

/** Deixa o HTML do artigo (BlockNote) pronto para e-mail: estilos inline, imagens absolutas, sem scripts. */
function emailSafeBody(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  root.querySelectorAll('script, style, iframe, video, audio, form, input, button').forEach((n) => n.remove());
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on') || attr.name === 'class' || attr.name.startsWith('data-')) el.removeAttribute(attr.name);
    }
    const tag = el.tagName.toLowerCase();
    if (INLINE[tag]) el.setAttribute('style', INLINE[tag]);
    if (tag === 'img') el.setAttribute('src', resolveAssetUrl(el.getAttribute('src')));
    if (tag === 'a') {
      const href = el.getAttribute('href') ?? '';
      if (href.startsWith('/')) el.setAttribute('href', `${SITE_URL}${href}`);
    }
  });
  return root.innerHTML;
}

/** HTML do e-mail de uma edição feita a partir de um artigo: capa, título, resumo, o texto e o botão para o blog. */
export function articleEmailHTML(a: Article, opts: { full: boolean }): string {
  const url = `${SITE_URL}/blog/${encodeURIComponent(a.slug)}?utm_source=newsletter&utm_medium=email&utm_campaign=${encodeURIComponent(a.slug)}`;
  const cover = a.coverImageUrl ? `<img src="${esc(resolveAssetUrl(a.coverImageUrl))}" alt="" width="560" style="${INLINE.img}margin:0 0 20px;">` : '';
  const body = opts.full ? emailSafeBody(a.body) : '';
  const inner = [
    `<p style="${INLINE.p}">Oi, {{primeiro_nome}}!</p>`,
    cover,
    `<h1 style="${INLINE.h1}margin-top:0;">${esc(a.title)}</h1>`,
    a.excerpt ? `<p style="${INLINE.p}color:#555;">${esc(a.excerpt)}</p>` : '',
    body,
    `<p style="margin:24px 0 8px;"><a href="${esc(url)}" style="${FONT}display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 22px;border-radius:8px;">${opts.full ? 'Ver no blog' : 'Ler o artigo completo'}</a></p>`,
  ].filter(Boolean).join('\n');
  // Coluna de 600px centralizada (tabela: é o que todo cliente de e-mail respeita).
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;"><tr><td align="center" style="padding:24px 12px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;"><tr><td style="text-align:left;">\n${inner}\n</td></tr></table>`
    + `</td></tr></table>`;
}
