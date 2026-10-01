// URL pública do site (canonical, sitemap, Open Graph). Mesmo valor do metadataBase do layout.
export const SITE_URL: string = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kalidash.com.br").replace(/\/$/, "");
