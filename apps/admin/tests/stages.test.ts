import test from 'node:test';
import assert from 'node:assert/strict';
import { firstOpenStageId, kanbanStages, legacyStage, lostStageId, pipelineOf, resolveStage, stageLabel, wonStageId } from '../src/lib/stages.ts';

const stages = (p: string) => [
  { id: `${p}:novos`, name: 'Novos', kind: 'LEAD', color: '' },
  { id: `${p}:qualificacao`, name: 'Qualificação', kind: 'OPEN', color: '' },
  { id: `${p}:proposta`, name: 'Proposta', kind: 'OPEN', color: '' },
  { id: `${p}:ganho`, name: 'Ganho', kind: 'WON', color: '' },
  { id: `${p}:perdido`, name: 'Perdido', kind: 'LOST', color: '' },
];
const q4 = { id: 'q4', name: 'Q4 Sales', stages: stages('q4') } as never;
const b2b = { id: 'b2b', name: 'Parcerias', stages: stages('b2b') } as never;
const archived = { id: 'old', name: 'Velho', archivedAt: '2026-01-01', stages: stages('old') } as never;
const all = [archived, q4, b2b];

test('pipelineOf: dono da etapa > nome > primeiro ativo (nunca arquivado)', () => {
  assert.equal(pipelineOf({ stage: 'b2b:proposta' }, all)?.id, 'b2b');
  assert.equal(pipelineOf({ stage: 'INBOUND', pipeline: 'Parcerias' }, all)?.id, 'b2b');
  assert.equal(pipelineOf({ stage: 'INBOUND' }, all)?.id, 'q4');
  assert.equal(pipelineOf({ stage: 'INBOUND', pipeline: 'Velho' }, all)?.id, 'q4', 'arquivado não recebe oportunidades por nome');
});

test('valores antigos viram etapas do funil', () => {
  assert.equal(legacyStage(q4, 'WON')?.id, 'q4:ganho');
  assert.equal(legacyStage(q4, 'LOST')?.id, 'q4:perdido');
  assert.equal(legacyStage(q4, 'QUALIFICATION')?.id, 'q4:qualificacao');
  assert.equal(legacyStage(q4, 'INBOUND')?.id, 'q4:qualificacao', 'entrada antiga cai na 1ª etapa aberta, não em lead');
  assert.equal(legacyStage(q4, 'qualquer'), undefined);
  assert.equal(legacyStage(undefined, 'WON'), undefined);
});

test('resolveStage entende id de funil e valor antigo', () => {
  assert.equal(resolveStage({ stage: 'q4:proposta' }, all).stage?.name, 'Proposta');
  assert.equal(resolveStage({ stage: 'WON' }, all).stage?.id, 'q4:ganho');
  assert.equal(resolveStage({ stage: 'WON', pipeline: 'Parcerias' }, all).stage?.id, 'b2b:ganho');
  assert.equal(resolveStage({ stage: 'lixo' }, all).stage, undefined);
});

test('colunas do Kanban não incluem etapas de lead; ids úteis', () => {
  assert.deepEqual(kanbanStages(q4).map((s: { id: string }) => s.id), ['q4:qualificacao', 'q4:proposta', 'q4:ganho', 'q4:perdido']);
  assert.equal(firstOpenStageId(q4), 'q4:qualificacao');
  assert.equal(wonStageId(q4), 'q4:ganho');
  assert.equal(lostStageId(q4), 'q4:perdido');
  assert.equal(wonStageId(undefined), undefined);
});

test('stageLabel mostra o nome da etapa de qualquer época', () => {
  assert.equal(stageLabel('b2b:proposta', all), 'Proposta');
  assert.equal(stageLabel('WON', all), 'Ganho');
  assert.equal(stageLabel('QUALIFICATION', all, { stage: 'QUALIFICATION', pipeline: 'Parcerias' }), 'Qualificação');
  assert.equal(stageLabel('', all), '—');
  assert.equal(stageLabel('x-estranho', all), 'x-estranho');
});
