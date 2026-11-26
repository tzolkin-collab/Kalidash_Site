import type { HealthCount } from './analyticsApi.ts';

// Situação de cada destino de conversão (Meta, GA4, offline) a partir do que foi registrado em TrackingEvent.
// O status sai das entregas, não das variáveis da API que está respondendo: o banco é o mesmo para produção e
// ambiente local, então a API local (sem credencial) também enxerga os envios da produção.

export type LayerState = 'ok' | 'warn' | 'bad' | 'idle';
export type LayerRow = { name: string; state: LayerState; status: string; detail: string };

const OFFLINE = new Set(['QualifiedLead', 'Purchase']);
const EVENT_LABEL: Record<string, string> = { Lead: 'Lead', QualifiedLead: 'Lead qualificado', Purchase: 'Venda', Subscribe: 'Inscrição', CompleteRegistration: 'Cadastro' };
const label = (name: string) => EVENT_LABEL[name] ?? name;
const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

type Tally = { sent: number; failed: number; skipped: number };

function tally(counts: HealthCount[]): Tally {
  const t = { sent: 0, failed: 0, skipped: 0 };
  for (const c of counts) {
    if (c.status === 'sent') t.sent += c.count;
    else if (c.status === 'failed') t.failed += c.count;
    else if (c.status === 'skipped') t.skipped += c.count;
  }
  return t;
}

/** "Lead: 2 · Venda: 1" com as entregas de cada evento. */
function perEvent(counts: HealthCount[]): string {
  const by = new Map<string, number>();
  for (const c of counts) if (c.status === 'sent') by.set(c.name, (by.get(c.name) ?? 0) + c.count);
  return [...by].sort(([a], [b]) => a.localeCompare(b)).map(([name, k]) => `${label(name)}: ${k}`).join(' · ');
}

function layerRow(name: string, counts: HealthCount[]): LayerRow {
  const t = tally(counts);
  const notSent = t.skipped ? ` ${n(t.skipped, 'evento não foi enviado', 'eventos não foram enviados')} porque o servidor que o recebeu estava sem credencial.` : '';
  if (t.failed) return { name, state: 'bad', status: 'Com falhas', detail: `${n(t.sent, 'entregue', 'entregues')}, ${n(t.failed, 'falhou', 'falharam')}. Veja os últimos erros abaixo.` };
  if (t.sent) return { name, state: 'ok', status: 'Entregando', detail: `${n(t.sent, 'entregue', 'entregues')} (${perEvent(counts)}).${notSent}` };
  if (t.skipped) return { name, state: 'warn', status: 'Sem credencial', detail: `Nada foi entregue: ${n(t.skipped, 'evento chegou', 'eventos chegaram')} a um servidor sem credencial.` };
  return { name, state: 'idle', status: 'Sem envios', detail: 'Nenhum evento nos últimos 30 dias.' };
}

export function deliveryLayers(counts: HealthCount[]): LayerRow[] {
  const meta = counts.filter((c) => c.layer === 'meta');
  const ga4 = counts.filter((c) => c.layer === 'ga4');
  // Cada evento offline é registrado uma vez com o status das duas camadas: conta pela camada que entregou.
  const offAll = counts.filter((c) => OFFLINE.has(c.name));
  const offLayer = offAll.some((c) => c.layer === 'meta' && c.status === 'sent') ? 'meta' : 'ga4';
  const offline = offAll.filter((c) => c.layer === offLayer);
  const off = tally(offline);
  return [
    layerRow('Meta (API de Conversões)', meta),
    layerRow('GA4 pelo servidor', ga4),
    off.sent
      ? { name: 'Conversões offline', state: off.failed ? 'bad' : 'ok', status: off.failed ? 'Com falhas' : 'Entregando', detail: `Lead qualificado e venda do CRM voltando para a Meta e o GA4 (${perEvent(offline)}).` }
      : { name: 'Conversões offline', state: 'idle', status: 'Sem envios', detail: 'Nenhum lead qualificado ou venda nos últimos 30 dias. Quando houver, o CRM avisa a Meta e o GA4.' },
  ];
}
