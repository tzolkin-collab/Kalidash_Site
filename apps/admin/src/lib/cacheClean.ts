// Sem import do virtual:pwa-register para poder ser usado por auth.ts nos testes em Node.

/** No logout: apaga todo cache que não seja o pré-cache do app shell (defesa em profundidade; a API já não é cacheada). */
export async function clearUserCaches(): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.includes('precache')).map((k) => caches.delete(k)));
  } catch {
    /* sem Cache Storage: nada a limpar */
  }
}
