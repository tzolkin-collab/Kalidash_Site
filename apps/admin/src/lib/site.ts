// URL pública do site (Next). As rotas /preview/* dele são embutidas num iframe aqui no admin.
// Sobrescreva com VITE_SITE_URL (ex.: no .env.local) fora do ambiente local.
export const SITE_URL: string = (import.meta.env.VITE_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const SITE_ORIGIN: string = new URL(SITE_URL).origin;
