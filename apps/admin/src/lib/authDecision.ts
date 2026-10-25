// Decisão pura de /auth/me (testada em tests/authDecision.test.ts). Regra D26: com o login ligado e
// o servidor inalcançável, o app nunca abre em modo de exemplo nem só com o shell.

export const AUTH_CONFIGURED_KEY = 'kalidash.auth.configured.v1';

export type MeOutcome = 'ok' | 'unauthorized' | 'missing' | 'failed';
export type AuthDecision = 'in' | 'anon' | 'off' | 'unreachable';

/** `missing`: a rota não existe (API sem login). `failed`: falha de rede ou 5xx. */
export function classifyMe(status: number | null): MeOutcome {
  if (status === 200) return 'ok';
  if (status === 401) return 'unauthorized';
  if (status === null || status >= 500) return 'failed';
  return 'missing';
}

/** `configured`: esta aba/instalação já viu a API responder com o login ligado. */
export function decideAuth(outcome: MeOutcome, configured: boolean): AuthDecision {
  if (outcome === 'ok') return 'in';
  if (outcome === 'unauthorized') return 'anon';
  if (outcome === 'failed') return configured ? 'unreachable' : 'off';
  return 'off';
}

export const readConfigured = (): boolean => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(AUTH_CONFIGURED_KEY) === '1'; } catch { return false; }
};
export const writeConfigured = (on: boolean): void => {
  try {
    if (typeof localStorage === 'undefined') return;
    if (on) localStorage.setItem(AUTH_CONFIGURED_KEY, '1'); else localStorage.removeItem(AUTH_CONFIGURED_KEY);
  } catch { /* storage bloqueado: segue sem o indicador */ }
};
