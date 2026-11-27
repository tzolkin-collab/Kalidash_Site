import test from 'node:test';
import assert from 'node:assert/strict';
import { funnelRows, pickFunnelPipeline } from '../src/lib/funnelData.ts';

const stages = (p: string) => [
  { id: `${p}:novos`, name: 'Novos', kind: 'LEAD', color: '#1' },
  { id: `${p}:contato`, name: 'Em contato', kind: 'LEAD', color: '#2' },
  { id: `${p}:qualificacao`, name: 'Qualificação', kind: 'OPEN', color: '#3' },
  { id: `${p}:ganho`, name: 'Ganho', kind: 'WON', color: '#4' },
  { id: `${p}:perdido`, name: 'Perdido', kind: 'LOST', color: '#5' },
];
const vendas = { id: 'vendas', name: 'Vendas', stages: stages('vendas') } as never;
const parcerias = { id: 'parc', name: 'Parcerias', stages: stages('parc') } as never;
const velho = { id: 'old', name: 'Velho', archivedAt: '2026-01-01', stages: stages('old') } as never;
const pipelines = [velho, vendas, parcerias];

test('escolhe o funil salvo; se sumiu ou foi arquivado, o primeiro ativo', () => {
  assert.equal(pickFunnelPipeline(pipelines, 'parc')?.id, 'parc');
  assert.equal(pickFunnelPipeline(pipelines, 'old')?.id, 'vendas');
  assert.equal(pickFunnelPipeline(pipelines, 'nao-existe')?.id, 'vendas');
  assert.equal(pickFunnelPipeline(pipelines, null)?.id, 'vendas');
  assert.equal(pickFunnelPipeline([velho], null), undefined);
});

test('etapas de lead contam leads ativos; as outras, oportunidades do funil; Perdido fica de fora', () => {
  const leads = [
    { id: 'l1', pipelineId: 'vendas', stageId: 'vendas:novos', status: 'ACTIVE', estimatedValue: 100 },
    { id: 'l2', pipelineId: 'vendas', stageId: 'vendas:contato', status: 'ACTIVE' },
    { id: 'l3', pipelineId: 'vendas', stageId: 'vendas:novos', status: 'DISCARDED' },
    { id: 'l4', pipelineId: 'vendas', stageId: 'vendas:novos', status: 'ACTIVE', archivedAt: '2026-02-01' },
    { id: 'l5', pipelineId: 'parc', stageId: 'parc:novos', status: 'ACTIVE' },
  ] as never;
  const opps = [
    { id: 'o1', stage: 'vendas:qualificacao', value: 1500 },
    { id: 'o2', stage: 'vendas:ganho', value: 2000 },
    { id: 'o3', stage: 'vendas:perdido', value: 900 },
    { id: 'o4', stage: 'parc:qualificacao', value: 50 },
    { id: 'o5', stage: 'vendas:qualificacao', value: 10, isLead: true },
  ] as never;
  const rows = funnelRows(pickFunnelPipeline(pipelines, 'vendas'), opps, leads, pipelines);
  assert.deepEqual(rows.map((r) => [r.label, r.count, r.cents, r.isLeadStage]), [
    ['Novos', 1, 10000, true],
    ['Em contato', 1, 0, true],
    ['Qualificação', 1, 150000, false],
    ['Ganho', 1, 200000, false],
  ]);
});

test('sem funil, sem linhas', () => {
  assert.deepEqual(funnelRows(undefined, [], [], []), []);
});
