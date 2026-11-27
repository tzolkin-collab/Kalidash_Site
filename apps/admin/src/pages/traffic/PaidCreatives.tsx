import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Image, Images, TriangleAlert, Video } from 'lucide-react';
import { METRICS, creativeGroups, sum } from '../../lib/paidMedia';
import type { AdRow, CreativeGroup, Match } from '../../lib/paidMedia';
import { SidePanel } from '../../components/ui';
import { BrandLogo } from '../../components/analytics/SourceLogo';
import { Segmented } from '../../components/analytics/parts';
import { show } from './paidFormat';

// Criativos pagos em ranking: uma linha por peça, somando todos os anúncios e contas em que ela roda.

const MATCH: Record<Match, { label: string; hint: string }> = {
  id: { label: 'Mesmo ID do criativo', hint: 'Todos os anúncios usam um só criativo do Meta.' },
  arquivo: { label: 'Mesmo arquivo', hint: 'IDs de criativo diferentes com a mesma imagem, vídeo ou publicação.' },
  nome: { label: 'Só pelo nome', hint: 'O arquivo é outro (reenviado); juntei porque o nome e o formato batem. Confira.' },
};
const FORMAT = { video: { label: 'Vídeo', Icon: Video }, image: { label: 'Imagem', Icon: Image }, carousel: { label: 'Carrossel', Icon: Images } } as const;
const COLUMNS = ['spend', 'revenue', 'roas', 'leads', 'cpl', 'ctr', 'cpc', 'hook'];
const metric = (id: string) => METRICS.find((m) => m.id === id)!;
type Format = '' | AdRow['format'];

