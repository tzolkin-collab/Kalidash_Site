// Funil desenhado como funil: uma faixa por etapa, coladas e centralizadas. A largura de cada faixa é quantos chegaram
// até aquela etapa (ela mais as seguintes), então o desenho sempre afina de cima para baixo; o número ao lado é o que
// está na etapa agora. A % é quanto da etapa anterior avançou. Usado no widget "Funil por etapa" e no gráfico de funil.

export type FunnelStep = { key: string; label: string; amount: number; text: string; sub?: string; color: string };

/** Quantos chegaram até cada etapa: a própria etapa mais todas as seguintes (o funil só afina). */
export function reachedCounts(amounts: number[]): number[] {
  const out = new Array<number>(amounts.length);
  let acc = 0;
  for (let i = amounts.length - 1; i >= 0; i--) {
    acc += Math.max(0, amounts[i]);
    out[i] = acc;
  }
  return out;
}

/** Largura (0–1) de cada faixa a partir do alcance, com um mínimo para a etapa final ainda aparecer. */
export function funnelWidths(reached: number[], min = 0.22): number[] {
  const top = reached[0] ?? 0;
  if (top <= 0) return reached.map(() => min);
  return reached.map((r) => min + (1 - min) * (r / top));
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

export function FunnelShape({ steps }: { steps: FunnelStep[] }) {
  const reached = reachedCounts(steps.map((s) => s.amount));
  const widths = funnelWidths(reached);
  const summary = steps.map((s) => `${s.label}: ${s.text}`).join('; ');
  return (
    <div className="funnel-shape">
      <div className="funnel-shape-rows" role="img" aria-label={`Funil — ${summary}`}>
        {steps.map((s, i) => {
          const top = widths[i] * 100;
          const bottom = (i + 1 < steps.length ? widths[i + 1] : widths[i] * 0.7) * 100;
          const clip = `polygon(${50 - top / 2}% 0, ${50 + top / 2}% 0, ${50 + bottom / 2}% 100%, ${50 - bottom / 2}% 100%)`;
          const rate = i > 0 && reached[i - 1] > 0 ? reached[i] / reached[i - 1] : null;
          const tip = `${s.label}: ${s.text} na etapa${s.sub ? ` (${s.sub})` : ''}${rate !== null ? ` · ${pct(rate)} da etapa anterior avançou até aqui` : ''}`;
          return (
            <div key={s.key} className="funnel-shape-row" title={tip}>
              <span className="funnel-shape-label">{s.label}</span>
              <div className="funnel-shape-band" aria-hidden="true">
                <div style={{ clipPath: clip, background: s.color }} />
              </div>
              <span className="funnel-shape-num">
                <span><b>{s.text}</b>{s.sub && <small> · {s.sub}</small>}</span>
                {rate !== null && <small className="funnel-shape-rate">{pct(rate)} avançou</small>}
              </span>
            </div>
          );
        })}
      </div>
      <p className="funnel-shape-note">A largura mostra quantas chegaram até cada etapa; o número é quantas estão nela agora.</p>
    </div>
  );
}
