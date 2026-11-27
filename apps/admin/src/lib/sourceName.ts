/** Nome da fonte para mostrar: "Site — site-pagina-diagnostico" vira "Site — diagnostico". O valor guardado não muda. */
export function shortSource(name: string): string {
  const m = name.match(/^(.+?)\s+[—–-]{1,2}\s+(.+)$/);
  if (!m) return name;
  const tail = m[2].replace(/^site-(pagina-)?/i, '');
  return `${m[1]} — ${tail || m[2]}`;
}

/** A fonte vem de uma página do site (ganha o ícone de site). */
export const isSiteSource = (name: string) => /^site\b/i.test(name.trim());
