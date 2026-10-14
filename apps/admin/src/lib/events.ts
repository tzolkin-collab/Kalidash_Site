import type { EntityKind, Lifecycle, StepAction } from '../domain';
import { ACTIONS, automationsStore, runsStore } from '../mocks/automations';
import { companiesStore, peopleStore } from '../mocks/people';
import { leadsStore } from '../mocks/leads';
import { pipelinesStore } from '../mocks/pipelines';
import { addTask, tasksStore } from '../mocks/tasks';
import { logChange } from './history';
import { pushNotificacao } from './notify';
import { canAdvance } from './lifecycle';
import { newId } from './store';

// Motor de eventos do protótipo. Cada ação da tela emite um evento padronizado (`objeto.ação`);
// os passos das pipelines e as automações ligadas a ele rodam. Tudo em memória, sem servidor.

export type EventContext = {
  /** O registro onde o evento aconteceu. */
  entity: EntityKind;
  entityId: string;
  entityName: string;
  pipelineId?: string;
  stageId?: string;
  fieldKey?: string;
  personId?: string;
  companyId?: string;
  leadId?: string;
};

type Runnable = { name: string; actions: StepAction[] };

const LABEL = (id: string) => ACTIONS.find((a) => a.id === id)?.label ?? id;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/** "Empresa sem CNPJ" e afins: o campo do passo está vazio no registro? */
function isEmpty(ctx: EventContext, fieldKey?: string): boolean {
  if (fieldKey === 'cnpj') return !companiesStore.get().find((c) => c.id === ctx.companyId)?.document;
  if (fieldKey === 'cpf') return !peopleStore.get().find((p) => p.id === ctx.personId)?.document;
  return true;
}

