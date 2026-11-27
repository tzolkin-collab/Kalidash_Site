// Logo do provedor (canal, plataforma, rede) e favicon da conta (empresa do lead, projeto). Os arquivos vêm do próprio
// site do provedor, como em components/ProviderLogo.tsx; se não carregar, a tela mostra as iniciais ou um ícone.

const FACEBOOK = 'https://www.facebook.com/favicon.ico';
const LINKEDIN = 'https://www.linkedin.com/favicon.ico';

export const PROVIDER_LOGO: Record<string, string> = {
  google: 'https://www.google.com/favicon.ico',
  google_ads: 'https://www.gstatic.com/images/branding/product/1x/ads_48dp.png',
  ga4: 'https://www.gstatic.com/images/branding/product/1x/analytics_48dp.png',
  meta: FACEBOOK,
  facebook: FACEBOOK,
  linkedin: LINKEDIN,
  instagram: 'https://static.cdninstagram.com/rsrc.php/y4/r/QaBlI0OZiks.ico',
  youtube: 'https://www.youtube.com/favicon.ico',
  tiktok: 'https://www.tiktok.com/favicon.ico',
  x: 'https://x.com/favicon.ico',
  pinterest: 'https://www.pinterest.com/favicon.ico',
  whatsapp: 'https://web.whatsapp.com/favicon.ico',
  bing: 'https://www.bing.com/favicon.ico',
  // o Clarity não publica favicon num endereço estável: vai o da Microsoft, dona do produto
  clarity: 'https://www.microsoft.com/favicon.ico',
  site: '/site-icon.svg',
};

const ALIAS: Record<string, string> = { ig: 'instagram', fb: 'facebook', twitter: 'x' };

/** Provedor de um utm_source ("ig", "google"…); undefined quando não é uma marca conhecida. */
export function providerOfSource(source: string): string | undefined {
  const s = source.trim().toLowerCase();
  const key = ALIAS[s] ?? s;
  return PROVIDER_LOGO[key] ? key : undefined;
}

/** Provedor de uma chave de canal (lib/channels.ts). Canais sem dono (direto, outbound, busca, indicação) não têm. */
export function providerOfChannel(key: string): string | undefined {
  if (key === 'google_ads') return 'google_ads';
  if (key === 'meta_ads') return 'meta';
  if (key === 'linkedin_ads') return 'linkedin';
  if (key === 'whatsapp') return 'whatsapp';
  const m = /^(?:org|pago|outro)_(.+)$/.exec(key);
  return m ? providerOfSource(m[1]) : undefined;
}

/** Caixas pessoais: o domínio não identifica a empresa da conta. */
const PERSONAL = /^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|icloud|me|aol|proton|protonmail|uol|bol|terra|ig|globo)\./;
/** Domínios reservados para teste não têm favicon (RFC 2606). */
const RESERVED = /\.(test|example|invalid|localhost|local)$|^example\.(com|net|org)$/;

/** Domínio da conta a partir do site da empresa ou, sem ele, do e-mail corporativo. */
export function accountDomain(website?: string, email?: string): string | undefined {
  const fromSite = website?.trim();
  let host = '';
  if (fromSite) {
    try { host = new URL(/^https?:\/\//i.test(fromSite) ? fromSite : `https://${fromSite}`).hostname; } catch { host = ''; }
  }
  if (!host) {
    const at = email?.split('@')[1]?.trim() ?? '';
    host = PERSONAL.test(at.toLowerCase()) ? '' : at;
  }
  host = host.toLowerCase().replace(/^www\./, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && !RESERVED.test(host) ? host : undefined;
}
