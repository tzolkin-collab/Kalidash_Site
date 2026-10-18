// A tag do connect.js (lógica pura, para testar). A chave é publicável (forms:write): pode ficar no HTML.
export function buildSnippet(apiUrl: string, key: string): string {
  return `<script src="${apiUrl.replace(/\/$/, '')}/connect.js" data-key="${key}" defer></script>`;
}

/** Lê o data-key de um snippet colado e diz se tem o formato de chave (kld_live_… ou kld_test_…). */
export function readSnippetKey(html: string): { key?: string; env?: 'live' | 'test' } {
  const key = /data-key=["']([^"']+)["']/.exec(html)?.[1];
  const m = key && /^kld_(live|test)_[A-Za-z0-9_-]{4,}$/.exec(key);
  return m ? { key, env: m[1] as 'live' | 'test' } : {};
}
