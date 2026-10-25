import test from 'node:test';
import assert from 'node:assert/strict';
import { connectBody, currentPipelineOf, firstLeadStage, projectSourcesOf, withProjectSources, writableSources } from '../src/lib/sourceLink.ts';
import { normalizePipeline, pipelineProjection } from '../src/lib/workflowDiff.ts';

const pipe = (id: string, over: object = {}) => normalizePipeline({
  id, name: `Funil ${id}`, offer: '',
  stages: [{ id: `${id}:ab`, name: 'Aberta', kind: 'OPEN', color: '#000' }, { id: `${id}:lead2`, name: 'Novos 2', kind: 'LEAD', color: '#111' }, { id: `${id}:lead`, name: 'Novos', kind: 'LEAD', color: '#222' }],
  ...over,
} as never);
const prj = (id: string, pipelineId: string, over: object = {}) => ({ id, name: `LP ${id}`, url: 'https://lp.test', origins: [], pipelineId, stageId: `${pipelineId}:lead2`, sourceName: `Fonte ${id}`, forms: [{ name: 'Contato' }], ...over });

test('B-05: as fontes de formulário do funil vêm só dos projetos que apontam para ele', () => {
  const list = projectSourcesOf('p1', [prj('a', 'p1'), prj('b', 'p2')]);
  assert.deepEqual(list.map((s) => [s.id, s.name, s.type, s.project, s.derived]), [['a', 'Fonte a', 'FORM', 'LP a', true]]);
  assert.deepEqual(projectSourcesOf('p3', [prj('a', 'p1')]), []); // ninguém aponta: "Sem fonte"
});

test('withProjectSources troca as de formulário legadas e mantém manual/importação; é idempotente', () => {
  const legacy = { id: 's1', name: 'mock', type: 'FORM', formId: 'lp-consultoria:modal', active: true };
  const manual = { id: 's2', name: 'Balcão', type: 'MANUAL', active: true };
  const ps = [pipe('p1', { sources: [legacy, manual] }), pipe('p2')];
  const out = withProjectSources(ps, [prj('a', 'p1')]);
  assert.deepEqual(out[0].sources.map((s) => s.id), ['s2', 'a']);
  assert.equal(out[1], ps[1]);
  assert.equal(withProjectSources(out, [prj('a', 'p1')]), out); // nada muda: mesma referência
  // projeto desconectado do funil: a fonte some
  assert.deepEqual(withProjectSources(out, [prj('a', 'p2')])[0].sources.map((s) => s.id), ['s2']);
});

test('fontes de formulário não vão no corpo do funil nem contam como edição', () => {
  const withForm = pipe('p1', { sources: [{ id: 'a', name: 'x', type: 'FORM', derived: true, active: true }, { id: 's2', name: 'Balcão', type: 'MANUAL', active: true }] });
  assert.deepEqual(writableSources(withForm.sources).map((s) => s.id), ['s2']);
  assert.equal(pipelineProjection(withForm), pipelineProjection({ ...withForm, sources: withForm.sources.filter((s) => s.type !== 'FORM') }));
});

test('connectBody grava pipelineId, a 1ª etapa Lead e o nome da fonte; sem etapa Lead, erro', () => {
  const p = pipe('p1');
  assert.equal(firstLeadStage(p)?.id, 'p1:lead2');
  const body = connectBody(prj('a', 'p9'), p, '  Meu form ');
  assert.ok(!('error' in body));
  assert.deepEqual([body.pipelineId, body.stageId, body.sourceName, body.name, body.url], ['p1', 'p1:lead2', 'Meu form', 'LP a', 'https://lp.test']);
  assert.equal((connectBody(prj('a', 'p9'), p, '') as { sourceName: string }).sourceName, 'Fonte a'); // sem nome: mantém o do projeto
  assert.ok('error' in connectBody(prj('a', 'p9'), pipe('p2', { stages: [{ id: 'x', name: 'A', kind: 'OPEN', color: '#000' }] }), ''));
});

test('currentPipelineOf acha o funil de onde o projeto será movido', () => {
  assert.equal(currentPipelineOf(prj('a', 'p2'), [pipe('p1'), pipe('p2')])?.id, 'p2');
  assert.equal(currentPipelineOf(prj('a', 'zz'), [pipe('p1')]), undefined);
});
