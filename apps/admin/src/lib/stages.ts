import type { Pipeline, Stage } from '../domain';
import type { Opportunity } from '../types';

// Etapa de uma oportunidade. A coluna `stage` guarda, conforme a época em que o registro nasceu,
// ou o id de uma etapa de funil (ex.: "q4:assinatura") ou um valor antigo (INBOUND, QUALIFICATION,
// WON, LOST). Tudo o que mostra ou move oportunidades passa por aqui para falar a língua dos funis.
// Sem dependências de React nem de stores: testado em tests/stages.test.ts.

export const activePipelines = (pipelines: Pipeline[]) => pipelines.filter((p) => !p.archivedAt);

/** O funil de uma oportunidade: o dono da etapa gravada; senão o pelo nome; senão o primeiro ativo. */
export function pipelineOf(opp: Pick<Opportunity, 'stage' | 'pipeline'>, pipelines: Pipeline[]): Pipeline | undefined {
  const byStage = pipelines.find((p) => p.stages.some((s) => s.id === opp.stage));
  if (byStage) return byStage;
  const active = activePipelines(pipelines);
  return active.find((p) => p.name === opp.pipeline) ?? active[0];
}

/** Valor antigo da coluna `stage` → etapa equivalente do funil (as antigas eram só de oportunidade). */
export function legacyStage(p: Pipeline | undefined, value: string): Stage | undefined {
  if (!p) return undefined;
  const firstOpen = p.stages.find((s) => s.kind === 'OPEN');
  switch (value) {
    case 'WON': return p.stages.find((s) => s.kind === 'WON');
    case 'LOST': return p.stages.find((s) => s.kind === 'LOST');
    case 'QUALIFICATION': return p.stages.find((s) => s.kind === 'OPEN' && s.name === 'Qualificação') ?? firstOpen;
    case 'INBOUND': return firstOpen;
    default: return undefined;
  }
}

export type Resolved = { pipeline?: Pipeline; stage?: Stage };

export function resolveStage(opp: Pick<Opportunity, 'stage' | 'pipeline'>, pipelines: Pipeline[]): Resolved {
  const pipeline = pipelineOf(opp, pipelines);
  const stage = pipeline?.stages.find((s) => s.id === opp.stage) ?? legacyStage(pipeline, opp.stage);
  return { pipeline, stage };
}

/** Etapas que viram colunas do Kanban de oportunidades (as de lead têm o próprio quadro). */
export const kanbanStages = (p: Pipeline | undefined): Stage[] => (p?.stages ?? []).filter((s) => s.kind !== 'LEAD');

export const firstOpenStageId = (p: Pipeline | undefined) => p?.stages.find((s) => s.kind === 'OPEN')?.id;
export const wonStageId = (p: Pipeline | undefined) => p?.stages.find((s) => s.kind === 'WON')?.id;
export const lostStageId = (p: Pipeline | undefined) => p?.stages.find((s) => s.kind === 'LOST')?.id;

const LEGACY_LABEL: Record<string, string> = { INBOUND: 'Entrada', QUALIFICATION: 'Qualificação', WON: 'Ganho', LOST: 'Perdido' };

/** Nome para mostrar de qualquer valor de `stage` (id de funil ou antigo). */
export function stageLabel(value: string, pipelines: Pipeline[], opp?: Pick<Opportunity, 'stage' | 'pipeline'>): string {
  for (const p of pipelines) {
    const s = p.stages.find((x) => x.id === value);
    if (s) return s.name;
  }
  const viaLegacy = opp ? resolveStage(opp, pipelines).stage : undefined;
  return viaLegacy?.name ?? LEGACY_LABEL[value] ?? (value || '—');
}
