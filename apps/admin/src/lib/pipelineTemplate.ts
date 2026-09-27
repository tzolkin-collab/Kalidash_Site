import type { LifecycleTemplate, Pipeline, Requirement, Stage, StageKind, Step, TemplateStep } from '../domain';
import { newId } from './store';

/** Etapa em edição no construtor. `ref` guarda o nome que ela tinha no template, para ligar passos e requisitos. */
export type StageDraft = { key: string; ref?: string; name: string; kind: StageKind; color: string };

const COLORS: Record<StageKind, string> = { LEAD: '#94a3b8', OPEN: '#3b82f6', WON: '#10b981', LOST: '#ef4444' };
export const colorFor = (kind: StageKind) => COLORS[kind];

/** Etapas do template, prontas para editar no construtor. */
export const stageDraftsOf = (tpl: LifecycleTemplate): StageDraft[] =>
  tpl.stages.map((s) => ({ key: newId('d'), ref: s.name, name: s.name, kind: s.kind, color: s.color }));

/** Copia um passo do template para a pipeline, trocando o nome da etapa pelo id dela. */
export function copyStep(ts: TemplateStep, idByName: Map<string, string>): Step {
  const { stageName, ...rest } = ts;
  const stageId = stageName ? idByName.get(stageName) : undefined;
  return {
    ...rest,
    id: newId('step'),
    stageId,
    // Condição de etapa que não existe mais: o passo vem desligado em vez de valer para tudo
    enabled: stageName && !stageId ? false : ts.enabled,
    actions: ts.actions.map((a) => ({ ...a, id: newId('sa') })),
  };
}

export const stepsFromTemplate = (tpl: LifecycleTemplate, stages: Stage[]): Step[] => {
  const idByName = new Map(stages.map((s) => [s.name, s.id]));
  return tpl.steps.map((ts) => copyStep(ts, idByName));
};

/** Monta a pipeline como cópia do template de venda (e do pós-venda, se houver). */
export function buildPipeline(name: string, offer: string, tpl: LifecycleTemplate, drafts: StageDraft[], postSale?: LifecycleTemplate): Pipeline {
  const id = newId('pl');
  const stages: Stage[] = drafts.map((d, i) => ({
    id: `${id}:${i}-${d.key}`, name: d.name.trim() || 'Etapa', kind: d.kind, color: d.color,
    ...(d.kind === 'OPEN' ? { probability: 50, alertDays: 7 } : {}),
  }));
  // O passo enxerga a etapa pelo nome original do template
  const idByRef = new Map<string, string>();
  drafts.forEach((d, i) => { if (d.ref) idByRef.set(d.ref, stages[i].id); });

  const requirements: Requirement[] = [];
  tpl.requirements.forEach((r) => {
    const stageId = idByRef.get(r.stageName);
    if (!stageId) return; // a etapa foi removida no construtor
    requirements.push({ id: `${id}:r-${requirements.length}`, stageId, label: r.label, tag: r.tag, kind: r.kind, gate: r.gate, assignee: r.assignee, dueDays: r.dueDays, blocked: 0, overdue: 0 });
  });

  const steps = [...tpl.steps, ...(postSale?.steps ?? [])].map((ts) => copyStep(ts, idByRef));

  return {
    id, name: name.trim(), offer: offer.trim(), stages, sources: [], requirements, steps,
    counts: Object.fromEntries(stages.map((s) => [s.id, 0])), values: {}, customFields: [],
    taskTags: ['Dados do cliente', 'Dados da empresa', 'Comercial', 'Jurídico', 'Pós-venda', 'Configuração'],
    qualifyRequires: [], templateId: tpl.id, postSaleTemplateId: postSale?.id,
  };
}

/* ---------- comparar a pipeline com o template ---------- */

export type StepDiff = { kind: 'added' | 'changed'; template: TemplateStep; current?: Step };

const signature = (s: { name: string; triggerId: string; fieldKey?: string; onlyIfEmpty?: boolean; actions: { actionId: string; detail: string; delayDays: number }[] }) =>
  JSON.stringify([s.name, s.triggerId, s.fieldKey ?? '', Boolean(s.onlyIfEmpty), s.actions.map((a) => [a.actionId, a.detail, a.delayDays])]);

/** O que o template tem de diferente da cópia da pipeline. Passos só da pipeline ficam como estão. */
export function diffWithTemplate(steps: Step[], tpl: LifecycleTemplate): StepDiff[] {
  const out: StepDiff[] = [];
  for (const ts of tpl.steps) {
    const current = steps.find((s) => s.key === ts.key && s.phase === ts.phase);
    if (!current) out.push({ kind: 'added', template: ts });
    else if (signature(current) !== signature(ts)) out.push({ kind: 'changed', template: ts, current });
  }
  return out;
}

/** Aplica os itens escolhidos do diff. Mudança mantém a etapa e o liga/desliga da pipeline. */
export function applyDiff(steps: Step[], picked: StepDiff[], stages: Stage[]): Step[] {
  const idByName = new Map(stages.map((s) => [s.name, s.id]));
  let next = [...steps];
  for (const d of picked) {
    if (d.kind === 'added') next.push(copyStep(d.template, idByName));
    else if (d.current) {
      const { name, triggerId, fieldKey, onlyIfEmpty, actions } = d.template;
      next = next.map((s) => (s.id === d.current!.id ? { ...s, name, triggerId, fieldKey, onlyIfEmpty, actions: actions.map((a) => ({ ...a, id: newId('sa') })) } : s));
    }
  }
  return next;
}
