import type { Role } from '../domain';
import { API_URL } from './api';
import { createStore, useStore } from './store';

// Sessão do admin (docs/auth-study.md). O servidor decide tudo: aqui só se pergunta "quem sou eu?"
// em GET /auth/me e se mostra a tela certa.
//   off     a API está sem AUTH_API (ou fora do ar): nada muda, o admin abre direto como antes
//   anon    a API exige login e não há sessão: mostra a tela de entrada
//   in      há sessão: `user` é a pessoa real, com o perfil que o servidor aplica
// A sessão é um cookie HttpOnly: o JavaScript nunca vê o token. Depois que a API confirma que o login
// está ligado, o fetch passa a mandar o cookie nas chamadas à API (credentials: 'include').

export type SessionUser = { id: string; name: string; email: string; role: Role; avatarUrl?: string; /** Escopos efetivos que o servidor aplica (ausente numa API antiga: vale o perfil). */ scopes?: string[] };
export type AuthState = {
  status: 'loading' | 'off' | 'anon' | 'in';
  user?: SessionUser;
  /** A API tem o login com Google configurado. */
  google: boolean;
  /** A API aceita a entrada de desenvolvimento (sem Google). */
  dev: boolean;
  /** Aviso para a tela de entrada (ex.: sessão expirada). */
  notice?: string;
};

export const authStore = createStore<AuthState>({ status: 'loading', google: false, dev: false });
export const useAuth = () => useStore(authStore)[0];

/** Id de quem está logado, ou undefined sem login (as telas de exemplo usam o usuário fictício). */
export const sessionUserId = () => authStore.get().user?.id;

let installed = false;

/** Faz o fetch mandar o cookie para a API e voltar ao login quando a sessão acaba (401). */
function installSessionFetch() {
  if (installed) return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(API_URL)) return original(input, init);
    const res = await original(input, { ...init, credentials: 'include' });
    if (res.status === 401 && authStore.get().status === 'in') {
      authStore.set((s) => ({ ...s, status: 'anon', user: undefined, notice: 'Sua sessão terminou. Entre de novo.' }));
      // a tela de entrada precisa saber quais formas de entrar a API oferece
      void original(`${API_URL}/auth/me`, { credentials: 'include' })
        .then((r) => r.json())
        .then((b: { google?: boolean; dev?: boolean }) => authStore.set((s) => ({ ...s, google: !!b.google, dev: !!b.dev })))
        .catch(() => undefined);
    }
    return res;
  };
}

export async function initAuth(): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
    if (res.status === 200) {
      installSessionFetch();
      authStore.set({ status: 'in', user: (await res.json()) as SessionUser, google: false, dev: false });
    } else if (res.status === 401) {
      installSessionFetch();
      const body = (await res.json().catch(() => ({}))) as { google?: boolean; dev?: boolean };
      authStore.set({ status: 'anon', google: !!body.google, dev: !!body.dev });
    } else {
      authStore.set({ status: 'off', google: false, dev: false });
    }
  } catch {
    // API sem login (a rota não existe, sem CORS) ou fora do ar: segue como antes
    authStore.set({ status: 'off', google: false, dev: false });
  }
}

export const startGoogleLogin = () => { window.location.href = `${API_URL}/auth/google/login`; };

/** Entrada de desenvolvimento (a API só aceita do próprio computador, com AUTH_DEV_LOGIN=1). */
export async function devLogin(email: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/dev/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (!res.ok) return res.status === 403 ? 'Este e-mail não está na equipe.' : 'Não foi possível entrar.';
    authStore.set({ status: 'in', user: (await res.json()) as SessionUser, google: false, dev: false });
    return null;
  } catch {
    return 'A API não respondeu.';
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  } finally {
    // recarrega para largar da memória tudo o que a pessoa carregou
    window.location.reload();
  }
}
