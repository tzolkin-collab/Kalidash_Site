import type { Pipeline } from '../domain';

/** Números de um funil: registros, tarefas (requisitos), atrasadas e registros bloqueados. */
export function pipelineStats(p: Pipeline) {
  return {
    records: Object.values(p.counts).reduce((a, b) => a + b, 0),
    tasks: p.requirements.length,
    overdue: p.requirements.reduce((a, r) => a + r.overdue, 0),
    blocked: p.requirements.reduce((a, r) => a + r.blocked, 0),
  };
}
