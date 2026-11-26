import test from 'node:test';
import assert from 'node:assert/strict';
import { channelOf, campaignOf, landingOf } from '../src/lib/channels.ts';
import { byCampaign, byChannel, byLanding, byOrganicPiece, cohort, outcomes, quality, rate, readout, signupsByPage, summary } from '../src/lib/acquisitionMetrics.ts';

const pipelines = [{
  id: 'p', name: 'Vendas', stages: [
    { id: 'p:q', name: 'Qualificação', kind: 'OPEN', color: '' },
    { id: 'p:g', name: 'Ganho', kind: 'WON', color: '' },
    { id: 'p:l', name: 'Perdido', kind: 'LOST', color: '' },
  ],
}] as never;

let n = 0;
const lead = (attribution: Record<string, string> = {}, extra: object = {}) =>
  ({ id: `l${++n}`, name: 'l', email: 'a@b.c', origin: 'INBOUND', sourceName: 'Site', status: 'ACTIVE', tags: [], createdAt: '2026-10-10T10:00:00', customData: { attribution }, ...extra }) as never;
const opp = (id: string, stage: string, value: number, extra: object = {}) => ({ id, title: 't', value, stage, priority: '', tags: [], ...extra }) as never;
const ch = (attribution: Record<string, string>, touch: 'first' | 'last' = 'last', extra: object = {}) => channelOf(lead(attribution, extra), touch).label;

test('canal: mídia paga pelas UTMs e pelo autotag do Google', () => {
  assert.equal(ch({ utm_source: 'meta', utm_medium: 'paid_social' }), 'Meta Ads');
  assert.equal(ch({ utm_source: 'google', utm_medium: 'cpc' }), 'Google Ads');
  assert.equal(ch({ gclid: 'abc' }), 'Google Ads');
  assert.equal(ch({ utm_source: 'linkedin', utm_medium: 'paid_social' }), 'LinkedIn Ads');
});

test('canal: fbclid sozinho é orgânico (a Meta põe fbclid em link de post)', () => {
  assert.equal(ch({ fbclid: 'x' }), 'Orgânico · Facebook/Instagram');
  assert.equal(ch({ fbclid: 'x', referrer: 'https://l.instagram.com/' }), 'Orgânico · Instagram');
});

test('canal: orgânico, mensagens e referrer', () => {
  assert.equal(ch({ utm_source: 'instagram', utm_medium: 'social', utm_content: 'stories' }), 'Orgânico · Instagram');
  assert.equal(ch({ utm_source: 'whatsapp', utm_medium: 'messaging' }), 'WhatsApp');
  assert.equal(ch({ utm_source: 'newsletter', utm_medium: 'email' }), 'E-mail e newsletter');
  assert.equal(ch({ referrer: 'https://www.google.com/' }), 'Busca orgânica');
  assert.equal(ch({ referrer: 'https://www.linkedin.com/feed/' }), 'Orgânico · LinkedIn');
  assert.equal(ch({ referrer: 'https://blog.parceiro.com.br/post' }), 'Indicação (outros sites)');
  assert.equal(ch({ referrer: 'https://kalidash.com.br/blog' }), 'Direto / sem origem');
  assert.equal(ch({}), 'Direto / sem origem');
});

test('canal: outbound e projeto conectado vêm da origem do lead', () => {
  assert.equal(ch({ utm_source: 'meta', utm_medium: 'paid_social' }, 'last', { origin: 'OUTBOUND' }), 'Outbound');
  assert.equal(channelOf(lead({}, { customData: { projectId: 'prj1', projectName: 'LP Evento' } }), 'first').label, 'Projeto · LP Evento');
});

test('canal: primeiro toque x último toque', () => {
  const both = { first_utm_source: 'instagram', first_utm_medium: 'social', first_utm_campaign: 'guia_ia', landing_page: '/blog/guia-ia', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'marca' };
  assert.equal(ch(both, 'first'), 'Orgânico · Instagram');
  assert.equal(ch(both, 'last'), 'Google Ads');
  assert.equal(campaignOf(lead(both), 'first'), 'guia_ia');
  assert.equal(campaignOf(lead(both), 'last'), 'marca');
  // Descoberta sem campanha e campanha depois: direto no primeiro toque.
  assert.equal(ch({ landing_page: '/', utm_source: 'meta', utm_medium: 'paid_social' }, 'first'), 'Direto / sem origem');
  // Nenhuma campanha: o primeiro toque usa as pistas do último (referrer).
  assert.equal(ch({ landing_page: '/', referrer: 'https://www.google.com/' }, 'first'), 'Busca orgânica');
  // Lead antigo, sem primeiro toque gravado: usa o último.
  assert.equal(ch({ utm_source: 'meta', utm_medium: 'paid_social' }, 'first'), 'Meta Ads');
});

test('página de entrada: só o caminho', () => {
  assert.equal(landingOf(lead({ landing_page: '/blog/guia-ia?utm_source=x' })), '/blog/guia-ia');
  assert.equal(landingOf(lead({ page_url: 'https://kalidash.com.br/diagnostico/' })), '/diagnostico');
  assert.equal(landingOf(lead({})), '');
});

test('taxa só com base de 5 ou mais', () => {
  assert.equal(rate(1, 4), null);
  assert.equal(rate(1, 5), 0.2);
});

