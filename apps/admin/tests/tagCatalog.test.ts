import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORY_ORDER, categoryOf, findTag, groupTags, knownTags, searchTags, suggestCategory, tagKey } from '../src/lib/tagCatalog.ts';
import type { CatalogTag } from '../src/lib/tagCatalog.ts';

const cat = (name: string, category: CatalogTag['category']): CatalogTag => ({ id: name, name, category });

test('chave de comparação ignora acento, caixa e espaços', () => {
  assert.equal(tagKey('  Indicação '), 'indicacao');
  assert.equal(tagKey('Mídia   Paga'), 'midia paga');
  assert.equal(tagKey('B2B'), 'b2b');
});

test('categorias de tag: só Perfil, Evento e Geral (status, prioridade e origem são campos)', () => {
  assert.deepEqual(CATEGORY_ORDER, ['PROFILE', 'EVENT', 'GENERAL']);
});

test('palpite: perfil pela palavra, evento pela palavra no nome; o resto é Geral', () => {
  assert.equal(suggestCategory('B2B'), 'PROFILE');
  assert.equal(suggestCategory('Enterprise'), 'PROFILE');
  assert.equal(suggestCategory('b2c'), 'PROFILE');
  assert.equal(suggestCategory('Evento'), 'EVENT');
  assert.equal(suggestCategory('Feira Agrishow 2026'), 'EVENT');
  assert.equal(suggestCategory('Webinar de IA'), 'EVENT');
  assert.equal(suggestCategory('Reunião marcada'), 'GENERAL');
  assert.equal(suggestCategory('Urgente'), 'GENERAL'); // prioridade é campo, não tag
  assert.equal(suggestCategory('Novo'), 'GENERAL'); // status é campo da tarefa
  assert.equal(suggestCategory('Feirante'), 'GENERAL'); // palavra inteira, não pedaço
});

test('o catálogo manda sobre o palpite, mesmo com outra caixa ou acento', () => {
  const catalog = [cat('B2B', 'GENERAL'), cat('Reunião marcada', 'EVENT')];
  assert.equal(categoryOf('b2b', catalog), 'GENERAL');
  assert.equal(categoryOf('REUNIAO MARCADA', catalog), 'EVENT');
  assert.equal(categoryOf('Enterprise', catalog), 'PROFILE'); // fora do catálogo: palpite
  assert.equal(categoryOf('Qualquer coisa', catalog), 'GENERAL');
});

test('tags conhecidas: catálogo + usadas, sem repetir por acento ou caixa', () => {
  const out = knownTags([cat('Indicação', 'GENERAL')], ['indicacao', 'B2B', ' ', 'b2b', 'Feira']);
  assert.deepEqual(out, ['Indicação', 'B2B', 'Feira']);
});

test('agrupar: ordem das categorias, alfabético dentro, categoria vazia some', () => {
  const g = groupTags(['Zebra', 'Enterprise', 'Feira Agrishow', 'Alfa', 'B2B', 'Webinar'], []);
  assert.deepEqual(g.map((x) => x.category), ['PROFILE', 'EVENT', 'GENERAL']);
  assert.deepEqual(g[0].tags, ['B2B', 'Enterprise']);
  assert.deepEqual(g[1].tags, ['Feira Agrishow', 'Webinar']);
  assert.deepEqual(g[2].tags, ['Alfa', 'Zebra']);
  assert.deepEqual(groupTags(['B2B'], []).map((x) => x.category), ['PROFILE']);
});

test('busca: por nome ou por categoria, sem acento nem caixa', () => {
  const names = ['Indicação', 'B2B', 'Feira Agrishow', 'Enterprise'];
  assert.deepEqual(searchTags(names, [], 'indica'), ['Indicação']);
  assert.deepEqual(searchTags(names, [], 'PERFIL'), ['B2B', 'Enterprise']); // nome da categoria
  assert.deepEqual(searchTags(names, [], 'evento'), ['Feira Agrishow']);
  assert.deepEqual(searchTags(names, [], ''), names);
  assert.deepEqual(searchTags(names, [], 'xyz'), []);
});

test('achar tag existente ignora acento e caixa e devolve o nome guardado', () => {
  assert.equal(findTag(['Indicação', 'Site'], 'INDICACAO'), 'Indicação');
  assert.equal(findTag(['Site'], 'blog'), undefined);
});
