import { API_URL } from './api.ts';

// Criativos orgânicos (apps/api/creatives.go). O ID do criativo é o fim do utm_content dos links dele
// ("stories_cr7k2m9q"), e é por aí que cliques e leads voltam para a peça. Regras puras em creativeRules.ts.

export type CreativeFormat = 'post' | 'carrossel' | 'reels' | 'stories' | 'video';

export const FORMATS: { id: CreativeFormat; label: string }[] = [
  { id: 'post', label: 'Post' },
  { id: 'carrossel', label: 'Carrossel' },
  { id: 'reels', label: 'Reels' },
  { id: 'stories', label: 'Stories' },
  { id: 'video', label: 'Vídeo' },
];

export type Creative = {
  id: string;
  title: string;
  caption: string;
  format: CreativeFormat;
  campaign: string;
  destination: string;
  mediaUrl: string;
  postUrls: string[];
  createdBy: string;
  createdAt?: string;
};

export type CreativeInput = Pick<Creative, 'title' | 'caption' | 'format' | 'campaign' | 'destination' | 'mediaUrl' | 'postUrls'>;

export { belongsTo, captionWithLink, creativeLeads, placementTip } from './creativeRules.ts';

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined });
  if (!res.ok) {
    let msg = `erro ${res.status}`;
    try { msg = ((await res.json()) as { error?: string }).error ?? msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return res;
}

export const listCreatives = async (): Promise<Creative[]> => (await request('/api/blog/creatives')).json();
export const createCreative = async (input: CreativeInput): Promise<Creative> => (await request('/api/blog/creatives', { method: 'POST', body: JSON.stringify(input) })).json();
export const savePostUrls = async (id: string, postUrls: string[]): Promise<void> => { await request(`/api/blog/creatives/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ postUrls }) }); };
export const archiveCreative = async (id: string): Promise<void> => { await request(`/api/blog/creatives/${encodeURIComponent(id)}`, { method: 'DELETE' }); };
