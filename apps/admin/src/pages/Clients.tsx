import { useMemo, useState } from 'react';
import { Building2, User } from 'lucide-react';
import { formatDate } from '../lib/format';
import { initials } from '../lib/people';
import { useStore } from '../lib/store';
import { usePaged } from '../lib/usePaged';
import { companiesStore, peopleStore } from '../mocks/people';
import { CompanyPanel, PersonPanel } from '../components/PeoplePanels';
import { Badge, EmptyState, Page, PageHeader, Pagination, SampleBanner, SearchBox, Tabs } from '../components/ui';

type View = 'all' | 'companies' | 'people';

type Row = { kind: 'company' | 'person'; id: string; name: string; sub: string; document?: string; inReview: boolean; contact?: string; since: string };

export default function Clients() {
  const [people] = useStore(peopleStore);
  const [companies] = useStore(companiesStore);
  const [view, setView] = useState<View>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Pick<Row, 'kind' | 'id'> | null>(null);

  // Cliente é um estado (ciclo de vida), não um cadastro à parte: pessoas e empresas que viraram clientes.
  const rows = useMemo<Row[]>(() => {
    const byId = new Map(people.map((p) => [p.id, p.name]));
    const c: Row[] = companies.filter((x) => x.lifecycle === 'CLIENT').map((x) => ({ kind: 'company', id: x.id, name: x.name, sub: x.segment, document: x.document, inReview: x.status === 'REVIEW', contact: byId.get(x.defaultContactId ?? ''), since: x.createdAt }));
    const p: Row[] = people.filter((x) => x.lifecycle === 'CLIENT' && !x.companyId).map((x) => ({ kind: 'person', id: x.id, name: x.name, sub: x.email, document: x.document, inReview: false, since: x.createdAt }));
    return [...c, ...p].sort((a, b) => b.since.localeCompare(a.since));
  }, [people, companies]);

  const counts = { all: rows.length, companies: rows.filter((r) => r.kind === 'company').length, people: rows.filter((r) => r.kind === 'person').length };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (view === 'all' || (view === 'companies') === (r.kind === 'company')) && (!q || [r.name, r.sub, r.document ?? '', r.contact ?? ''].some((v) => v.toLowerCase().includes(q))));
  }, [rows, view, search]);

  const paged = usePaged(filtered, 10);

  return (
    <Page>
      <PageHeader title="Clientes" subtitle="Pessoas e empresas cujo ciclo de vida é Cliente. O selo aparece quando a oportunidade é ganha." />
      <SampleBanner phase={2} />

      <Tabs
        tabs={[{ id: 'all' as View, label: 'Todos', count: counts.all }, { id: 'companies' as View, label: 'Empresas', count: counts.companies }, { id: 'people' as View, label: 'Pessoas', count: counts.people }]}
        value={view}
        onChange={setView}
      />
      <div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Buscar cliente, documento ou contato…" /></div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Cliente</th><th>Tipo</th><th>Documento</th><th>Contato padrão</th><th>Cliente desde</th></tr></thead>
            <tbody>
              {paged.rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="clickable" onClick={() => setOpen({ kind: r.kind, id: r.id })}>
                  <td>
                    <div className="cell-avatar">
                      <span className={`avatar ${r.kind === 'company' ? 'avatar-square' : ''}`}>{r.kind === 'company' ? <Building2 size={14} /> : initials(r.name) || <User size={12} />}</span>
                      <div className="cell-stack"><span className="cell-primary">{r.name}</span><span className="text-xs text-muted">{r.sub}</span></div>
                    </div>
                  </td>
                  <td><Badge tone={r.kind === 'company' ? 'info' : 'neutral'}>{r.kind === 'company' ? 'Empresa' : 'Pessoa'}</Badge></td>
                  <td>{r.inReview ? <Badge tone="warning">Em análise</Badge> : <span className="mono">{r.document ?? '—'}</span>}</td>
                  <td>{r.contact ?? <span className="text-muted">—</span>}</td>
                  <td className="text-muted">{formatDate(r.since)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5}><EmptyState title="Nenhum cliente por aqui">Quando uma oportunidade for ganha, a pessoa ou a empresa aparece nesta lista.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onPage={paged.setPage} onPageSize={paged.setPageSize} />
      </div>

      {open?.kind === 'person' && <PersonPanel personId={open.id} onClose={() => setOpen(null)} />}
      {open?.kind === 'company' && <CompanyPanel companyId={open.id} onClose={() => setOpen(null)} />}
    </Page>
  );
}
