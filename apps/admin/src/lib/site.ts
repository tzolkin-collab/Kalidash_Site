// URL pública do site (Next). As rotas /preview/* dele são embutidas num iframe aqui no admin.
// Sobrescreva com VITE_SITE_URL (ex.: no .env.local) fora do ambiente local.
export const SITE_URL: string = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SITE_URL) ?? 'http://localhost:3000'
).replace(/\/$/, '');
export const SITE_ORIGIN: string = new URL(SITE_URL).origin;

/**
 * Converte URLs relativas (ex.: /kalidash-hero-sculpture.png) na URL absoluta apontando para o site (Next),
 * para que imagens de template e assets públicos do site carreguem corretamente no admin.
 */
export function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return `${SITE_URL}${trimmed}`;
  }
  return trimmed;
}

