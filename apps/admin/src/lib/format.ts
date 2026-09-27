/** "R$ 15.000" para valores inteiros; com centavos, sempre duas casas ("R$ 7.500,50"). */
export function formatCurrency(val: number): string {
  const n = val || 0;
  const cents = Number.isInteger(n) ? 0 : 2;
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: cents, maximumFractionDigits: 2 })}`;
}

/** Valor para o campo de edição: 15000 vira "15000,00". */
export function moneyToInput(value: number): string {
  return (value || 0).toFixed(2).replace('.', ',');
}

/**
 * Lê dinheiro digitado no formato brasileiro. Devolve `null` quando não dá para ter certeza,
 * para nunca gravar um valor errado em silêncio.
 *
 *   "5000"        -> 5000        "5.000"      -> 5000
 *   "5000,50"     -> 5000.5      "R$ 5.000,5" -> 5000.5
 *   "1,234.56"    -> null        "abc"        -> null
 */
export function parseMoney(raw: string): number | null {
  const s = raw.replace(/R\$/gi, '').replace(/\s/g, '');
  if (!s || !/^[\d.,]+$/.test(s)) return null;

  const commas = (s.match(/,/g) ?? []).length;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (commas > 1) return null;
  if (lastComma !== -1 && lastDot > lastComma) return null; // "1,234.56" é ambíguo

  let normalized: string;
  if (lastComma !== -1) {
    normalized = s.replace(/\./g, '').replace(',', '.'); // vírgula = decimal, ponto = milhar
  } else if (lastDot !== -1) {
    // só pontos: milhar se vier em grupos de 3 ("5.000"), senão decimal ("5000.5")
    normalized = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Data em pt-BR, ou null se vier vazia ou zerada (a API devolve 0001-01-01 quando não sabe). */
export function formatDate(iso?: string): string | null {
  if (!iso) return null;
  // "2026-10-15" (sem hora) é lido como UTC e voltaria um dia no fuso do Brasil: monta como data local.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
  return d.toLocaleDateString('pt-BR');
}
