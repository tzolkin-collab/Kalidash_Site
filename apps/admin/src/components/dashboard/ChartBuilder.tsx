import { useState } from 'react';
import { AreaChart, BarChart3, BarChartHorizontal, Filter, Layers, LineChart, PieChart, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CATEGORIES, MEASURE_BY_ID, TOP_N_OPTIONS, VISUALS, VISUAL_BY_ID, chartTitle, compatibleMeasures, normalizeChart, withVisual } from '../../lib/chartSpec';
import type { ChartConfig, DimId, Granularity, MeasureId, VisualId } from '../../lib/chartSpec';
import type { ChartCtx } from '../../lib/chartData';
import { CustomSelect, Field, SidePanel, Switch } from '../ui';
import { ChartBody, chartScope } from './ChartWidget';

// Interface padrão para criar e editar gráficos da Dashboard. O visual vem primeiro; os campos que aparecem são
// os que aquele visual pede (lib/chartSpec.ts), e a lista de medidas só traz o que ele sabe mostrar. Prévia ao vivo.

const ICON: Record<VisualId, LucideIcon> = { line: LineChart, area: AreaChart, columns: BarChart3, stacked: Layers, donut: PieChart, bars: BarChartHorizontal, pareto: TrendingUp, funnel: Filter };

const DEFAULT: ChartConfig = normalizeChart({ visual: 'bars', measure: 'won-value', dimension: 'owner' })!;

const TOP_LABEL: Record<string, string> = { donut: 'Quantas fatias', bars: 'Quantas barras', pareto: 'Quantas barras', stacked: 'Quantos grupos' };
const TOP_HINT = 'O que passar disso é somado em "Outros".';

export default function ChartBuilder({ initial, ctx, onSave, onClose }: { initial?: ChartConfig; ctx: ChartCtx; onSave: (cfg: ChartConfig) => void; onClose: () => void }) {
  const [cfg, setCfg] = useState<ChartConfig>(initial ?? DEFAULT);
  const visual = VISUAL_BY_ID.get(cfg.visual)!;
  const measure = MEASURE_BY_ID.get(cfg.measure)!;
  const has = (slot: (typeof visual.slots)[number]) => visual.slots.includes(slot);
  const patch = (p: Partial<ChartConfig>) => setCfg((c) => normalizeChart({ ...c, ...p }) ?? c);
  const measures = compatibleMeasures(cfg.visual);
  // Prévia sem o título digitado, para o título automático acompanhar as escolhas.
  const auto = chartTitle({ ...cfg, title: undefined });

  return (
    <SidePanel
      title={initial ? 'Editar gráfico' : 'Adicionar gráfico'}
      subtitle="Escolha como ver, depois o que medir. A prévia usa os seus dados de agora."
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-solid" onClick={() => onSave(cfg)}>{initial ? 'Salvar' : 'Adicionar à Dashboard'}</button>
        </>
      )}
    >
      <div className="form-stack">
        <section aria-label="Como ver">
          <h3 className="section-title">Como ver</h3>
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="cb-cat">
              <div className="cb-cat-head"><strong>{cat.label}</strong><span className="text-xs text-muted">{cat.hint}</span></div>
              <div className="cb-visuals">
                {VISUALS.filter((v) => v.category === cat.id).map((v) => {
                  const Icon = ICON[v.id];
                  return (
                    <button key={v.id} type="button" className="cb-visual" aria-pressed={cfg.visual === v.id} onClick={() => setCfg((c) => withVisual(c, v.id))}>
                      <Icon size={16} aria-hidden="true" />
                      <span>{v.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted cb-visual-note">{visual.description}</p>
        </section>

        <Field label="O que medir" hint="Só aparecem as medidas que este gráfico sabe mostrar.">
          <CustomSelect className="select" value={cfg.measure} onChange={(e) => patch({ measure: e.target.value as MeasureId })} aria-label="O que medir">
            {measures.map((m) => <option key={m.id} value={m.id}>{m.group} · {m.label}</option>)}
          </CustomSelect>
        </Field>

        {has('dimension') && (
          <Field label="Dividir por" hint="Cada valor vira uma parte do gráfico.">
            <CustomSelect className="select" value={cfg.dimension ?? ''} onChange={(e) => patch({ dimension: e.target.value as DimId })} aria-label="Dividir por">
              {measure.dims.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </CustomSelect>
          </Field>
        )}

        {has('stackBy') && (
          <Field label="Empilhar por" hint="Cada coluna é dividida por este corte.">
            <CustomSelect className="select" value={cfg.stackBy ?? ''} onChange={(e) => patch({ stackBy: e.target.value as DimId })} aria-label="Empilhar por">
              {measure.dims.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </CustomSelect>
          </Field>
        )}

        {has('granularity') && (
          <Field label="Agrupar por tempo" hint={cfg.granularity === 'day' ? 'Os últimos 30 dias, um ponto por dia.' : 'As últimas 12 semanas, um ponto por semana.'}>
            <div className="chip-row" role="group" aria-label="Agrupar por tempo" style={{ marginBottom: 0 }}>
              {([['day', 'Por dia'], ['week', 'Por semana']] as [Granularity, string][]).map(([id, label]) => (
                <button key={id} type="button" className={`chip ${cfg.granularity === id ? 'active' : ''}`} aria-pressed={cfg.granularity === id} onClick={() => patch({ granularity: id })}>{label}</button>
              ))}
            </div>
          </Field>
        )}

        {has('compare') && (
          <div className="cb-switch">
            <div className="cell-stack"><span className="cell-primary">Comparar com o período anterior</span><span className="text-xs text-muted">Mostra uma segunda linha, do mesmo tamanho, logo antes.</span></div>
            <Switch checked={cfg.compare} onChange={(v) => patch({ compare: v })} label="Comparar com o período anterior" />
          </div>
        )}

        {has('topN') && (
          <Field label={TOP_LABEL[cfg.visual] ?? 'Quantos itens'} hint={TOP_HINT}>
            <CustomSelect className="select" value={String(cfg.topN)} onChange={(e) => patch({ topN: Number(e.target.value) })} aria-label={TOP_LABEL[cfg.visual] ?? 'Quantos itens'}>
              {TOP_N_OPTIONS.map((n) => <option key={n} value={String(n)}>{n}</option>)}
            </CustomSelect>
          </Field>
        )}

        <Field label="Título" hint="Deixe vazio para usar o automático.">
          <input className="input" value={cfg.title ?? ''} maxLength={60} placeholder={auto} onChange={(e) => setCfg((c) => ({ ...c, title: e.target.value || undefined }))} aria-label="Título" />
        </Field>

        <section aria-label="Prévia" className="cb-preview">
          <div className="cb-preview-head"><strong>{chartTitle(cfg)}</strong><span className="text-xs text-muted">{chartScope(cfg, ctx)}</span></div>
          <ChartBody cfg={cfg} ctx={ctx} height={200} />
        </section>
      </div>
    </SidePanel>
  );
}
