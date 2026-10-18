import type { Role } from '../domain';
import { CURRENT_USER_ID, teamStore } from '../mocks/team';
import { authStore } from './auth';
import { capabilities, hasScope } from './roles';
import { useStore } from './store';

// Permissões por ESCOPO (docs/system-core.md, docs/auth-study.md). Com o login ligado (AUTH_API) valem os escopos
// efetivos da sessão e o servidor aplica as mesmas regras (apps/api/auth_scopes.go): aqui só se esconde o que
// daria 403. Sem login, o usuário atual é o Admin de exemplo e o perfil vem da equipe de exemplo.

export function useCan() {
  const [team] = useStore(teamStore);
  const [auth] = useStore(authStore);
  const live = auth.status === 'in' && auth.user;
  const role: Role = live ? auth.user!.role : (team.find((m) => m.id === CURRENT_USER_ID)?.role ?? 'SELLER');
  const scopes = live ? auth.user!.scopes : undefined;
  return { role, scopes, has: (scope: string) => hasScope(role, scopes, scope), manageKeys: hasScope(role, scopes, 'keys:manage'), ...capabilities(role, scopes) };
}
