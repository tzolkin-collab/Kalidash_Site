import type { Lead } from '../domain.ts';

// Canal de aquisição de um lead (Analytics). Regra única, na ordem da tabela de docs/tracking.md (seção Analytics),
// a partir da atribuição gravada em Lead.customData.attribution (site e connect.js) e da origem do lead.
// Sem React e sem imports de valor: testável com `node --test`.

export type Touch = 'first' | 'last';
export type ChannelGroup = 'pago' | 'organico' | 'mensagem' | 'busca' | 'indicacao' | 'direto' | 'projeto' | 'outbound';
export type Channel = { key: string; label: string; group: ChannelGroup };

export const GROUP_LABEL: Record<ChannelGroup, string> = {
  pago: 'Mídia paga',
  organico: 'Social orgânico',
  mensagem: 'Mensagens e e-mail',
  busca: 'Busca orgânica',
  indicacao: 'Indicação (sites)',
  direto: 'Direto / sem origem',
  projeto: 'Projetos conectados',
  outbound: 'Outbound',
};

export const UNTRACKED_KEY = 'direto';

export type Attribution = Record<string, string>;

/** Atribuição do lead como texto (chaves desconhecidas e valores não textuais ficam de fora). */
export function attributionOf(lead: Pick<Lead, 'customData'>): Attribution {
  const raw = lead.customData?.attribution;
  const out: Attribution = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
  }
  return out;
}

const NETWORK: Record<string, string> = {
  instagram: 'Instagram', ig: 'Instagram', linkedin: 'LinkedIn', facebook: 'Facebook', fb: 'Facebook', meta: 'Meta',
  youtube: 'YouTube', tiktok: 'TikTok', twitter: 'X', x: 'X', threads: 'Threads', pinterest: 'Pinterest',
};

const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const networkName = (source: string) => NETWORK[source] ?? titleCase(source || 'outra rede');

const PAID_MEDIUM = /^(cpc|ppc|paid|paid_social|paidsocial|paid-social|display|cpm)$/;
const SEARCH_HOST = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|baidu|search\.brave)\./;
const SOCIAL_HOST: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'twitter'],
  [/(^|\.)threads\.net$/, 'threads'],
];
const OWN_HOST = /(^|\.)kalidash\.com(\.br)?$|^localhost$/;

function hostOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

// Anúncios antigos da conta usam utm_source={{site_source_name}} (fb, ig, an, msg: só a Meta preenche assim) e o nome
// do conjunto em utm_medium. Sem um meio da nossa convenção, é anúncio da Meta; os orgânicos usam "instagram"/"social".
const META_PLACEMENT = /^(fb|ig|an|msg)$/;
const OWN_MEDIUM = /^(social|messaging|email|organic|referral)$/;

function fromUtm(source: string, medium: string): Channel | null {
  if (!source && !medium) return null;
  if (META_PLACEMENT.test(source) && medium && !OWN_MEDIUM.test(medium)) return { key: 'meta_ads', label: 'Meta Ads', group: 'pago' };
  if (PAID_MEDIUM.test(medium)) {
    if (source === 'google' || medium === 'cpc' && !source) return { key: 'google_ads', label: 'Google Ads', group: 'pago' };
    if (['meta', 'facebook', 'fb', 'instagram', 'ig'].includes(source)) return { key: 'meta_ads', label: 'Meta Ads', group: 'pago' };
    if (source === 'linkedin') return { key: 'linkedin_ads', label: 'LinkedIn Ads', group: 'pago' };
    return { key: `pago_${source || 'outro'}`, label: `Mídia paga · ${titleCase(source || 'outra')}`, group: 'pago' };
  }
  if (medium === 'social') return { key: `org_${NETWORK[source] ? NETWORK[source].toLowerCase() : source || 'outra'}`, label: `Orgânico · ${networkName(source)}`, group: 'organico' };
  if (medium === 'messaging' || source === 'whatsapp') return { key: 'whatsapp', label: 'WhatsApp', group: 'mensagem' };
  if (medium === 'email' || source === 'newsletter') return { key: 'email', label: 'E-mail e newsletter', group: 'mensagem' };
  if (medium === 'organic' && source) return { key: 'busca', label: 'Busca orgânica', group: 'busca' };
  if (medium === 'referral') return { key: 'indicacao', label: 'Indicação (outros sites)', group: 'indicacao' };
  // UTM fora da convenção: ainda é origem rastreada, com o nome que veio.
  return { key: `outro_${source || medium}`, label: `${titleCase(source || medium)} (${medium || 'sem medium'})`, group: 'indicacao' };
}

