import type { Pipeline } from '../domain';

/** Números que o servidor calcula por funil (WP4-1): o funil de cada registro vem de Opportunity.pipelineId. */
export type ServerPipelineStats = { records: number; openTasks: number; overdue: number; blocked: number };

/**
 * Números de um funil: registros, tarefas, atrasadas e registros bloqueados.
 * Com a API ligada vale o `stats` do servidor (legados no funil certo, bloqueados = registros, atrasadas incluem as
 * manuais). Sem ele (exemplo/API antiga) cai na conta local pelos requisitos.
 */
export function pipelineStats(p: Pipeline & { stats?: ServerPipelineStats }) {
  if (p.stats) {
    return { records: p.stats.records, tasks: p.stats.openTasks, overdue: p.stats.overdue, blocked: p.stats.blocked };
  }
  return {
    records: Object.values(p.counts).reduce((a, b) => a + b, 0),
    tasks: p.requirements.length,
    overdue: p.requirements.reduce((a, r) => a + r.overdue, 0),
    blocked: p.requirements.reduce((a, r) => a + r.blocked, 0),
  };
}