/** Junta o que roda para o evento: passos das pipelines (sem repetir o mesmo passo) e automações soltas. */
function collect(eventId: string, ctx: EventContext): Runnable[] {
  const pipelines = pipelinesStore.get().filter((p) => !p.archivedAt && (!ctx.pipelineId || p.id === ctx.pipelineId));
  const seen = new Set<string>();
  const out: Runnable[] = [];

  for (const p of pipelines) {
    for (const s of p.steps) {
      if (!s.enabled || s.triggerId !== eventId) continue;
      if (s.stageId && s.stageId !== ctx.stageId) continue;
      // Em "campo mudou" a chave escolhe o campo; nos demais eventos ela só serve à condição "campo vazio"
      if (eventId === 'campo.mudou' && s.fieldKey && s.fieldKey !== ctx.fieldKey) continue;
      if (s.onlyIfEmpty && !isEmpty(ctx, s.fieldKey)) continue;
      const dedupe = `${s.phase}:${s.key}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({ name: s.name, actions: s.actions });
    }
  }

  const pipelineName = pipelines.find((p) => p.id === ctx.pipelineId)?.name;
  for (const a of automationsStore.get()) {
    if (!a.active || a.triggerId !== eventId) continue;
    if (pipelineName && a.pipeline !== 'Todas' && a.pipeline !== pipelineName) continue;
    out.push({ name: a.name, actions: [{ id: a.id, actionId: a.actionId, detail: a.detail, delayDays: 0 }] });
  }
  return out;
}

/* ---------- efeitos ---------- */

function applyLifecycle(kind: 'person' | 'company', id: string, to: Lifecycle, reason: string): string | null {
  const rec = kind === 'person' ? peopleStore.get().find((r) => r.id === id) : companiesStore.get().find((r) => r.id === id);
  if (!rec || !canAdvance(rec.lifecycle, to)) return null;
  const from = rec.lifecycle;
  const patch = <T extends { id: string; lifecycle: Lifecycle; firstWonAt?: string }>(list: T[]): T[] =>
    list.map((r) => (r.id === id ? { ...r, lifecycle: to, firstWonAt: to === 'CLIENT' && !r.firstWonAt ? new Date().toISOString() : r.firstWonAt } : r));
  if (kind === 'person') peopleStore.set((prev) => patch(prev));
  else companiesStore.set((prev) => patch(prev));
  logChange({ entity: kind, entityId: id, entityName: rec.name, kind: 'lifecycle', field: 'Ciclo de vida', from, to, note: reason });
  return `${rec.name}: ${from} → ${to}`;
}

/** Ainda existe outro lead ativo para esta pessoa ou empresa? (impede virar Inativo) */
function hasOtherActiveLead(ctx: EventContext): boolean {
  return leadsStore.get().some((l) => l.status === 'ACTIVE' && l.id !== ctx.leadId && ((ctx.personId && l.personId === ctx.personId) || (ctx.companyId && l.companyId === ctx.companyId)));
}

function setLifecycle(to: Lifecycle, ctx: EventContext, why: string): string {
  const parties: { kind: 'person' | 'company'; id: string }[] = [];
  if (to === 'CLIENT') {
    // A empresa, quando houver; senão a pessoa. As outras pessoas seguem como stakeholders.
    if (ctx.companyId) parties.push({ kind: 'company', id: ctx.companyId });
    else if (ctx.personId) parties.push({ kind: 'person', id: ctx.personId });
  } else {
    if (ctx.personId) parties.push({ kind: 'person', id: ctx.personId });
    if (ctx.companyId) parties.push({ kind: 'company', id: ctx.companyId });
  }
  if (to === 'INACTIVE' && hasOtherActiveLead(ctx)) return 'Segue ativo: há outro lead aberto';
  const changed = parties.map((p) => applyLifecycle(p.kind, p.id, to, why)).filter(Boolean);
  return changed.length ? changed.join('; ') : 'Ciclo de vida já estava neste ponto ou mais adiante';
}

function runAction(a: StepAction, ctx: EventContext, why: string): string {
  switch (a.actionId) {
    case 'ciclo.definir':
      return setLifecycle(a.detail as Lifecycle, ctx, why);
    case 'tarefa.criar': {
      const [title, tag] = a.detail.split('|');
      addTask({ entity: ctx.entity, entityId: ctx.entityId, entityName: ctx.entityName, title: title.trim(), tag: (tag ?? 'Geral').trim(), dueAt: a.delayDays > 0 ? inDays(a.delayDays) : undefined, source: 'passo' });
      logChange({ entity: ctx.entity, entityId: ctx.entityId, entityName: ctx.entityName, kind: 'event', note: `Tarefa criada: ${title.trim()}${a.delayDays > 0 ? ` (prazo em ${a.delayDays} dias)` : ''}` });
      return `Tarefa "${title.trim()}" criada`;
    }
    case 'tarefa.concluir': {
      const title = a.detail.trim();
      const open = tasksStore.get().filter((t) => !t.done && t.title === title && t.entity === ctx.entity && t.entityId === ctx.entityId);
      if (open.length === 0) return `Nenhuma tarefa aberta "${title}"`;
      tasksStore.set((prev) => prev.map((t) => (open.some((o) => o.id === t.id) ? { ...t, done: true, doneAt: new Date().toISOString() } : t)));
      logChange({ entity: ctx.entity, entityId: ctx.entityId, entityName: ctx.entityName, kind: 'event', note: `Tarefa concluída: ${title}` });
      return `Tarefa "${title}" concluída`;
    }
    case 'tag.adicionar': {
      const tag = a.detail.trim();
      if (ctx.leadId) leadsStore.set((prev) => prev.map((l) => (l.id === ctx.leadId && !l.tags.includes(tag) ? { ...l, tags: [...l.tags, tag] } : l)));
      else if (ctx.personId) peopleStore.set((prev) => prev.map((p) => (p.id === ctx.personId && !p.tags.includes(tag) ? { ...p, tags: [...p.tags, tag] } : p)));
      return `Tag "${tag}" adicionada`;
    }
    case 'responsavel.atribuir':
      if (ctx.leadId) leadsStore.set((prev) => prev.map((l) => (l.id === ctx.leadId ? { ...l, owner: a.detail.trim() } : l)));
      return `Responsável: ${a.detail}`;
    case 'notificar.equipe': {
      const dest = a.detail.trim() || 'a equipe';
      pushNotificacao(`Aviso da automação para ${dest}`, ctx.entityName, ctx.entity === 'lead' || ctx.entity === 'opportunity' || ctx.entity === 'person' || ctx.entity === 'company' ? { kind: ctx.entity, id: ctx.entityId } : undefined);
      return `Notificação para ${dest} criada na caixa`;
    }
    case 'email.enviar':
      return `E-mail enviado (simulado): ${a.detail.replace(/^Modelo:\s*/, '')}`;
    default:
      return `${LABEL(a.actionId)} (simulada)`;
  }
}

/** Emite um evento e roda o que estiver ligado a ele. Devolve quantos passos ou automações rodaram. */
export function emit(eventId: string, ctx: EventContext): number {
  const runnables = collect(eventId, ctx);
  const at = new Date().toISOString();
  const entries = runnables.map((r) => {
    const notes: string[] = [];
    let scheduled = 0;
    for (const a of r.actions) {
      // Só "criar tarefa" usa o atraso como prazo; as demais ações com atraso ficam agendadas
      if (a.delayDays > 0 && a.actionId !== 'tarefa.criar') {
        scheduled += 1;
        notes.push(`${LABEL(a.actionId)}: agendada para daqui a ${a.delayDays} dias`);
        continue;
      }
      notes.push(runAction(a, ctx, `Evento ${eventId}, passo "${r.name}"`));
    }
    const allScheduled = r.actions.length > 0 && scheduled === r.actions.length;
    return { id: newId('run'), at, automation: r.name, event: eventId, result: (allScheduled ? 'SCHEDULED' : 'OK') as 'OK' | 'SCHEDULED', note: `${ctx.entityName}: ${notes.join(' · ')}` };
  });
  if (entries.length) runsStore.set((prev) => [...entries, ...prev]);
  return entries.length;
}
