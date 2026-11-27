import { isoDay } from './paidMedia.ts';
import type { AdRow, Status } from './paidMedia.ts';

// Anúncios INVENTADOS para avaliar as telas de tráfego pago antes de as contas do Meta serem conectadas. Os IDs
// começam com "ex" para nunca serem confundidos com IDs reais. O vídeo de abertura roda nas duas contas (mesmo
// arquivo, criativos diferentes) e o carrossel foi reenviado (só o nome bate). Os totais são de 30 dias, repartidos
// por dia sempre do mesmo jeito; a campanha pausada só tem números antigos.

type Spot = Pick<AdRow, 'accountId' | 'accountName' | 'campaignId' | 'campaignName' | 'campaignStatus' | 'campaignBudget' | 'adsetId' | 'adsetName' | 'adsetStatus' | 'adsetBudget'>;
type Total = Omit<AdRow, 'date'>;

const spot = (acc: 1 | 2, camp: string, campName: string, set: string, setName: string, status: Status = 'ACTIVE', budget?: number): Spot => ({
  accountId: `ex_act_${acc}`, accountName: acc === 1 ? 'Exemplo · Conta principal' : 'Exemplo · Conta da Carol',
  campaignId: `ex_cmp_${camp}`, campaignName: campName, campaignStatus: status, campaignBudget: budget,
  adsetId: `ex_set_${set}`, adsetName: setName, adsetStatus: status, adsetBudget: budget ? undefined : 5000,
});

const ad = (s: Spot, id: string, adName: string, creativeId: string, assetKey: string, format: AdRow['format'], n: number[]): Total => {
  const [spend, impressions, clicks, pageViews, views3s, leads, qualified, sales, revenue] = n;
  return { ...s, adId: `ex_ad_${id}`, adName, adStatus: s.adsetStatus, creativeId: `ex_cr_${creativeId}`, assetKey, format, spend, impressions, clicks, pageViews, views3s, leads, qualified, sales, revenue };
};

const q4a = spot(1, '1', 'aceleradora_q4', '1', 'Diretores · SP', 'ACTIVE', 15000);
const q4b = spot(1, '1', 'aceleradora_q4', '2', 'Operações · Brasil', 'ACTIVE', 15000);
const diag = spot(1, '2', 'diagnostico_ia', '3', 'Visitantes do site');
const carol = spot(2, '3', 'autoridade_ia', '4', 'Semelhantes 1%');
const old = spot(2, '4', 'teste_setembro', '5', 'Amplo', 'PAUSED');

const TOTALS: Total[] = [
  ad(q4a, '1', 'Vídeo de abertura', '101', 'video:ex901', 'video', [124000, 27800, 421, 356, 8600, 9, 4, 1, 1200000]),
  ad(q4b, '2', 'Vídeo de abertura', '101', 'video:ex901', 'video', [60000, 13400, 191, 150, 3900, 5, 2, 0, 0]),
  ad(carol, '3', 'Vídeo de abertura - cópia', '207', 'video:ex901', 'video', [58000, 12100, 205, 171, 3500, 6, 3, 1, 950000]),
  ad(q4a, '4', 'Carrossel de casos', '102', 'image:exa1', 'carousel', [56500, 13250, 146, 118, 0, 3, 1, 0, 0]),
  ad(carol, '5', 'Carrossel de casos', '208', 'image:exb7', 'carousel', [40000, 9600, 98, 80, 0, 2, 1, 0, 0]),
  ad(diag, '6', 'Imagem do diagnóstico', '103', 'image:exc3', 'image', [88000, 19100, 266, 232, 0, 8, 4, 1, 600000]),
  ad(diag, '7', 'Stories do diagnóstico', '104', 'video:ex902', 'video', [41000, 12400, 71, 49, 1900, 0, 0, 0, 0]),
  ad(old, '8', 'Teste de título', '209', 'image:exd9', 'image', [23000, 7400, 52, 38, 0, 1, 0, 0, 0]),
];

const KEYS = ['spend', 'impressions', 'clicks', 'pageViews', 'views3s', 'leads', 'qualified', 'sales', 'revenue'] as const;
const DAYS = 30;

/** Reparte um total inteiro pelos pesos sem perder nem criar unidades (maiores restos). */
function split(total: number, weights: number[]): number[] {
  const all = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (total * w) / all);
  const out = exact.map(Math.floor);
  const left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => ({ i, rest: v - out[i] })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order.slice(0, left)) out[i]++;
  return out;
}

export function paidSample(now = new Date()): AdRow[] {
  const dates = Array.from({ length: DAYS }, (_, back) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)));
  return TOTALS.flatMap((total, n) => {
    const weights = dates.map((_, back) => (total.adStatus === 'PAUSED' && back < 14 ? 0 : 3 + ((back * 7 + n * 5) % 6)));
    const parts = KEYS.map((k, i) => split(total[k], weights.map((w, back) => (w ? w + ((back * (i + 2)) % 3) : 0))));
    return dates.flatMap((date, back) => {
      if (!weights[back]) return [];
      const row: AdRow = { ...total, date };
      KEYS.forEach((k, i) => { row[k] = parts[i][back]; });
      return [row];
    });
  });
}
