import { registerSW } from 'virtual:pwa-register';
import { createStore, useStore } from './store';

// PWA (docs/pwa.md). O service worker só guarda o app shell e os assets estáticos; API e login nunca
// passam pelo cache (vite.config.ts). Versão nova não troca sozinha: avisa e espera o "Atualizar".

export type PwaState = { needRefresh: boolean; online: boolean };

export const pwaStore = createStore<PwaState>({ needRefresh: false, online: typeof navigator === 'undefined' ? true : navigator.onLine });
export const usePwa = () => useStore(pwaStore)[0];

let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined;

/** Troca para a versão nova e recarrega. Só roda por clique da pessoa. */
export const updateApp = () => void applyUpdate?.(true);

const CHECK_MS = 60 * 60 * 1000;

export function initPwa(): void {
  window.addEventListener('online', () => pwaStore.set((s) => ({ ...s, online: true })));
  window.addEventListener('offline', () => pwaStore.set((s) => ({ ...s, online: false })));
  // sem service worker (dev sem PWA_DEV=1) o registro é um no-op
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh: () => pwaStore.set((s) => ({ ...s, needRefresh: true })),
    // abas abertas por dias também descobrem a versão nova
    onRegisteredSW: (_url, reg) => { if (reg) setInterval(() => { if (navigator.onLine) void reg.update().catch(() => undefined); }, CHECK_MS); },
  });
}
