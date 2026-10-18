import type { Role } from '../domain';

// A matriz de permissões por perfil, sem React. O servidor aplica a mesma (apps/api/auth_middleware.go,
// routeAccess, e auth_rules.go): aqui só se decide o que esconder para não dar 403 na cara da pessoa.
export function capabilities(role: Role) {
  const manager = role === 'ADMIN' || role === 'MANAGER';
  return {
    /** Ver e editar o CPF inteiro. */
    revealCpf: manager,
    /** Trocar a origem e a fonte de um lead. */
    editOrigin: manager,
    /** Pipelines, fontes, tags e templates. */
    managePipelines: manager,
    /** Blog (rascunhos, escrita e upload). */
    manageBlog: manager,
    /** Convidar, trocar o perfil e desativar pessoas da equipe. */
    manageTeam: role === 'ADMIN',
  };
}
