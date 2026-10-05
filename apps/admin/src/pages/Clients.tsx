import { useMemo, useState } from 'react';
import { Building2, Plus, User } from 'lucide-react';
import { maskCpf } from '../lib/documents';
import { formatCurrency, formatDate } from '../lib/format';
import { initials } from '../lib/people';
import { useStore } from '../lib/store';
import { useCrmMode } from '../lib/crmMode';
import { useAllOpportunities } from '../lib/useAllOpportunities';
import { usePaged } from '../lib/usePaged';
import { companiesOf, companiesStore, peopleStore } from '../mocks/people';
import { pipelinesStore } from '../mocks/pipelines';
import { resolveStage } from '../lib/stages';
import NewPartyHost from '../components/NewPartyHost';
import PartySheets from '../components/PartySheets';
import type { PartyRef } from '../components/PartySheets';
import { Badge, EmptyState, Field, Page, PageHeader, Pagination, SampleBanner, SearchBox, SidePanel, Tabs } from '../components/ui';

type View = 'all' | 'companies' | 'people';

type Row = {
  kind: 'company' | 'person';
  id: string;
  name: string;
  sub: string;
  document?: string;
  inReview: boolean;
  legacy: boolean;
  contact?: string;
  since: string;
  won: number;
  opps: number;
};

export default function Clients() {
  const crmMode = useCrmMode();
  const [people] = useStore(peopleStore);
  const [companies] = useStore(companiesStore);
  const { all: opps } = useAllOpportunities();
  const [view, setView] = useState<View>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<PartyRef>(null);
  const [choosing, setChoosing] = useState(false);
  const [creating, setCreating] = useState<'person' | 'company' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Cliente é um estado (ciclo de vida), não um cadastro à parte: a empresa que ganhou, ou a pessoa sem empresa.
  const rows = useMemo<Row[]>(() => {
    const byId = new Map(people.map((p) => [p.id, p.name]));
    const stats = (name: string, kind: 'company' | 'person') => {
      const mine = opps.filter((o) => (kind === 'company' ? o.companyName === name : o.contactName === name && !o.companyName));
      return { won: mine.filter((o) => resolveStage(o, pipelinesStore.get()).stage?.kind === 'WON').reduce((a, o) => a + (o.value || 0), 0), opps: mine.length };
    };
    const c: Row[] = companies.filter((x) => x.lifecycle === 'CLIENT' && !x.archivedAt).map((x) => ({ kind: 'company', id: x.id, name: x.name, sub: x.segment, document: x.document, inReview: !x.document, legacy: Boolean(x.legacyClient), contact: byId.get(x.defaultContactId ?? ''), since: x.firstWonAt ?? x.createdAt, ...stats(x.name, 'company') }));
    const p: Row[] = people.filter((x) => x.lifecycle === 'CLIENT' && !x.archivedAt && companiesOf(companies, x.id).length === 0).map((x) => ({ kind: 'person', id: x.id, name: x.name, sub: x.email, document: x.document, inReview: false, legacy: Boolean(x.legacyClient), since: x.firstWonAt ?? x.createdAt, ...stats(x.name, 'person') }));
    return [...c, ...p].sort((a, b) => b.since.localeCompare(a.since));
  }, [people, companies, opps]);

  const counts = { all: rows.length, companies: rows.filter((r) => r.kind === 'company').length, people: rows.filter((r) => r.kind === 'person').length };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (view === 'all' || (view === 'companies') === (r.kind === 'company')) && (!q || [r.name, r.sub, r.document ?? '', r.contact ?? ''].some((v) => v.toLowerCase().includes(q))));
  }, [rows, view, search]);

  const paged = usePaged(filtered, 10);

  return (
    <Page>
      <PageHeader
        title="Clientes"
        subtitle="Pessoas e empresas cujo ciclo de vida é Cliente. Ele nasce quando uma oportunidade é ganha; quem já era cliente antes do sistema entra pelo botão ao lado."
        actions={<button type="button" className="btn btn-solid" onClick={() => setChoosing(true)}><Plus size={14} /> Adicionar cliente existente</button>}
      />
      {crmMode !== 'api' && <SampleBanner phase={2} />}
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" className="icon-btn bare" onClick={() => setNotice(null)} aria-label="Dispensar">×</button>
        </div>
      )}

      <Tabs
        tabs={[{ id: 'all' as View, label: 'Todos', count: counts.all }, { id: 'companies' as View, label: 'Empresas', count: counts.companies }, { id: 'people' as View, label: 'Pessoas', count: counts.people }]}
        value={view}
        onChange={(id) => setView(id as View)}
      />
      <div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Buscar cliente, documento ou contato…" /></div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Cliente</th><th>Tipo</th><th>Documento</th><th>Contato padrão</th><th>Cliente desde</th><th>Valor ganho</th><th>Oportunidades</th></tr></thead>
            <tbody>
              {paged.rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="clickable" onClick={() => setOpen({ kind: r.kind, id: r.id })}>
                  <td>
                    <div className="cell-avatar">
                      <span className={`avatar ${r.kind === 'company' ? 'avatar-square' : ''}`}>{r.kind === 'company' ? <Building2 size={14} /> : initials(r.name) || <User size={12} />}</span>
                      <div className="cell-stack"><span className="cell-primary">{r.name}{r.legacy && <Badge tone="info" variant="line" title="Cliente de antes do sistema">Legado</Badge>}</span><span className="text-xs text-muted">{r.sub}</span></div>
                    </div>
                  </td>
                  <td><Badge tone={r.kind === 'company' ? 'info' : 'neutral'}>{r.kind === 'company' ? 'Empresa' : 'Pessoa'}</Badge></td>
                  <td>{r.inReview ? <Badge tone="warning">Em análise</Badge> : <span className="mono">{r.document ? (r.kind === 'person' ? maskCpf(r.document) : r.document) : '—'}</span>}</td>
                  <td>{r.contact ?? <span className="text-muted">—</span>}</td>
                  <td className="text-muted">{formatDate(r.since)}</td>
                  <td>{r.won > 0 ? formatCurrency(r.won) : <span className="text-muted">—</span>}</td>
                  <td className="text-muted">{r.opps}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7}><EmptyState title="Nenhum cliente por aqui">Quando uma oportunidade for ganha, a pessoa ou a empresa aparece nesta lista.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onPage={paged.setPage} onPageSize={paged.setPageSize} />
      </div>

      <PartySheets open={open} onOpen={setOpen} />

      {choosing && (
        <SidePanel title="Adicionar cliente existente" subtitle="Para quem já era cliente antes do sistema. O cadastro nasce marcado como Cliente e o histórico registra a origem." onClose={() => setChoosing(false)}>
          <div className="form-stack">
            <Field label="O cliente é…">
              <div className="choice-row">
                <button type="button" className="choice-card" onClick={() => { setChoosing(false); setCreating('company'); }}><Building2 size={18} /><strong>Empresa</strong><span className="text-xs text-muted">Com CNPJ e contatos</span></button>
                <button type="button" className="choice-card" onClick={() => { setChoosing(false); setCreating('person'); }}><User size={18} /><strong>Pessoa</strong><span className="text-xs text-muted">Pessoa física, com CPF</span></button>
              </div>
            </Field>
          </div>
        </SidePanel>
      )}
      <NewPartyHost creating={creating} asLegacy onClose={() => setCreating(null)} onCreated={(ref, message) => { setCreating(null); setNotice(message); setOpen(ref); }} />
    </Page>
  );
}