export default function PaidCreatives({ rows }: { rows: AdRow[] }) {
  const [order, setOrder] = useState<{ id: string; desc: boolean }>({ id: 'spend', desc: true });
  const [format, setFormat] = useState<Format>('');
  const [search, setSearch] = useState('');
  const [onlyWaste, setOnlyWaste] = useState(false);
  const [open, setOpen] = useState('');

  const groups = useMemo(() => creativeGroups(rows), [rows]);
  const waste = groups.filter((g) => !g.leads && g.spend > 0);
  const filtering = onlyWaste && waste.length > 0;
  const q = search.trim().toLowerCase();
  const list = groups
    .filter((g) => (!format || g.format === format) && (!filtering || (!g.leads && g.spend > 0))
      && (!q || `${g.name} ${g.creativeIds.join(' ')} ${g.ads.map((a) => `${a.adId} ${a.adName}`).join(' ')}`.toLowerCase().includes(q)))
    .sort((a, b) => {
      const x = metric(order.id).value(a), y = metric(order.id).value(b);
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      return order.desc ? y - x : x - y;
    });
  const selected = groups.find((g) => g.key === open);
  const total = sum(list);

  return (
    <>
      {waste.length > 0 && (
        <div className="tr-alert" role="note">
          <TriangleAlert size={16} aria-hidden />
          <span><strong>{waste.length} {waste.length === 1 ? 'criativo gastou' : 'criativos gastaram'} {show(sum(waste).spend, 'money')} sem trazer lead</strong> neste período.</span>
          <button type="button" className="an-link" aria-pressed={filtering} onClick={() => setOnlyWaste((v) => !v)}>{filtering ? 'Ver todos' : 'Mostrar só eles'}</button>
        </div>
      )}
      <div className="tr-filters">
        <input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou ID do Meta" aria-label="Buscar por nome ou ID do Meta" />
        <Segmented<Format> label="Formato" value={format} onChange={setFormat} options={[{ id: '', label: 'Todos' }, { id: 'video', label: 'Vídeo' }, { id: 'image', label: 'Imagem' }, { id: 'carousel', label: 'Carrossel' }]} />
        <p className="tr-hint tr-tools">A mesma peça é somada em todas as contas em que roda.</p>
      </div>

      <div className="tr-table">
        <table className="data-table an-table">
          <thead>
            <tr>
              <th className="tr-name">Criativo</th>
              {COLUMNS.map((id) => (
                <th key={id} className="an-num" aria-sort={order.id === id ? (order.desc ? 'descending' : 'ascending') : undefined}>
                  <button type="button" className="tr-sort" title={metric(id).hint} onClick={() => setOrder((o) => ({ id, desc: o.id === id ? !o.desc : true }))}>
                    {metric(id).label}{order.id === id && (order.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((g, i) => {
              const { Icon, label } = FORMAT[g.format];
              return (
                <tr key={g.key} className="clickable" onClick={() => setOpen(g.key)}>
                  <td className="tr-name">
                    <span className="tr-cell">
                      <span className="tr-rank">{i + 1}</span>
                      <span className="tr-thumb" title={label}>
                        <Icon size={18} aria-hidden />
                        {g.ads.find((a) => a.thumbnailUrl) && <img src={g.ads.find((a) => a.thumbnailUrl)!.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.hidden = true; }} />}
                      </span>
                      <span className="tr-label">
                        <button type="button" className="tr-drill" onClick={(e) => { e.stopPropagation(); setOpen(g.key); }}>{g.name}</button>
                        <span className="tr-meta">
                          {g.match !== 'id' && <span className="tr-match" data-match={g.match} title={MATCH[g.match].hint}>{MATCH[g.match].label}</span>}
                          {label} · {g.ads.length} {g.ads.length === 1 ? 'anúncio' : 'anúncios'} · {g.accounts.length} {g.accounts.length === 1 ? 'conta' : 'contas'}
                        </span>
                      </span>
                    </span>
                  </td>
                  {COLUMNS.map((id) => <td key={id} className="an-num" data-tone={id === 'leads' && !g.leads && g.spend > 0 ? 'warn' : undefined}>{show(metric(id).value(g), metric(id).kind)}</td>)}
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={COLUMNS.length + 1}>Nenhum criativo com esses filtros neste período.</td></tr>}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr>
                <td className="tr-name">Total · {list.length}</td>
                {COLUMNS.map((id) => <td key={id} className="an-num">{show(metric(id).value(total), metric(id).kind)}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {selected && <Detail group={selected} onClose={() => setOpen('')} />}
    </>
  );
}

function Detail({ group: g, onClose }: { group: CreativeGroup; onClose: () => void }) {
  return (
    <SidePanel title={g.name} subtitle={`${FORMAT[g.format].label} · ${MATCH[g.match].label}`} onClose={onClose}>
      <div className="tr-form">
        <p className="tr-hint">{MATCH[g.match].hint}</p>
        <dl className="tr-facts">
          {COLUMNS.map((id) => <div key={id}><dt>{metric(id).label}</dt><dd>{show(metric(id).value(g), metric(id).kind)}</dd></div>)}
        </dl>
        <h3>IDs do criativo no Meta</h3>
        <p className="tr-ids">{g.creativeIds.map((id) => <code key={id}>{id}</code>)}</p>
        <h3>Onde está rodando</h3>
        <ul className="tr-links">
          {g.ads.map((a) => (
            <li key={a.adId}>
              <div className="tr-link-head">
                <BrandLogo provider="meta" name="Meta" size={24} />
                <span><strong>{a.accountName}</strong><code>{a.campaignName} · {a.adsetName}</code></span>
                <small>{a.adStatus === 'ACTIVE' ? 'ativo' : 'pausado'}</small>
              </div>
              <p>{a.adName} · anúncio {a.adId} · criativo {a.creativeId}</p>
              <p>{['spend', 'leads', 'cpl', 'sales', 'roas'].map((id) => `${metric(id).label} ${show(metric(id).value(a), metric(id).kind)}`).join(' · ')}</p>
            </li>
          ))}
        </ul>
      </div>
    </SidePanel>
  );
}
