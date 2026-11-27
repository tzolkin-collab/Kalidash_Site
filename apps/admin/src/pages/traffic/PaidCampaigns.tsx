import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Columns3, Download, X } from 'lucide-react';
import { LEVELS, METRICS, byLevel, csvCell, sum } from '../../lib/paidMedia';
import type { AdRow, Level, LevelRow } from '../../lib/paidMedia';
import { BrandLogo } from '../../components/analytics/SourceLogo';
import { Segmented } from '../../components/analytics/parts';
import { show } from './paidFormat';

// Tabela de campanhas no desenho das ferramentas de rastreio de anúncios: abas por nível, seleção que filtra os
// níveis de baixo, busca, situação, conjuntos de colunas, ordenação, total e exportação. Ligar, pausar e mudar
// orçamento ficam desligados: exigem permissão de gestão no Meta.

const STORE = 'kalidash.paid.columns';
const NEXT: Partial<Record<Level, Level>> = { account: 'campaign', campaign: 'adset', adset: 'ad' };
const SINGULAR: Record<Level, string> = { account: 'Conta', campaign: 'Campanha', adset: 'Conjunto', ad: 'Anúncio' };
const ID_OF: Record<Level, 'accountId' | 'campaignId' | 'adsetId' | 'adId'> = { account: 'accountId', campaign: 'campaignId', adset: 'adsetId', ad: 'adId' };
const depth = (l: Level) => LEVELS.findIndex((x) => x.id === l);

const PRESETS = [
  { id: 'resumo', label: 'Resumo', columns: ['spend', 'sales', 'cpa', 'revenue', 'profit', 'roas', 'leads', 'cpl', 'ctr', 'cpc', 'cpm'] },
  { id: 'anuncio', label: 'Anúncio', columns: ['spend', 'impressions', 'cpm', 'clicks', 'cpc', 'ctr', 'hook', 'leads', 'cpl'] },
  { id: 'funil', label: 'Funil', columns: ['spend', 'clicks', 'pageViews', 'connect', 'cpv', 'leads', 'pageConv', 'qualified', 'cpql', 'sales', 'cpa'] },
] as const;

type Preferences = string[];
function savedColumns(): Preferences {
  try {
    const list = JSON.parse(localStorage.getItem(STORE) ?? 'null') as unknown;
    if (Array.isArray(list)) return list.filter((id): id is string => METRICS.some((m) => m.id === id));
  } catch { /* sem armazenamento: usa o padrão */ }
  return [...PRESETS[0].columns];
}

