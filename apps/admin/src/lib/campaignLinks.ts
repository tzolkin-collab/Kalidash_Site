import { API_URL } from './api';
import { SITE_URL } from './site';

// Links de divulgação (tagueamento orgânico): os canais e a convenção de UTMs de docs/tracking.md, e o cliente de
// /api/blog/links (apps/api/campaign_links.go). O link curto é SITE_URL/l/<código>, resolvido pelo site.

export type CampaignLink = {
  id: string;
  code: string;
  destination: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  label: string;
  clicks: number;
  leads?: number;
  lastClickAt?: string;
  createdBy: string;
  createdAt?: string;
};

export type LinkInput = Pick<CampaignLink, 'destination' | 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'label'>;

/** Um lugar onde o link é colado. source/medium/content seguem a tabela de convenção de docs/tracking.md. */
export type ChannelPreset = { id: string; network: string; place: string; source: string; medium: string; content: string; tip?: string };

export const CHANNELS: ChannelPreset[] = [
  { id: 'ig-bio', network: 'Instagram', place: 'Link da bio', source: 'instagram', medium: 'social', content: 'bio' },
  { id: 'ig-stories', network: 'Instagram', place: 'Stories (figurinha de link)', source: 'instagram', medium: 'social', content: 'stories' },
  { id: 'ig-comentario', network: 'Instagram', place: '"Comente aqui" e resposta automática', source: 'instagram', medium: 'social', content: 'comentario' },
  { id: 'ig-dm', network: 'Instagram', place: 'Direct (DM)', source: 'instagram', medium: 'social', content: 'dm' },
  { id: 'li-post', network: 'LinkedIn', place: 'Post', source: 'linkedin', medium: 'social', content: 'post' },
  { id: 'li-comentario', network: 'LinkedIn', place: 'Primeiro comentário', source: 'linkedin', medium: 'social', content: 'comentario' },
  { id: 'li-perfil', network: 'LinkedIn', place: 'Perfil (Destaques / site)', source: 'linkedin', medium: 'social', content: 'perfil' },
  { id: 'wa-lista', network: 'WhatsApp', place: 'Lista de transmissão', source: 'whatsapp', medium: 'messaging', content: 'lista' },
  { id: 'wa-grupo', network: 'WhatsApp', place: 'Grupo', source: 'whatsapp', medium: 'messaging', content: 'grupo' },
  { id: 'wa-direto', network: 'WhatsApp', place: 'Conversa 1:1', source: 'whatsapp', medium: 'messaging', content: 'direto' },
  { id: 'wa-status', network: 'WhatsApp', place: 'Status', source: 'whatsapp', medium: 'messaging', content: 'status' },
  { id: 'yt-descricao', network: 'YouTube', place: 'Descrição do vídeo', source: 'youtube', medium: 'social', content: 'descricao' },
  { id: 'tt-bio', network: 'TikTok', place: 'Link da bio', source: 'tiktok', medium: 'social', content: 'bio' },
  { id: 'email-assinatura', network: 'E-mail', place: 'Assinatura de e-mail', source: 'email', medium: 'email', content: 'assinatura' },
];

/** Páginas fixas do site que costumam ser divulgadas (além dos artigos publicados). */
export const SITE_PAGES: { path: string; label: string; campaign: string }[] = [
  { path: '/', label: 'Home', campaign: 'home' },
  { path: '/diagnostico', label: 'Diagnóstico', campaign: 'diagnostico' },
  { path: '/blog', label: 'Blog (lista de artigos)', campaign: 'blog' },
  { path: '/sobre-nos', label: 'Sobre nós', campaign: 'sobre_nos' },
  { path: '/solucoes', label: 'Soluções', campaign: 'solucoes' },
  { path: '/treinamento-corporativo-ia', label: 'Treinamento corporativo em IA', campaign: 'treinamento_ia' },
  { path: '/consultoria-governanca-ia', label: 'Consultoria de governança de IA', campaign: 'governanca_ia' },
];

/** Mesma convenção da API (normalizeUTM) e sem acento: "Guia de IA" → "guia_de_ia". */
export function normalizeUTM(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[\s+]+/g, '_').replace(/[^a-z0-9_-]/g, '');
}

export function linkInputFor(destination: string, campaign: string, ch: ChannelPreset, piece: string): LinkInput {
  const extra = normalizeUTM(piece);
  return {
    destination,
    utm_source: ch.source,
    utm_medium: ch.medium,
    utm_campaign: normalizeUTM(campaign),
    utm_content: extra ? `${ch.content}_${extra}` : ch.content,
    label: `${ch.network} — ${ch.place}`,
  };
}

/** Link completo com UTMs (para quem prefere colar o endereço longo). */
export function fullUrl(input: Pick<LinkInput, 'destination' | 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content'>): string {
  const url = new URL(input.destination || '/', SITE_URL);
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const) {
    if (input[k]) url.searchParams.set(k, input[k]);
  }
  return url.toString();
}

export const shortUrl = (code: string) => `${SITE_URL.replace(/\/+$/, '')}/l/${code}`;
/** Para mostrar e ditar: "kalidash.com.br/l/abc123". */
export const shortLabel = (code: string) => shortUrl(code).replace(/^https?:\/\//, '');

async function errorOf(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.error) return body.error;
  } catch { /* sem corpo */ }
  return `erro ${res.status}`;
}

export async function listLinks(): Promise<CampaignLink[]> {
  const res = await fetch(`${API_URL}/api/blog/links`, { credentials: 'include' });
  if (!res.ok) throw new Error(await errorOf(res));
  return res.json();
}

export async function createLink(input: LinkInput): Promise<CampaignLink> {
  const res = await fetch(`${API_URL}/api/blog/links`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorOf(res));
  return res.json();
}

export async function archiveLink(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/blog/links/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok && res.status !== 404) throw new Error(await errorOf(res));
}
