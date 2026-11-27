import { useMemo, useState } from 'react';
import { funnel } from '../../lib/analyticsSeries';
import { MIN_BASE } from '../../lib/acquisitionMetrics';
import { Section, Segmented } from '../../components/analytics/parts';
import { SMALL, money, share } from '../../components/analytics/format';
import { ChannelLogo } from '../../components/analytics/SourceLogo';
import type { Acquisition } from './useAcquisition';

export default function FunnelView({ a }: { a: Acquisition }) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of a.rows) map.set(o.lead.pipelineId, (map.get(o.lead.pipelineId) ?? 0) + 1);
    return map;
  }, [a.rows]);
  const ordered = useMemo(() => [...a.pipelines].sort((x, y) => (counts.get(y.id) ?? 0) - (counts.get(x.id) ?? 0)), [a.pipelines, counts]);
  const [chosen, setChosen] = useState('');
  const pipeline = ordered.find((p) => p.id === chosen) ?? ordered[0];
  const data = useMemo(() => (pipeline ? funnel(a.rows, a.opportunities, pipeline) : null), [a.rows, a.opportunities, pipeline]);

  // O mesmo funil quebrado por canal: onde cada origem perde gente.
  const byChannel = useMemo(() => {
    if (!pipeline) return [];
    return a.channels
      .map((c) => ({ channel: c, data: funnel(a.rows.filter((o) => o.channel.key === c.key), a.opportunities, pipeline) }))
      .filter((x) => x.data.total > 0)
      .sort((x, y) => y.data.total - x.data.total);
  }, [a.channels, a.rows, a.opportunities, pipeline]);

  if (!pipeline || !data) return <p className="an-empty">Nenhum pipeline carregado.</p>;

  // A maior queda entre duas etapas seguidas (com base suficiente) é o ponto a atacar.
  let worst = -1;
  let worstDrop = 0;
  for (let i = 1; i < data.steps.length; i++) {
    const before = data.steps[i - 1].reached;
    if (before < MIN_BASE) continue;
    const drop = 1 - data.steps[i].reached / before;
    if (drop > worstDrop) { worstDrop = drop; worst = i; }
  }
  const end = data.steps[data.steps.length - 1];

  return (
    <>
      <div className="an-controls">
        <Segmented label="Pipeline" options={ordered.map((p) => ({ id: p.id, label: `${p.name} (${counts.get(p.id) ?? 0})` }))} value={pipeline.id} onChange={setChosen} />
      </div>

      {!data.total ? <p className="an-empty">Nenhum lead deste pipeline no período.</p> : (
        <>
          <section className="an-panel" aria-label={`Funil de ${pipeline.name}`}>
            <p className="an-lead">
              <strong>{end.reached}</strong> de <strong>{data.total}</strong> leads chegaram a {end.name} ({share(end.reached, data.total)}).
              {worst > 0 && <> A maior queda é de <strong>{data.steps[worst - 1].name}</strong> para <strong>{data.steps[worst].name}</strong>.</>}
            </p>
            <ol className="an-funnel">
              {data.steps.map((st, i) => {
                const before = i ? data.steps[i - 1].reached : null;
                return (
                  <li key={st.id} data-worst={i === worst || undefined}>
                    <span className="an-funnel-name">{st.name}</span>
                    <span className="an-funnel-track">
                      <span className="an-funnel-fill" style={{ width: `${(st.reached / data.total) * 100}%` }} />
                    </span>
                    <span className="an-funnel-count">{st.reached}<small>{st.here} aqui agora</small></span>
                    <span className="an-funnel-step" title={before !== null && before < MIN_BASE ? SMALL : undefined}>
                      {before === null ? 'entrada' : before ? <>{share(st.reached, before)}<small>da etapa anterior</small></> : '—'}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="an-note">
              {data.lost > 0 && <>{data.lost} {data.lost === 1 ? 'se perdeu' : 'se perderam'} no caminho. </>}
              O CRM guarda a etapa atual de cada registro: “chegou até” conta quem está na etapa ou depois dela. Oportunidade perdida conta só até a qualificação.
            </p>
          </section>

          <Section title="Conversão por canal" note="Quantos leads de cada canal chegaram a cada etapa.">
            <div className="table-scroll">
              <table className="data-table an-table an-heat">
                <thead><tr><th>Canal</th>{data.steps.map((st) => <th key={st.id} className="an-num">{st.name}</th>)}<th className="an-num">Valor ganho</th></tr></thead>
                <tbody>
                  {byChannel.map(({ channel, data: d }) => (
                    <tr key={channel.key}>
                      <td><div className="an-cell"><ChannelLogo channel={channel.key} name={channel.label} domain={a.projectDomain.get(channel.key)} /><span className="cell-primary">{channel.label}</span></div></td>
                      {d.steps.map((st, i) => (
                        <td key={st.id} className="an-num" style={{ background: `color-mix(in srgb, var(--accent) ${Math.round((st.reached / d.total) * 22)}%, transparent)` }}>
                          {st.reached}{i > 0 && <span className="an-sub">{share(st.reached, d.total)}</span>}
                        </td>
                      ))}
                      <td className="an-num">{channel.wonCents ? money(channel.wonCents) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </>
  );
}