export default function PaidCampaigns({ rows }: { rows: AdRow[] }) {
  const [level, setLevel] = useState<Level>('campaign');
  const [picked, setPicked] = useState<Partial<Record<Level, string[]>>>({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'ACTIVE' | 'PAUSED'>('');
  const [columns, setColumns] = useState<string[]>(savedColumns);
  const [picking, setPicking] = useState(false);
  const [order, setOrder] = useState<{ id: string; desc: boolean }>({ id: 'spend', desc: true });
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(columns)); } catch { /* sem armazenamento */ } }, [columns]);
  useEffect(() => {
    if (!picking) return;
    const down = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setPicking(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicking(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [picking]);

  // A ordem das colunas é a escolhida no conjunto (ou a ordem em que a pessoa foi marcando).
  const metrics = columns.map((id) => METRICS.find((m) => m.id === id)!).filter(Boolean);
  const preset = PRESETS.find((p) => p.columns.join() === columns.join())?.id ?? 'custom';
  // Só a seleção dos níveis ACIMA do atual filtra a tabela.
  const above = LEVELS.filter((l) => depth(l.id) < depth(level) && picked[l.id]?.length);
  const table = useMemo(() => {
    const scoped = rows.filter((r) => LEVELS.every((l) => depth(l.id) >= depth(level) || !picked[l.id]?.length || picked[l.id]!.includes(r[ID_OF[l.id]])));
    const q = search.trim().toLowerCase();
    const list = byLevel(scoped, level).filter((r) => (!q || `${r.name} ${r.id}`.toLowerCase().includes(q)) && (!status || level === 'account' || r.status === status));
    const metric = METRICS.find((m) => m.id === order.id);
    const value = (r: LevelRow) => (order.id === 'budget' ? r.budget ?? null : metric?.value(r) ?? null);
    return list.sort((a, b) => {
      if (order.id === 'name') return (order.desc ? -1 : 1) * a.name.localeCompare(b.name, 'pt-BR');
      const x = value(a), y = value(b);
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; // sem valor vai para o fim nos dois sentidos
      return order.desc ? y - x : x - y;
    });
  }, [rows, level, picked, search, status, order]);

  const mine = picked[level] ?? [];
  const marked = table.filter((r) => mine.includes(r.id));
  // Com linhas marcadas, o total é o delas; sem marca, o de tudo o que está na tela.
  const total = sum(marked.length ? marked : table);
  const allMarked = table.length > 0 && marked.length === table.length;
  const mark = (ids: string[]) => setPicked((p) => ({ ...p, [level]: ids }));

  const sortBy = (id: string) => setOrder((o) => ({ id, desc: o.id === id ? !o.desc : id !== 'name' }));
  const sortButton = (id: string, label: string, hint?: string) => (
    <button type="button" className="tr-sort" title={hint} onClick={() => sortBy(id)}>{label}{order.id === id && (order.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}</button>
  );
  const sorted = (id: string) => (order.id === id ? (order.desc ? 'descending' as const : 'ascending' as const) : undefined);
  const drill = (r: LevelRow) => {
    const next = NEXT[level];
    if (!next) return;
    setPicked((p) => ({ ...Object.fromEntries(Object.entries(p).filter(([l]) => depth(l as Level) < depth(level))), [level]: [r.id] }));
    setLevel(next);
    setSearch('');
  };
  const withStatus = level !== 'account';
  const withBudget = level === 'campaign' || level === 'adset';

  const download = () => {
    const header = [SINGULAR[level], 'ID', ...(withStatus ? ['Situação'] : []), ...(withBudget ? ['Orçamento/dia'] : []), ...metrics.map((m) => m.label)];
    const lines = (marked.length ? marked : table).map((r) => [
      r.name, r.id, ...(withStatus ? [r.status === 'ACTIVE' ? 'Ativo' : 'Pausado'] : []), ...(withBudget ? [show(r.budget ?? null, 'money')] : []), ...metrics.map((m) => show(m.value(r), m.kind)),
    ]);
    const text = [header, ...lines].map((line) => line.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `trafego-pago-${level}-exemplo.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="tr-filters">
        <Segmented<Level> label="Nível" options={LEVELS.map((l) => ({ id: l.id, label: picked[l.id]?.length ? `${l.label} (${picked[l.id]!.length})` : l.label }))} value={level} onChange={(l) => { setLevel(l); setSearch(''); }} />
        <input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou ID" aria-label="Buscar por nome ou ID" />
        {withStatus && (
          <Segmented label="Situação" value={status} onChange={setStatus} options={[{ id: '' as const, label: 'Todas' }, { id: 'ACTIVE' as const, label: 'Ativas' }, { id: 'PAUSED' as const, label: 'Pausadas' }]} />
        )}
        <div className="tr-tools">
          <Segmented
            label="Conjunto de colunas" value={preset}
            onChange={(id) => { const p = PRESETS.find((x) => x.id === id); if (p) setColumns([...p.columns]); else setPicking(true); }}
            options={[...PRESETS.map((p) => ({ id: p.id as string, label: p.label })), ...(preset === 'custom' ? [{ id: 'custom', label: 'Meu' }] : [])]}
          />
          <div className="tr-columns" ref={menu}>
            <button type="button" className="btn" aria-expanded={picking} onClick={() => setPicking((v) => !v)}><Columns3 size={14} /> Colunas</button>
            {picking && (
              <div className="tr-columns-menu">
                {METRICS.map((m) => (
                  <label key={m.id} title={m.hint}>
                    <input type="checkbox" checked={columns.includes(m.id)} onChange={(e) => setColumns((cur) => (e.target.checked ? [...cur, m.id] : cur.filter((x) => x !== m.id)))} />
                    {m.label}
                  </label>
                ))}
                <button type="button" className="link-btn" onClick={() => setColumns([...PRESETS[0].columns])}>Voltar ao padrão</button>
                <button type="button" className="btn btn-sm" onClick={() => setPicking(false)}>Fechar</button>
              </div>
            )}
          </div>
          <button type="button" className="btn" disabled={!table.length} onClick={download} title="Baixa o que está na tela (ou só as linhas marcadas)"><Download size={14} /> CSV</button>
        </div>
      </div>

      {(above.length > 0 || mine.length > 0) && (
        <div className="chip-row tr-chips">
          {[...above.map((l) => l.id), ...(mine.length ? [level] : [])].map((l) => {
            const ids = picked[l]!;
            const one = rows.find((r) => r[ID_OF[l]] === ids[0]);
            const name = one ? (l === 'account' ? one.accountName : l === 'campaign' ? one.campaignName : l === 'adset' ? one.adsetName : one.adName) : ids[0];
            const label = ids.length === 1 ? `${SINGULAR[l]}: ${name}` : `${ids.length} ${LEVELS[depth(l)].label.toLowerCase()} na seleção`;
            return <button key={l} type="button" className="chip active an-filter" onClick={() => setPicked((p) => ({ ...p, [l]: [] }))} aria-label={`Limpar seleção: ${label}`}>{label} <X size={12} /></button>;
          })}
        </div>
      )}

      <div className="tr-table">
        <table className="data-table an-table">
          <thead>
            <tr>
              <th className="tr-name" aria-sort={sorted('name')}>
                <span className="tr-cell">
                  <input type="checkbox" checked={allMarked} onChange={() => mark(allMarked ? [] : table.map((r) => r.id))} aria-label="Marcar todas as linhas" />
                  {sortButton('name', SINGULAR[level])}
                </span>
              </th>
              {withBudget && <th className="an-num" aria-sort={sorted('budget')}>{sortButton('budget', 'Orçamento/dia', 'Orçamento diário neste nível')}</th>}
              {metrics.map((m) => <th key={m.id} className="an-num" aria-sort={sorted(m.id)}>{sortButton(m.id, m.label, m.hint)}</th>)}
            </tr>
          </thead>
          <tbody>
            {table.map((r) => (
              <tr key={r.id} data-marked={mine.includes(r.id) || undefined}>
                <td className="tr-name">
                  <span className="tr-cell">
                    <input type="checkbox" checked={mine.includes(r.id)} onChange={(e) => mark(e.target.checked ? [...mine, r.id] : mine.filter((x) => x !== r.id))} aria-label={`Marcar ${r.name}`} />
                    {withStatus && <button type="button" role="switch" aria-checked={r.status === 'ACTIVE'} disabled className="tr-switch" aria-label={`${r.name}: ${r.status === 'ACTIVE' ? 'ativa' : 'pausada'}`} title="Ligar e pausar por aqui exige a permissão de gestão de anúncios no Meta"><span /></button>}
                    <BrandLogo provider="meta" name="Meta" size={18} />
                    <span className="tr-label">
                      {NEXT[level] ? <button type="button" className="tr-drill" onClick={() => drill(r)}>{r.name}</button> : <span className="cell-primary">{r.name}</span>}
                      <span className="an-sub">{r.context}</span>
                    </span>
                  </span>
                </td>
                {withBudget && <td className="an-num">{r.budget === undefined ? <span className="an-sub">{level === 'campaign' ? 'por conjunto' : 'na campanha'}</span> : show(r.budget, 'money')}</td>}
                {metrics.map((m) => {
                  const v = m.value(r);
                  const signed = m.id === 'profit' || m.id === 'roi' || m.id === 'margin';
                  // Gastou e não trouxe lead: o aviso fica na própria célula.
                  const waste = m.id === 'leads' && !r.leads && r.spend > 0;
                  return <td key={m.id} className="an-num" data-tone={signed && v !== null && v !== 0 ? (v > 0 ? 'up' : 'down') : waste ? 'warn' : undefined}>{show(v, m.kind)}</td>;
                })}
              </tr>
            ))}
            {!table.length && <tr><td colSpan={metrics.length + 2}>Nenhum anúncio com esses filtros neste período.</td></tr>}
          </tbody>
          {table.length > 0 && (
            <tfoot>
              <tr>
                <td className="tr-name">{marked.length ? `Total marcado · ${marked.length}` : `Total · ${table.length}`}</td>
                {withBudget && <td />}
                {metrics.map((m) => <td key={m.id} className="an-num">{show(m.value(total), m.kind)}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
