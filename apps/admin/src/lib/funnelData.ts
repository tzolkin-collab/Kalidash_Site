import type { Lead, Pipeline } from '../domain.ts';
import type { Opportunity } from '../types.ts';
import { toCents } from './salesMetrics.ts';
import { activePipelines, resolveStage } from './stages.ts';

// Dados do funil da Dashboard (widget "Funil por etapa" e gráfico configurável de funil): todas as etapas do funil
// escolhido, na ordem, menos Perdido. As etapas de lead (Novos, Em contato…) contam os leads ativos parados nelas;
// as demais contam as oportunidades. Assim o funil começa na entrada, não só depois da qualificação.

export type FunnelRow = { id: string; label: string; color: string; count: number; cents: number; isLeadStage: boolean };

/** O funil a mostrar: o escolhido, se ainda existe e está ativo; senão o primeiro ativo. */
export function pickFunnelPipeline(pipelines: Pipeline[], preferredId?: string | null): Pipeline | undefined {
  const active = activePipelines(pipelines);
  return active.find((p) => p.id === preferredId) ?? active[0];
}

export function funnelRows(pipeline: Pipeline | undefined, opps: Opportunity[], leads: Lead[], pipelines: Pipeline[]): FunnelRow[] {
  if (!pipeline) return [];
  const stages = pipeline.stages.filter((s) => s.kind !== 'LOST');
  const count = new Map<string, number>();
  const cents = new Map<string, number>();
  const add = (id: string, c: number) => { count.set(id, (count.get(id) ?? 0) + 1); cents.set(id, (cents.get(id) ?? 0) + c); };
  const leadStages = new Set(stages.filter((s) => s.kind === 'LEAD').map((s) => s.id));
  for (const l of leads) {
    if (l.archivedAt || l.status !== 'ACTIVE' || l.pipelineId !== pipeline.id || !leadStages.has(l.stageId)) continue;
    add(l.stageId, toCents(l.estimatedValue ?? 0));
  }
  for (const o of opps) {
    if (o.isLead) continue;
    const r = resolveStage(o, pipelines);
    if (!r.stage || r.pipeline?.id !== pipeline.id || leadStages.has(r.stage.id)) continue;
    add(r.stage.id, toCents(o.value));
  }
  return stages.map((s) => ({ id: s.id, label: s.name, color: s.color, count: count.get(s.id) ?? 0, cents: cents.get(s.id) ?? 0, isLeadStage: s.kind === 'LEAD' }));
}

const PREF_KEY = 'kalidash.dashboard.funnel.v1';
export const funnelPrefKey = (userId?: string) => `${PREF_KEY}.${userId || 'anon'}`;

export function loadFunnelPref(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function saveFunnelPref(key: string, pipelineId: string): void {
  try { localStorage.setItem(key, pipelineId); } catch { /* sem storage: vale só nesta sessão */ }
}
