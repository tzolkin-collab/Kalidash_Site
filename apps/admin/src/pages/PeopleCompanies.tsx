import { useMemo, useState } from 'react';
import { Building2, Plus, User } from 'lucide-react';
import type { Lifecycle } from '../domain';
import { maskCpf } from '../lib/documents';
import { formatDate } from '../lib/format';
import { initials } from '../lib/people';
import { useStore } from '../lib/store';
import { useCrmMode } from '../lib/crmMode';
import { usePaged } from '../lib/usePaged';
import { companiesOf, companiesStore, peopleStore } from '../mocks/people';
import NewPartyPanels from '../components/NewPartyHost';
import PartySheets from '../components/PartySheets';
import type { PartyRef } from '../components/PartySheets';
import { Badge, EmptyState, LifecycleBadge, Page, PageHeader, Pagination, SampleBanner, SearchBox, Tabs } from '../components/ui';
import { CustomSelect } from '../components/ui';

type View = 'people' | 'companies';

export default function PeopleCompanies() {
  const crmMode = useCrmMode();
  const [people] = useStore(peopleStore);
  const [companies] = useStore(companiesStore);
  const [view, setView] = useState<View>('people');
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState<'' | Lifecycle>('');
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState<PartyRef>(null);
  const [creating, setCreating] = useState<'person' | 'company' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const personName = (id?: string) => people.find((p) => p.id === id)?.name;
  const visiblePeople = useMemo(() => people.filter((p) => showArchived || !p.archivedAt), [people, showArchived]);
  const visibleCompanies = useMemo(() => companies.filter((c) => showArchived || !c.archivedAt), [companies, showArchived]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visiblePeople.filter((p) => {
      if (lifecycle && p.lifecycle !== lifecycle) return false;
      if (!q) return true;
      const names = companiesOf(companies, p.id).map((c) => c.name);
      return [p.name, p.email, p.document ?? '', ...names, ...p.tags].some((v) => v.toLowerCase().includes(q));
    });
  }, [visiblePeople, companies, search, lifecycle]);

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleCompanies.filter((c) => (!lifecycle || c.lifecycle === lifecycle) && (!q || [c.name, c.document ?? '', c.segment].some((v) => v.toLowerCase().includes(q))));
  }, [visibleCompanies, search, lifecycle]);

  const pagedPeople = usePaged(filteredPeople, 10);
  const pagedCompanies = usePaged(filteredCompanies, 10);
  const reviewCount = visibleCompanies.filter((c) => !c.document).length;
  const archivedCount = people.filter((p) => p.archivedAt).length + companies.filter((c) => c.archivedAt).length;

  return (
    <Page>
      <PageHeader
        title="Pessoas & Empresas"
        subtitle="Contatos e empresas (B2B). Clique em um registro para abrir a ficha e editar campo a campo. Uma empresa só é cadastrada de fato com CNPJ; sem ele ela fica em análise."
        actions={
          <>
            <button type="button" className="btn" onClick={() => setCreating('company')}><Building2 size={14} /> Nova empresa</button>
            <button type="button" className="btn btn-solid" onClick={() => setCreating('person')}><Plus size={14} /> Nova pessoa</button>
          </>
        }
      />
      {crmMode !== 'api' && <SampleBanner phase={2} />}
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" className="icon-btn bare" onClick={() => setNotice(null)} aria-label="Dispensar">×</button>
        </div>
      )}

      <Tabs
        tabs={[{ id: 'people' as View, label: 'Pessoas', count: visiblePeople.length }, { id: 'companies' as View, label: 'Empresas', count: visibleCompanies.length }]}
        value={view}
        onChange={setView}
      />

      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder={view === 'people' ? 'Buscar por nome, e-mail, CPF, empresa ou tag…' : 'Buscar por nome, CNPJ ou segmento…'} />
        <CustomSelect className="select select-sm" value={lifecycle} onChange={(e) => setLifecycle(e.target.value as '' | Lifecycle)} aria-label="Filtrar por ciclo de vida">
          <option value="">Todos os ciclos de vida</option>
          <option value="LEAD">Lead</option>
          <option value="PROSPECT">Em negociação</option>
          <option value="CLIENT">Cliente</option>
          <option value="INACTIVE">Inativo</option>
        </CustomSelect>
        <label className="check-inline"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar arquivados{archivedCount > 0 && <span className="tab-count">{archivedCount}</span>}</label>
        {view === 'companies' && reviewCount > 0 && <Badge tone="warning" title="Empresas sem CNPJ">{reviewCount} em análise</Badge>}
      </div>

      {view === 'people' ? (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Pessoa</th><th>Empresas</th><th>CPF</th><th>Telefone</th><th>Tags</th><th>Ciclo de vida</th><th>Cadastro</th></tr></thead>
              <tbody>
                {pagedPeople.rows.map((p) => {
                  const mine = companiesOf(companies, p.id);
                  return (
                    <tr key={p.id} className={`clickable ${p.archivedAt ? 'is-archived' : ''}`} onClick={() => setOpen({ kind: 'person', id: p.id })}>
                      <td>
                        <div className="cell-avatar">
                          <span className="avatar">{initials(p.name) || <User size={12} />}</span>
                          <div className="cell-stack"><span className="cell-primary">{p.name}{p.archivedAt && <Badge tone="danger">Arquivada</Badge>}</span><span className="text-xs text-muted">{p.email}</span></div>
                        </div>
                      </td>
                      <td>{mine.length ? mine.map((c) => c.name).join(', ') : <span className="text-muted">Pessoa física</span>}{p.role && <div className="text-xs text-muted">{p.role}</div>}</td>
                      <td className="mono">{p.document ? maskCpf(p.document) : <span className="text-muted">—</span>}</td>
                      <td className="text-muted">{p.phone}</td>
                      <td><div className="tag-row">{p.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div></td>
                      <td><LifecycleBadge value={p.lifecycle} /></td>
                      <td className="text-muted">{formatDate(p.createdAt)}</td>
                    </tr>
                  );
                })}
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
                  <tr key={c.id} className={`clickable ${c.archivedAt ? 'is-archived' : ''}`} onClick={() => setOpen({ kind: 'company', id: c.id })}>
                    <td>
                      <div className="cell-avatar">
                        <span className="avatar avatar-square"><Building2 size={14} /></span>
                        <div className="cell-stack"><span className="cell-primary">{c.name}{c.archivedAt && <Badge tone="danger">Arquivada</Badge>}</span><span className="text-xs text-muted">{c.segment}</span></div>
                      </div>
                    </td>
                    <td>{c.document ? <span className="mono">{c.document}</span> : <Badge tone="warning" title='Tarefa "Informar CNPJ" aberta'>Em análise</Badge>}</td>
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

      <PartySheets open={open} onOpen={setOpen} />
      <NewPartyPanels creating={creating} onClose={() => setCreating(null)} onCreated={(ref, message) => { setCreating(null); setNotice(message); setOpen(ref); }} />
    </Page>
  );
}
