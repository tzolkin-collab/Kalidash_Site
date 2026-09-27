import { useMemo, useState } from 'react';
import { Building2, Plus, User } from 'lucide-react';
import type { Lifecycle } from '../domain';
import { formatDate } from '../lib/format';
import { initials } from '../lib/people';
import { useStore } from '../lib/store';
import { usePaged } from '../lib/usePaged';
import { companiesStore, peopleStore } from '../mocks/people';
import { CompanyPanel, NewCompanyPanel, NewPersonPanel, PersonPanel } from '../components/PeoplePanels';
import { Badge, EmptyState, LifecycleBadge, Page, PageHeader, Pagination, SampleBanner, SearchBox, Tabs } from '../components/ui';

type View = 'people' | 'companies';
type Panel = { kind: 'person' | 'company'; id: string } | { kind: 'new-person' } | { kind: 'new-company' } | null;

export default function PeopleCompanies() {
  const [people] = useStore(peopleStore);
  const [companies] = useStore(companiesStore);
  const [view, setView] = useState<View>('people');
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState<'' | Lifecycle>('');
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const companyName = (id?: string) => companies.find((c) => c.id === id)?.name;
  const personName = (id?: string) => people.find((p) => p.id === id)?.name;

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    const names = new Map(companies.map((c) => [c.id, c.name]));
    return people.filter((p) => (!lifecycle || p.lifecycle === lifecycle) && (!q || [p.name, p.email, p.document ?? '', names.get(p.companyId ?? '') ?? '', ...p.tags].some((v) => v.toLowerCase().includes(q))));
  }, [people, companies, search, lifecycle]);

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => (!lifecycle || c.lifecycle === lifecycle) && (!q || [c.name, c.document ?? '', c.segment].some((v) => v.toLowerCase().includes(q))));
  }, [companies, search, lifecycle]);

  const pagedPeople = usePaged(filteredPeople, 10);
  const pagedCompanies = usePaged(filteredCompanies, 10);
  const reviewCount = companies.filter((c) => c.status === 'REVIEW').length;

  return (
    <Page>
      <PageHeader
        title="Pessoas & Empresas"
        subtitle="Contatos e empresas (B2B). Uma empresa só é cadastrada de fato com CNPJ; sem ele ela fica em análise."
        actions={
          <>
            <button type="button" className="btn" onClick={() => setPanel({ kind: 'new-company' })}><Building2 size={14} /> Nova empresa</button>
            <button type="button" className="btn btn-solid" onClick={() => setPanel({ kind: 'new-person' })}><Plus size={14} /> Nova pessoa</button>
          </>
        }
      />
      <SampleBanner phase={2} />
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" className="icon-btn bare" onClick={() => setNotice(null)} aria-label="Dispensar">×</button>
        </div>
      )}

      <Tabs
        tabs={[{ id: 'people' as View, label: 'Pessoas', count: people.length }, { id: 'companies' as View, label: 'Empresas', count: companies.length }]}
        value={view}
        onChange={setView}
      />

      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder={view === 'people' ? 'Buscar por nome, e-mail, CPF ou tag…' : 'Buscar por nome, CNPJ ou segmento…'} />
        <select className="select select-sm" value={lifecycle} onChange={(e) => setLifecycle(e.target.value as '' | Lifecycle)} aria-label="Filtrar por ciclo de vida">
          <option value="">Todos os ciclos de vida</option>
          <option value="LEAD">Lead</option>
          <option value="PROSPECT">Em negociação</option>
          <option value="CLIENT">Cliente</option>
        </select>
        {view === 'companies' && reviewCount > 0 && <Badge tone="warning" title="Empresas sem CNPJ">{reviewCount} em análise</Badge>}
      </div>

      {view === 'people' ? (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Pessoa</th><th>Empresa</th><th>CPF</th><th>Telefone</th><th>Tags</th><th>Ciclo de vida</th><th>Cadastro</th></tr></thead>
              <tbody>
                {pagedPeople.rows.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => setPanel({ kind: 'person', id: p.id })}>
                    <td>
                      <div className="cell-avatar">
                        <span className="avatar">{initials(p.name) || <User size={12} />}</span>
                        <div className="cell-stack"><span className="cell-primary">{p.name}</span><span className="text-xs text-muted">{p.email}</span></div>
                      </div>
                    </td>
                    <td>{companyName(p.companyId) ?? <span className="text-muted">Pessoa física</span>}{p.role && <div className="text-xs text-muted">{p.role}</div>}</td>
                    <td className="mono">{p.document ?? <span className="text-muted">—</span>}</td>
                    <td className="text-muted">{p.phone}</td>
                    <td><div className="tag-row">{p.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div></td>
                    <td><LifecycleBadge value={p.lifecycle} /></td>
                    <td className="text-muted">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
                {filteredPeople.length === 0 && <tr><td colSpan={7}><EmptyState title="Nenhuma pessoa encontrada">Ajuste a busca ou cadastre uma nova pessoa.</EmptyState></td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={pagedPeople.page} pageSize={pagedPeople.pageSize} total={pagedPeople.total} onPage={pagedPeople.setPage} onPageSize={pagedPeople.setPageSize} />
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Empresa</th><th>CNPJ</th><th>Contato padrão</th><th>Stakeholders</th><th>Ciclo de vida</th><th>Cadastro</th></tr></thead>
              <tbody>
                {pagedCompanies.rows.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => setPanel({ kind: 'company', id: c.id })}>
                    <td>
                      <div className="cell-avatar">
                        <span className="avatar avatar-square"><Building2 size={14} /></span>
                        <div className="cell-stack"><span className="cell-primary">{c.name}</span><span className="text-xs text-muted">{c.segment}</span></div>
                      </div>
                    </td>
                    <td>{c.status === 'REVIEW' ? <Badge tone="warning" title='Tarefa "Informar CNPJ" aberta'>Em análise</Badge> : <span className="mono">{c.document}</span>}</td>
                    <td>{personName(c.defaultContactId) ?? <span className="text-muted">—</span>}</td>
                    <td className="text-muted">{c.stakeholders.length}</td>
                    <td><LifecycleBadge value={c.lifecycle} /></td>
                    <td className="text-muted">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
                {filteredCompanies.length === 0 && <tr><td colSpan={6}><EmptyState title="Nenhuma empresa encontrada">Ajuste a busca ou cadastre uma nova empresa.</EmptyState></td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={pagedCompanies.page} pageSize={pagedCompanies.pageSize} total={pagedCompanies.total} onPage={pagedCompanies.setPage} onPageSize={pagedCompanies.setPageSize} />
        </div>
      )}

      {panel?.kind === 'person' && <PersonPanel personId={panel.id} onClose={() => setPanel(null)} />}
      {panel?.kind === 'company' && <CompanyPanel companyId={panel.id} onClose={() => setPanel(null)} />}
      {panel?.kind === 'new-person' && <NewPersonPanel onClose={() => setPanel(null)} onCreated={setNotice} />}
      {panel?.kind === 'new-company' && <NewCompanyPanel onClose={() => setPanel(null)} onCreated={setNotice} />}
    </Page>
  );
}
