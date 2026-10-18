import type { Role } from '../domain';
import { CURRENT_USER_ID, teamStore } from '../mocks/team';
import { authStore } from './auth';
import { capabilities } from './roles';
import { useStore } from './store';

// Permissões por perfil (docs/system-core.md). Com o login ligado (AUTH_API) o perfil é o da sessão e o
// servidor aplica as mesmas regras (apps/api/auth_middleware.go e auth_rules.go): aqui só se esconde o que
// daria 403. Sem login, o usuário atual é o Admin de exemplo e o perfil vem da equipe de exemplo.

export function useCan() {
  const [team] = useStore(teamStore);
  const [auth] = useStore(authStore);
  const role: Role = auth.status === 'in' && auth.user ? auth.user.role : (team.find((m) => m.id === CURRENT_USER_ID)?.role ?? 'SELLER');
  return { role, ...capabilities(role) };
}