test('coorte, pipeline e receita por canal; ciclo mediano', () => {
  const meta = { utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'diag_202610' };
  const ig = { utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'guia_ia', utm_content: 'stories_reels_01' };
  const leads = [
    lead(meta, { convertedOpportunityId: 'o1', status: 'QUALIFIED', createdAt: '2026-10-01T10:00:00' }),
    lead(meta, { createdAt: '2026-10-02T10:00:00' }),
    lead(ig, { id: 'lig', createdAt: '2026-10-03T10:00:00' }),
    lead({}, { createdAt: '2026-10-04T10:00:00' }),
    lead(meta, { createdAt: '2026-08-01T10:00:00' }), // fora da janela
    lead(meta, { archivedAt: '2026-10-05T10:00:00' }), // arquivado
  ];
  const opps = [
    opp('o1', 'p:g', 10000, { wonAt: '2026-10-11T10:00:00' }),
    opp('o2', 'p:q', 4000, { leadId: 'lig' }), // casa pelo leadId da oportunidade
  ];
  const w = { from: Date.parse('2026-10-01T00:00:00'), to: Date.parse('2026-10-31T23:59:59') };
  const rows = outcomes(cohort(leads, w), opps, pipelines, 'first');
  assert.equal(rows.length, 4);

  const s = summary(rows);
  assert.deepEqual([s.leads, s.qualified, s.opps, s.pipelineCents, s.won, s.wonCents], [4, 2, 2, 1400000, 1, 1000000]);
  assert.equal(s.medianCycleDays, 10);
  assert.equal(s.leadToWon, null); // 4 leads: base pequena

  const channels = byChannel(rows).map((r) => [r.label, r.leads, r.pipelineCents, r.wonCents]);
  assert.deepEqual(channels, [['Meta Ads', 2, 1000000, 1000000], ['Orgânico · Instagram', 1, 400000, 0], ['Direto / sem origem', 1, 0, 0]]);

  assert.deepEqual(byCampaign(rows, 'last').map((r) => [r.label, r.leads]), [['diag_202610', 2], ['guia_ia', 1]]);
  assert.deepEqual(byOrganicPiece(rows).map((r) => r.label), ['Orgânico · Instagram · guia_ia · stories_reels_01']);
});

test('páginas de entrada e inscrições por artigo', () => {
  const leads = [
    lead({ landing_page: '/blog/guia-ia' }, { customData: { formSource: 'blog-newsletter-material-guia-ia', attribution: { landing_page: '/blog/guia-ia' } } }),
    lead({ landing_page: '/blog/guia-ia' }, { customData: { formSource: 'blog-newsletter-artigo', attribution: { landing_page: '/blog/guia-ia' } } }),
    lead({ landing_page: '/diagnostico' }, { customData: { formSource: 'site-diagnostico', attribution: { landing_page: '/diagnostico' } } }),
  ];
  assert.deepEqual(signupsByPage(leads), [{ page: '/blog/guia-ia', newsletter: 1, material: 1 }]);
  const rows = outcomes(leads, [], pipelines, 'first');
  assert.deepEqual(byLanding(rows).map((r) => [r.label, r.leads]), [['/blog/guia-ia', 2], ['/diagnostico', 1]]);
});

test('qualidade: sem origem acima de 30% liga o aviso; outbound e projetos ficam fora', () => {
  const leads = [
    lead({}), lead({}), lead({ utm_source: 'meta', utm_medium: 'paid_social', _fbp: 'fb.1' }),
    lead({ referrer: 'https://www.google.com/' }), lead({ utm_source: 'instagram', utm_medium: 'social' }),
    lead({}, { origin: 'OUTBOUND' }),
  ];
  const q = quality(outcomes(leads, [], pipelines, 'last'));
  assert.deepEqual([q.inbound, q.untracked, q.withUtm, q.withMetaCookie, q.alert], [5, 2, 2, 1, true]);
  assert.equal(q.untrackedShare, 0.4);
});

test('leitura do período: canal que mais gerou pipeline e aviso de origem perdida', () => {
  const fmt = (c: number) => `R$ ${c / 100}`;
  const meta = { utm_source: 'meta', utm_medium: 'paid_social' };
  const leads = [lead(meta, { id: 'm1', convertedOpportunityId: 'x1' }), lead(meta), lead({ utm_source: 'instagram', utm_medium: 'social' }), lead({}), lead({}), lead({})];
  const rows = outcomes(leads, [opp('x1', 'p:q', 3000)], pipelines, 'last');
  const text = readout(summary(rows), byChannel(rows), quality(rows), fmt);
  assert.match(text, /^Meta Ads gerou 100% do pipeline \(R\$ 3000\), com 2 leads\./);
  assert.match(text, /3 de 6 leads do site chegaram sem origem/);

  const few = outcomes([lead({ utm_source: 'instagram', utm_medium: 'social' }), lead({ utm_source: 'instagram', utm_medium: 'social' })], [], pipelines, 'last');
  assert.equal(readout(summary(few), byChannel(few), quality(few), fmt),
    '2 leads e nenhuma oportunidade aberta ainda. Orgânico · Instagram é o canal rastreado que mais trouxe leads (2). Com menos de 5 leads, trate como sinal, não como conclusão.');
  assert.equal(readout(summary([]), [], quality([]), fmt), 'Nenhum lead criado neste período.');
});
