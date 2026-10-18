import type { Role, TeamMember } from '../domain';
import { teamStore } from '../mocks/team';
import { API_URL } from './api';

// Equipe na API (/api/team), só quando o login está ligado. Sem ele a aba Equipe segue com o exemplo.
// Ler a lista vale para qualquer pessoa logada (alimenta os seletores de responsável); convidar,
// trocar o perfil e desativar são só do Admin, e o servidor recusa as demais.

type Wire = TeamMember & { active?: boolean };

const json = { 'Content-Type': 'application/json' };

export async function loadTeam(): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/team`);
    if (!res.ok) return;
    const list = (await res.json()) as Wire[];
    teamStore.set(list.map((m) => ({ id: m.id, name: m.name || m.email, email: m.email, role: m.role, status: m.status, lastAccess: m.lastAccess, root: m.root, scopes: m.scopes, scopesExtra: m.scopesExtra, scopesDenied: m.scopesDenied })));
  } catch {
    // mantém o que já estava
  }
}

async function send(path: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { method, headers: json, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.ok) {
      await loadTeam();
      return null;
    }
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    return err.error ?? `Erro ${res.status}`;
  } catch {
    return 'A API não respondeu.';
  }
}

export const inviteMember = (name: string, email: string, role: Role) => send('/api/team', 'POST', { name, email, role });
export const changeMemberRole = (id: string, role: Role) => send(`/api/team/${encodeURIComponent(id)}`, 'PUT', { role });
export const setMemberActive = (id: string, active: boolean) => send(`/api/team/${encodeURIComponent(id)}`, 'PUT', { active });
