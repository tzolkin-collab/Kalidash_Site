import type { LayoutItem, Span } from './dashboardLayout.ts';

// Modelos prontos da Dashboard: listas de widgets montadas para um papel. A pessoa aplica com um clique e
// depois ajusta (ordem, largura, o que entra e sai). Os ids são os do catálogo (components/dashboard/widgets.tsx);
// ao aplicar, normalizeLayout descarta o que não existir mais, então um id velho nunca quebra a tela.

export type Preset = { id: string; name: string; description: string; items: LayoutItem[] };

const w = (id: string, span: Span): LayoutItem => ({ id, span });

export const PRESETS: Preset[] = [
  {
    id: 'comercial',
    name: 'Visão comercial',
    description: 'Para quem acompanha vendas: valor ganho, previsão, funil, desempenho por responsável e perdas.',
    items: [
      w('kpi-won', 4), w('kpi-forecast', 4), w('kpi-win-rate', 4),
      w('funnel', 8), w('biggest', 4),
      w('trend', 12),
      w('sales-by-owner', 6), w('lost-reasons', 6),
      w('kpi-cycle', 4), w('kpi-ticket', 4), w('kpi-lost-value', 4),
    ],
  },
  {
    id: 'meu-dia',
    name: 'Meu dia',
    description: 'Para o vendedor: o que está aberto, o que está atrasado e quem aguarda contato.',
    items: [
      w('kpi-open', 4), w('kpi-tasks-overdue', 4), w('kpi-leads-waiting', 4),
      w('late', 6), w('biggest', 6),
      w('kpi-tasks-soon', 4), w('kpi-leads-new', 4), w('kpi-first-contact', 4),
    ],
  },
  {
    id: 'leads',
    name: 'Leads e marketing',
    description: 'Para quem cuida da entrada: leads novos, origem, campanha, tempo de resposta e descartes.',
    items: [
      w('kpi-leads-new', 4), w('kpi-first-contact', 4), w('kpi-leads-qualified', 4),
      w('origins', 6), w('lead-campaigns', 6),
      w('discard-reasons', 6), w('kpi-leads-active', 6),
    ],
  },
  {
    id: 'equipe',
    name: 'Equipe e atividade',
    description: 'Para o gestor: tarefas por pessoa, ritmo de atividade e auditoria de CPF.',
    items: [
      w('kpi-tasks-open', 4), w('kpi-tasks-overdue', 4), w('kpi-tasks-done', 4),
      w('activity-by-day', 12),
      w('activity-by-person', 6), w('tasks-by-assignee', 6),
      w('activity-kinds', 6), w('cpf-reveals', 6),
    ],
  },
];
