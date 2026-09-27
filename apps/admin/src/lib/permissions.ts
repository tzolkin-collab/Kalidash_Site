import type { Role } from '../domain';
import { CURRENT_USER_ID, teamStore } from '../mocks/team';
import { useStore } from './store';

// Permissões por perfil (docs/system-core.md). No protótipo o usuário atual é o Admin; o perfil vem da equipe.

export function useCan() {
  const [team] = useStore(teamStore);
  const role: Role = team.find((m) => m.id === CURRENT_USER_ID)?.role ?? 'SELLER';
  const manager = role === 'ADMIN' || role === 'MANAGER';
  return {
    role,
    /** Ver e editar o CPF inteiro. */
    revealCpf: manager,
    /** Trocar a origem de um lead. */
    editOrigin: manager,
    /** Pipelines, fontes, tags e templates. */
    managePipelines: manager,
  };
}
