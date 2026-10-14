import type { EntityKind, Pipeline, TaskItem } from '../domain';

// Regras das notificações geradas por tarefa (docs/notificacoes.md §3). Puro, sem stores nem relógio
// próprio: testado em tests/taskAlerts.test.ts. A orquestração fica em taskNotify.ts.
//
//  - Criada: só a tarefa nascida de um requisito de etapa com "notificar o responsável" ligado e com
//    responsável definido (caminho simples do doc). Tarefas manuais não avisam: quem as cria já sabe.
//  - Atrasada: toda tarefa aberta com prazo vencido, uma única vez por tarefa. Se aparecerem muitas de
//    uma vez (primeira abertura, volta de férias), vira um resumo só, para não afogar a caixa.

export type Alert = {
  title: string;
  detail: string;
  entityRef?: { kind: 'lead' | 'opportunity' | 'person' | 'company'; id: string };
};

export const MAX_INDIVIDUAL_OVERDUE = 5;

const REF_KINDS = ['lead', 'opportunity', 'person', 'company'] as const;
const entityRefOf = (t: TaskItem): Alert['entityRef'] =>
  (REF_KINDS as readonly string[]).includes(t.entity) ? { kind: t.entity as 'lead' | 'opportunity' | 'person' | 'company', id: t.entityId } : undefined;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/** A tarefa recém-criada deve avisar? Só requisito com "notificar o responsável" e responsável definido. */
export function notifyOnCreate(t: TaskItem, pipelines: Pipeline[]): boolean {
  if (t.source !== 'requisito' || !t.assignee || !t.requirementId) return false;
  for (const p of pipelines) {
    const req = p.requirements.find((r) => r.id === t.requirementId);
    if (req) return Boolean(req.notifyAssignee);
  }
  return false;
}

export function createdAlert(t: TaskItem): Alert {
  return {
    title: `Nova tarefa para ${t.assignee}: ${t.title}`,
    detail: `${t.entityName}${t.dueAt ? ` · prazo ${fmtDate(t.dueAt)}` : ''}`,
    entityRef: entityRefOf(t),
  };
}

export const isOverdue = (t: TaskItem, now: number) => !t.done && Boolean(t.dueAt) && Date.parse(t.dueAt as string) < now;

/** Quais avisos de atraso emitir agora e quais ids marcar como já avisados. */
export function overdueAlerts(tasks: TaskItem[], alreadyNotified: Set<string>, now: number): { alerts: Alert[]; ids: string[] } {
  const fresh = tasks
    .filter((t) => isOverdue(t, now) && !alreadyNotified.has(t.id))
    .sort((a, b) => Date.parse(a.dueAt as string) - Date.parse(b.dueAt as string) || a.id.localeCompare(b.id));
  const ids = fresh.map((t) => t.id);
  if (fresh.length === 0) return { alerts: [], ids };
  if (fresh.length > MAX_INDIVIDUAL_OVERDUE) {
    const oldest = fresh[0];
    return {
      alerts: [{ title: `${fresh.length} tarefas atrasadas`, detail: `A mais antiga: ${oldest.title} (${oldest.entityName}), prazo ${fmtDate(oldest.dueAt as string)}.` }],
      ids,
    };
  }
  return {
    alerts: fresh.map((t) => ({
      title: `Tarefa atrasada: ${t.title}`,
      detail: `${t.assignee ?? 'Sem responsável'} · ${t.entityName} · prazo ${fmtDate(t.dueAt as string)}`,
      entityRef: entityRefOf(t),
    })),
    ids,
  };
}

/** Contexto que o motor de eventos (events.ts) espera. Mesmo formato de EventContext, sem importá-lo (evita puxar as stores). */
export type TaskEventContext = {
  entity: EntityKind;
  entityId: string;
  entityName: string;
  pipelineId?: string;
  stageId?: string;
  personId?: string;
  companyId?: string;
  leadId?: string;
};

/** De onde veio a tarefa: o funil e a etapa do requisito que a gerou, e o registro como pessoa/empresa/lead. */
export function eventContextFor(t: TaskItem, pipelines: Pipeline[]): TaskEventContext {
  const ctx: TaskEventContext = { entity: t.entity, entityId: t.entityId, entityName: t.entityName };
  if (t.requirementId) {
    for (const p of pipelines) {
      const req = p.requirements.find((r) => r.id === t.requirementId);
      if (req) {
        ctx.pipelineId = p.id;
        ctx.stageId = req.stageId;
        break;
      }
    }
  }
  if (t.entity === 'person') ctx.personId = t.entityId;
  if (t.entity === 'company') ctx.companyId = t.entityId;
  if (t.entity === 'lead') ctx.leadId = t.entityId;
  return ctx;
}

/**
 * A tarefa recém-criada dispara `tarefa.criada` para as automações? Só a que nasceu de um REQUISITO de
 * etapa ("um requisito de etapa gerou uma tarefa"). A manual já emite na própria tela (RecordTabs), e a
 * criada por uma ação de automação ou passo NÃO pode emitir, senão automação que cria tarefa vira laço.
 */
export const emitsCreated = (t: TaskItem) => t.source === 'requisito';
