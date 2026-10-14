import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_INDIVIDUAL_OVERDUE, createdAlert, emitsCreated, eventContextFor, isOverdue, notifyOnCreate, overdueAlerts } from '../src/lib/taskAlerts.ts';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const DAY = 86_400_000;
const iso = (d: number) => new Date(NOW + d * DAY).toISOString();

const task = (over: object = {}) => ({ id: 't1', entity: 'opportunity', entityId: '1790000000000000001', entityName: 'Acme', title: 'Informar CNPJ', tag: 'Dados', done: false, source: 'manual', createdAt: iso(-3), ...over }) as never;

const pipelines = [{
  id: 'p', name: 'P', stages: [],
  requirements: [
    { id: 'r-avisa', stageId: 's', label: 'A', tag: 't', kind: 'ACTION', gate: 'ENTER', blocked: 0, overdue: 0, notifyAssignee: true },
    { id: 'r-mudo', stageId: 's', label: 'B', tag: 't', kind: 'ACTION', gate: 'ENTER', blocked: 0, overdue: 0 },
  ],
}] as never;

test('criada: só requisito com "notificar o responsável" ligado e responsável definido', () => {
  assert.equal(notifyOnCreate(task({ source: 'requisito', requirementId: 'r-avisa', assignee: 'Lucas' }), pipelines), true);
  assert.equal(notifyOnCreate(task({ source: 'requisito', requirementId: 'r-mudo', assignee: 'Lucas' }), pipelines), false, 'requisito sem o interruptor');
  assert.equal(notifyOnCreate(task({ source: 'requisito', requirementId: 'r-avisa' }), pipelines), false, 'sem responsável não há para quem avisar');
  assert.equal(notifyOnCreate(task({ source: 'manual', assignee: 'Lucas' }), pipelines), false, 'tarefa manual: quem cria já sabe');
  assert.equal(notifyOnCreate(task({ source: 'requisito', requirementId: 'sumiu', assignee: 'Lucas' }), pipelines), false, 'requisito que não existe mais');
  assert.equal(notifyOnCreate(task({ source: 'passo', assignee: 'Lucas' }), pipelines), false);
});

test('createdAlert: responsável, registro e prazo; leva ao registro', () => {
  const a = createdAlert(task({ assignee: 'Lucas', title: 'Enviar contrato', dueAt: iso(2) }));
  assert.equal(a.title, 'Nova tarefa para Lucas: Enviar contrato');
  assert.match(a.detail, /^Acme · prazo \d{2}\/\d{2}\/\d{4}$/);
  assert.deepEqual(a.entityRef, { kind: 'opportunity', id: '1790000000000000001' });
  assert.equal(createdAlert(task({ assignee: 'Lucas' })).detail, 'Acme', 'sem prazo, só o registro');
  assert.equal(createdAlert(task({ assignee: 'Lucas', entity: 'pipeline', entityId: 'q4' })).entityRef, undefined, 'funil não tem tela de registro');
});

test('isOverdue: aberta, com prazo, vencido', () => {
  assert.equal(isOverdue(task({ dueAt: iso(-1) }), NOW), true);
  assert.equal(isOverdue(task({ dueAt: iso(1) }), NOW), false, 'prazo no futuro');
  assert.equal(isOverdue(task({}), NOW), false, 'sem prazo');
  assert.equal(isOverdue(task({ dueAt: iso(-1), done: true }), NOW), false, 'concluída não atrasa');
});

test('atrasadas: uma vez por tarefa, da mais antiga para a mais nova', () => {
  const tasks = [task({ id: 'b', dueAt: iso(-1) }), task({ id: 'a', dueAt: iso(-3), assignee: 'Carol' }), task({ id: 'c', dueAt: iso(5) })];
  const first = overdueAlerts(tasks, new Set(), NOW);
  assert.deepEqual(first.ids, ['a', 'b']);
  assert.equal(first.alerts.length, 2);
  assert.match(first.alerts[0].title, /^Tarefa atrasada: Informar CNPJ$/);
  assert.match(first.alerts[0].detail, /^Carol · Acme · prazo \d{2}\/\d{2}\/\d{4}$/);
  assert.match(first.alerts[1].detail, /^Sem responsável · /);
  // depois de avisadas, não repete
  assert.deepEqual(overdueAlerts(tasks, new Set(first.ids), NOW), { alerts: [], ids: [] });
  // uma nova atrasada avisa só a nova
  const more = [...tasks, task({ id: 'd', dueAt: iso(-2) })];
  assert.deepEqual(overdueAlerts(more, new Set(first.ids), NOW).ids, ['d']);
});

test('muitas atrasadas de uma vez viram um resumo só (mas todas ficam marcadas)', () => {
  const many = Array.from({ length: MAX_INDIVIDUAL_OVERDUE + 3 }, (_, i) => task({ id: `t${i}`, title: `Tarefa ${i}`, dueAt: iso(-(i + 1)) }));
  const r = overdueAlerts(many, new Set(), NOW);
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].title, `${MAX_INDIVIDUAL_OVERDUE + 3} tarefas atrasadas`);
  assert.match(r.alerts[0].detail, /A mais antiga: Tarefa 7 \(Acme\)/);
  assert.equal(r.ids.length, MAX_INDIVIDUAL_OVERDUE + 3, 'todas marcadas, para não avisar de novo');
  // exatamente no limite ainda avisa uma a uma
  assert.equal(overdueAlerts(many.slice(0, MAX_INDIVIDUAL_OVERDUE), new Set(), NOW).alerts.length, MAX_INDIVIDUAL_OVERDUE);
});

test('eventContextFor: acha funil e etapa pelo requisito e preenche o registro', () => {
  const ctx = eventContextFor(task({ source: 'requisito', requirementId: 'r-avisa' }), pipelines);
  assert.equal(ctx.pipelineId, 'p');
  assert.equal(ctx.stageId, 's');
  assert.equal(ctx.entity, 'opportunity');
  const pessoa = eventContextFor(task({ entity: 'person', entityId: 'x1' }), pipelines);
  assert.equal(pessoa.personId, 'x1');
  assert.equal(pessoa.pipelineId, undefined);
});

test('emitsCreated: só a tarefa de requisito emite tarefa.criada (evita laço com automação)', () => {
  assert.equal(emitsCreated(task({ source: 'requisito' })), true);
  assert.equal(emitsCreated(task({ source: 'manual' })), false);
  assert.equal(emitsCreated(task({ source: 'passo' })), false);
});