function fromReferrer(ref: string | undefined): Channel | null {
  const host = hostOf(ref);
  if (!host || OWN_HOST.test(host)) return null;
  if (SEARCH_HOST.test(host)) return { key: 'busca', label: 'Busca orgânica', group: 'busca' };
  for (const [re, net] of SOCIAL_HOST) {
    if (re.test(host)) return { key: `org_${NETWORK[net].toLowerCase()}`, label: `Orgânico · ${NETWORK[net]}`, group: 'organico' };
  }
  return { key: 'indicacao', label: 'Indicação (outros sites)', group: 'indicacao' };
}

/** Tem primeiro toque gravado (leads de antes do tagueamento 360 só têm o último). */
const hasFirstTouch = (a: Attribution) => !!(a.first_utm_source || a.first_utm_medium || a.landing_page || a.first_seen_at);

/**
 * Canal do lead.
 * - Outbound e projetos conectados vêm da origem do lead (não dependem de UTM).
 * - Último toque: UTMs da última campanha; gclid/gbraid/wbraid = Google Ads (autotag só existe em anúncio);
 *   fbclid sozinho NÃO é anúncio (a Meta põe fbclid em qualquer link de post) = Orgânico · Facebook/Instagram;
 *   sem UTM, o referrer externo (buscador, rede social, outro site); nada = Direto / sem origem.
 * - Primeiro toque: first_utm_*. Sem campanha no primeiro toque mas com campanha depois = Direto (a descoberta não
 *   foi por campanha); sem campanha em nenhum toque, usa as mesmas pistas do último. Leads sem primeiro toque gravado
 *   usam o último.
 */
export function channelOf(lead: Pick<Lead, 'origin' | 'customData' | 'sourceName'>, touch: Touch = 'first'): Channel {
  if (lead.origin === 'OUTBOUND') return { key: 'outbound', label: 'Outbound', group: 'outbound' };
  const projectName = lead.customData?.projectName;
  if (lead.customData?.projectId) {
    const name = typeof projectName === 'string' && projectName ? projectName : lead.sourceName || 'projeto';
    return { key: `projeto_${String(lead.customData.projectId)}`, label: `Projeto · ${name}`, group: 'projeto' };
  }
  const a = attributionOf(lead);
  if (touch === 'first' && hasFirstTouch(a)) {
    const first = fromUtm((a.first_utm_source ?? '').toLowerCase(), (a.first_utm_medium ?? '').toLowerCase());
    if (first) return first;
    // Primeiro toque sem UTM e com UTM depois: a descoberta não foi por campanha (direto ou sem origem rastreável).
    // Sem UTM em nenhum toque, a melhor pista do primeiro é a mesma do último (referrer, fbclid, gclid).
    if (a.utm_source || a.utm_medium) return { key: UNTRACKED_KEY, label: GROUP_LABEL.direto, group: 'direto' };
  }
  const utm = fromUtm((a.utm_source ?? '').toLowerCase(), (a.utm_medium ?? '').toLowerCase());
  if (utm) return utm;
  if (a.gclid || a.gbraid || a.wbraid) return { key: 'google_ads', label: 'Google Ads', group: 'pago' };
  if (a.fbclid) {
    const ref = fromReferrer(a.referrer);
    return ref?.group === 'organico' ? ref : { key: 'org_facebook', label: 'Orgânico · Facebook/Instagram', group: 'organico' };
  }
  return fromReferrer(a.referrer) ?? { key: UNTRACKED_KEY, label: GROUP_LABEL.direto, group: 'direto' };
}

/** Campanha (utm_campaign) do toque escolhido, ou "" sem campanha. */
export function campaignOf(lead: Pick<Lead, 'customData'>, touch: Touch = 'first'): string {
  const a = attributionOf(lead);
  if (touch === 'first' && hasFirstTouch(a)) return a.first_utm_campaign ?? '';
  return a.utm_campaign ?? '';
}

/** Página de entrada (só o caminho): landing_page do primeiro toque, ou a página do formulário. */
export function landingOf(lead: Pick<Lead, 'customData'>): string {
  const a = attributionOf(lead);
  const raw = a.landing_page || a.page_url || '';
  if (!raw) return '';
  try {
    const u = new URL(raw, 'https://kalidash.com.br');
    return u.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}
