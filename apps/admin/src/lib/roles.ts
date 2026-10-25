import type { Role } from '../domain';

// A matriz de permissões, sem React. O servidor decide por ESCOPO (apps/api/auth_scopes.go, routeScope) e os
// perfis são só conjuntos padrão de escopos: aqui se decide o que esconder para não dar 403 na cara da pessoa.
// Os presets abaixo espelham auth_scopes.go; com o login ligado a tela usa os escopos que o servidor devolve
// (/auth/me) e o catálogo de GET /api/access/catalog, então esta cópia só vale sem login.

// WP3b (D4): o Vendedor tem os escopos "own" (só o que é dele) no lugar de leads:read/leads:write.
const SELLER_SCOPES = ['leads:own', 'opportunities:own', 'people:read', 'people:write', 'history:read', 'history:write', 'pipelines:read', 'tasks:read', 'tasks:write', 'emails:send', 'team:read'];
const MANAGER_SCOPES = [...SELLER_SCOPES, 'leads:read', 'leads:write', 'leads:origin', 'people:document', 'pipelines:manage', 'blog:read', 'blog:write', 'automations:manage', 'keys:manage'];

/** Escopos padrão do perfil (sem extras nem removidos). `null` para o Admin = todos. */
export function presetScopes(role: Role): string[] | null {
  return role === 'ADMIN' ? null : role === 'MANAGER' ? MANAGER_SCOPES : SELLER_SCOPES;
}

export function hasScope(role: Role, scopes: string[] | undefined, scope: string): boolean {
  if (scopes) return scopes.includes(scope);
  const preset = presetScopes(role);
  return preset === null || preset.includes(scope);
}

export function capabilities(role: Role, scopes?: string[]) {
  const has = (s: string) => hasScope(role, scopes, s);
  return {
    /** Ver e editar o CPF inteiro. */
    revealCpf: has('people:document'),
    /** Trocar a origem e a fonte de um lead. */
    editOrigin: has('leads:origin'),
    /** Pipelines, fontes, tags e templates. */
    managePipelines: has('pipelines:manage'),
    /** Blog (rascunhos, escrita e upload). */
    manageBlog: has('blog:write'),
    /** Convidar, trocar o perfil, os escopos e desativar pessoas da equipe. */
    manageTeam: has('team:manage'),
  };
}
