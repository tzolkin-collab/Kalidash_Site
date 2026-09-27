import type { LucideIcon } from 'lucide-react';
import { Inbox, Kanban, LayoutDashboard, ListChecks, Mail, Newspaper, Plug, UserCheck, Users, Zap } from 'lucide-react';

export type NavItem = { path: string; label: string; Icon: LucideIcon };
export type NavGroup = { title?: string; items: NavItem[] };

// Ordem e agrupamento da barra lateral. Ver docs/dominio.md §10.
export const NAV_GROUPS: NavGroup[] = [
  { items: [{ path: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard }] },
  {
    title: 'CRM',
    items: [
      { path: '/leads', label: 'Leads', Icon: Inbox },
      { path: '/oportunidades', label: 'Oportunidades', Icon: Kanban },
      { path: '/tarefas', label: 'Tarefas', Icon: ListChecks },
      { path: '/pessoas-empresas', label: 'Pessoas & Empresas', Icon: Users },
      { path: '/clientes', label: 'Clientes', Icon: UserCheck },
      { path: '/emails', label: 'E-mails', Icon: Mail },
    ],
  },
  {
    title: 'Conteúdo e conexões',
    items: [
      { path: '/blog', label: 'Blog', Icon: Newspaper },
      { path: '/automacoes', label: 'Automações', Icon: Zap },
      { path: '/projetos', label: 'Projetos conectados', Icon: Plug },
    ],
  },
];

/** Uma rota está ativa quando o caminho é o dela ou começa por ele (ex.: /tarefas/q4). */
export const isActive = (current: string, item: string) => current === item || current.startsWith(`${item}/`);
