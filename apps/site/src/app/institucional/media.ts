/* Regras do player de depoimentos (usadas pelo servidor, em SitePage, e pelo cliente, em Motion). */

/* Hosts permitidos para MP4 hospedado (somente https). GUSTAVO: preencher com o host público do bucket do
 * Cloudflare R2, por exemplo "pub-xxxxxxxx.r2.dev" ou o domínio próprio ligado ao bucket. Vazio = nenhum MP4 toca. */
export const ALLOWED_MEDIA_HOSTS: string[] = [];

const EMBED = /^https:\/\/(www\.youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)/;

export type MediaKind = "embed" | "video" | null;

export function mediaKind(url: string): MediaKind {
  if (!url) return null;
  if (EMBED.test(url)) return "embed";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && ALLOWED_MEDIA_HOSTS.includes(parsed.hostname) && /\.mp4$/i.test(parsed.pathname)) {
      return "video";
    }
  } catch {
    /* URL inválida: não toca */
  }
  return null;
}
