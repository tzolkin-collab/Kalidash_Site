import { useMemo, useState } from 'react';
import { ArrowRightCircle, Plus, XCircle } from 'lucide-react';
import type { Lead, LeadOrigin } from '../domain';
import { formatCnpj, formatCpf, isValidCnpj, isValidCpf, stripDoc } from '../lib/documents';
import { formatCurrency, formatDate, parseMoney } from '../lib/format';
import { createLead } from '../lib/leadFlow';
import { useStore } from '../lib/store';
import { useLeadActions } from '../lib/useLeadActions';
import { usePaged } from '../lib/usePaged';
import { leadsStore } from '../mocks/leads';
import { companiesStore, peopleStore } from '../mocks/people';
import { pipelinesStore } from '../mocks/pipelines';
import { teamStore } from '../mocks/team';
import LeadSheet from '../components/LeadSheet';
import PartySheets from '../components/PartySheets';
import type { PartyRef } from '../components/PartySheets';
import { Badge, EmptyState, Field, Page, PageHeader, Pagination, SampleBanner, SearchBox, SidePanel, Tabs } from '../components/ui';
import { CustomSelect } from '../components/ui';

type Status = Lead['status'];

const STATUS_TABS: { id: Status; label: string }[] = [
  { id: 'ACTIVE', label: 'Ativos' },
  { id: 'QUALIFIED', label: 'Qualificados' },
  { id: 'DISCARDED', label: 'Descartados' },
];

export default function Leads() {
  const [leads] = useStore(leadsStore);
  const [pipelines] = useStore(pipelinesStore);

  const [status, setStatus] = useState<Status>('ACTIVE');
  const [search, setSearch] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [originFilter, setOriginFilter] = useState<'' | LeadOrigin>('');
  const [tagFilter, setTagFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [openParty, setOpenParty] = useState<PartyRef>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const actions = useLeadActions(setNotice);

  const pipelineName = (id: string) => pipelines.find((p) => p.id === id)?.name ?? id;
  const stageName = (l: Lead) => pipelines.find((p) => p.id === l.pipelineId)?.stages.find((s) => s.id === l.stageId)?.name ?? '—';
  const visible = useMemo(() => leads.filter((l) => showArchived || !l.archivedAt), [leads, showArchived]);
  const allTags = useMemo(() => [...new Set(leads.flatMap((l) => l.tags))].sort(), [leads]);

  const counts = useMemo(() => ({
    ACTIVE: visible.filter((l) => l.status === 'ACTIVE').length,
    QUALIFIED: visible.filter((l) => l.status === 'QUALIFIED').length,
    DISCARDED: visible.filter((l) => l.status === 'DISCARDED').length,
  }), [visible]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visible.filter((l) => {
      if (l.status !== status) return false;
      if (pipelineFilter && l.pipelineId !== pipelineFilter) return false;
      if (originFilter && l.origin !== originFilter) return false;
      if (tagFilter && !l.tags.includes(tagFilter)) return false;
      return !q || [l.name, l.email, l.sourceName, l.owner ?? ''].some((v) => v.toLowerCase().includes(q));
    });
  }, [visible, status, search, pipelineFilter, originFilter, tagFilter]);

  const paged = usePaged(filtered, 10);

  const openParties = (ref: PartyRef) => { setOpenLead(null); setOpenParty(ref); };

  return (
    <Page>
      <PageHeader
        title="Leads"
        subtitle="Quem ainda não virou oportunidade. Todo lead nasce de uma fonte (inbound) ou de alguém da equipe (outbound). Clique em um lead para abrir a ficha e editar campo a campo."
        actions={<button type="button" className="btn btn-solid" onClick={() => setAdding(true)}><Plus size={14} /> Adicionar lead</button>}
      />
      <SampleBanner phase={3} />
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" className="icon-btn bare" onClick={() => setNotice(null)} aria-label="Dispensar">×</button>
        </div>
      )}

      <Tabs tabs={STATUS_TABS.map((t) => ({ ...t, count: counts[t.id] }))} value={status} onChange={setStatus} />

      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder="Buscar por nome, e-mail, fonte ou dono…" />
        <CustomSelect className="select select-sm" value={pipelineFilter} onChange={(e) => setPipelineFilter(e.target.value)} aria-label="Filtrar por pipeline">
          <option value="">Todas as pipelines</option>
          {pipelines.filter((p) => !p.archivedAt).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </CustomSelect>
        <CustomSelect className="select select-sm" value={originFilter} onChange={(e) => setOriginFilter(e.target.value as '' | LeadOrigin)} aria-label="Filtrar por origem">
          <option value="">Inbound e outbound</option>
          <option value="INBOUND">Inbound (fonte)</option>
          <option value="OUTBOUND">Outbound (equipe)</option>
        </CustomSelect>
        <CustomSelect className="select select-sm" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} aria-label="Filtrar por tag">
          <option value="">Todas as tags</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </CustomSelect>
        <label className="check-inline"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar arquivados</label>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Lead</th><th>Pipeline</th><th>Etapa</th><th>Origem</th><th>Dono</th><th>Valor est.</th><th>Tags</th><th>Entrou em</th><th style={{ width: '150px' }}></th></tr>
            </thead>
            <tbody>
              {paged.rows.map((l) => (
                <tr key={l.id} className={`clickable ${l.archivedAt ? 'is-archived' : ''}`} onClick={() => setOpenLead(l.id)}>
                  <td>
                    <div className="cell-stack">
                      <span className="cell-primary">{!l.wasSeen && <span className="unseen-dot" title="Ainda não foi aberto" />}{l.name}</span>
                      <span className="text-xs text-muted">{l.email}</span>
                      {(l.returningClient || l.archivedAt) && <span className="tag-row" style={{ marginTop: '2px' }}>{l.returningClient && <Badge tone="info">Cliente retornando</Badge>}{l.archivedAt && <Badge tone="danger">Arquivado</Badge>}</span>}
                    </div>
                  </td>
                  <td>{pipelineName(l.pipelineId)}</td>
                  <td><Badge>{stageName(l)}</Badge></td>
                  <td>
                    <div className="cell-stack">
                      <Badge tone={l.origin === 'INBOUND' ? 'info' : 'warning'}>{l.origin === 'INBOUND' ? 'Inbound' : 'Outbound'}</Badge>
                      <span className="text-xs text-muted" style={{ marginTop: '2px' }}>{l.origin === 'INBOUND' ? l.sourceName : `Trouxe: ${l.sourceName}`}</span>
                    </div>
                  </td>
                  <td>{l.owner ?? <span className="text-muted">Sem dono</span>}</td>
                  <td>{l.estimatedValue ? formatCurrency(l.estimatedValue) : <span className="text-muted">—</span>}</td>
                  <td><div className="tag-row">{l.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div></td>
                  <td className="text-muted">{formatDate(l.createdAt)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      {l.status === 'ACTIVE' && (
                        <>
                          <button type="button" className="btn btn-sm" onClick={() => actions.qualify(l)}><ArrowRightCircle size={13} /> Qualificar</button>
                          <button type="button" className="icon-btn" onClick={() => actions.discard(l)} title="Descartar" aria-label={`Descartar ${l.name}`}><XCircle size={15} /></button>
                        </>
                      )}
                      {l.status === 'DISCARDED' && <span className="text-xs text-muted" title={l.discardReason}>{l.discardReason}</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9}><EmptyState title="Nenhum lead aqui">Ajuste os filtros ou clique em "Adicionar lead".</EmptyState></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onPage={paged.setPage} onPageSize={paged.setPageSize} />
      </div>

      {openLead && <LeadSheet key={openLead} leadId={openLead} onClose={() => setOpenLead(null)} onOpenParty={openParties} onNotice={setNotice} />}
      <PartySheets open={openParty} onOpen={setOpenParty} />
      {actions.panels}
      {adding && <AddLeadPanel onClose={() => setAdding(false)} onCreated={(lead, notes) => { setAdding(false); setStatus('ACTIVE'); setNotice(`${lead.name} foi adicionado.${notes.length ? ` ${notes.join(' ')}` : ''}`); setOpenLead(lead.id); }} />}
    </Page>
  );
}

/* ------------------------------ cadastro de lead ------------------------------ */

function AddLeadPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (lead: Lead, notes: string[]) => void }) {
  const [pipelines] = useStore(pipelinesStore);
  const [team] = useStore(teamStore);
  const [people] = useStore(peopleStore);
  const [companies] = useStore(companiesStore);
  const active = pipelines.filter((p) => !p.archivedAt);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [docKind, setDocKind] = useState<'NONE' | 'CPF' | 'CNPJ'>('NONE');
  const [document, setDocument] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [pipelineId, setPipelineId] = useState(active[0]?.id ?? '');
  const [origin, setOrigin] = useState<LeadOrigin>('OUTBOUND');
  const [sourceName, setSourceName] = useState('');
  const [owner, setOwner] = useState('');
  const [value, setValue] = useState('');
  const [tags, setTags] = useState('');
  const [message, setMessage] = useState('');

  const pipeline = active.find((p) => p.id === pipelineId);
  const options = origin === 'INBOUND' ? (pipeline?.sources ?? []).map((s) => s.name) : team.map((m) => m.name);
  const effectiveSource = options.includes(sourceName) ? sourceName : '';

  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const existingPerson = emailOk ? people.find((p) => !p.archivedAt && [p.email, ...p.extraEmails.map((e) => e.value)].some((e) => e.toLowerCase() === email.trim().toLowerCase())) : undefined;
  const docError = docKind === 'CPF' && document && !isValidCpf(document) ? 'CPF inválido.' : docKind === 'CNPJ' && document && !isValidCnpj(document) ? 'CNPJ inválido.' : null;
  const existingCompany = docKind === 'CNPJ' && document && isValidCnpj(document) ? companies.find((c) => !c.archivedAt && c.document && stripDoc(c.document) === stripDoc(document)) : undefined;
  const parsedValue = value.trim() === '' ? undefined : parseMoney(value);
  const valueError = value.trim() !== '' && parsedValue === null ? 'Valor inválido.' : null;
  const valid = name.trim() !== '' && emailOk && effectiveSource !== '' && Boolean(pipeline) && !docError && !valueError;

  const save = () => {
    if (!valid) return;
    const { lead, notes } = createLead({
      name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, pipelineId, origin, sourceName: effectiveSource,
      owner: owner || undefined, estimatedValue: parsedValue ?? undefined, tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      message: message.trim() || undefined, docKind, document: document || undefined, companyName: companyName.trim() || undefined,
    });
    onCreated(lead, notes);
  };

  return (
    <SidePanel
      title="Adicionar lead"
      subtitle="Cadastro curto. O sistema acha a pessoa e a empresa pelo e-mail, CPF ou CNPJ; se não existirem, cria. O resto se completa na ficha."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!valid} onClick={save}>Adicionar</button></>}
    >
      <div className="form-stack">
        <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <div className="form-grid">
          <Field label="E-mail" hint={email && !emailOk ? 'Informe um e-mail válido.' : undefined}><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Telefone"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
        {existingPerson && <div className="task-callout" role="status"><span>Já existe <strong>{existingPerson.name}</strong> com este e-mail. O lead será vinculado a ela, sem duplicar.</span></div>}

        <div className="form-grid">
          <Field label="Documento">
            <CustomSelect className="select" value={docKind} onChange={(e) => { setDocKind(e.target.value as 'NONE' | 'CPF' | 'CNPJ'); setDocument(''); }}>
              <option value="NONE">Nenhum por enquanto</option>
              <option value="CPF">CPF (pessoa física)</option>
              <option value="CNPJ">CNPJ (empresa)</option>
            </CustomSelect>
          </Field>
          {docKind !== 'NONE' && (
            <Field label={docKind} hint={docError ?? (docKind === 'CNPJ' ? 'Sem CNPJ a empresa fica em análise.' : undefined)}>
              <input className="input mono" value={document} onChange={(e) => setDocument(docKind === 'CPF' ? formatCpf(e.target.value) : formatCnpj(e.target.value))} placeholder={docKind === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'} />
            </Field>
          )}
        </div>
        {docKind === 'CNPJ' && (
          <Field label="Nome da empresa" hint={existingCompany ? `Já existe ${existingCompany.name} com este CNPJ. O lead será vinculado a ela.` : 'Cria a empresa e liga esta pessoa a ela como contato padrão.'}>
            <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </Field>
        )}

        <Field label="Pipeline">
          <CustomSelect className="select" value={pipelineId} onChange={(e) => { setPipelineId(e.target.value); setSourceName(''); }}>{active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</CustomSelect>
        </Field>
        <Field label="Origem">
          <CustomSelect className="select" value={origin} onChange={(e) => { setOrigin(e.target.value as LeadOrigin); setSourceName(''); }}>
            <option value="OUTBOUND">Outbound: alguém da equipe trouxe</option>
            <option value="INBOUND">Inbound: veio de uma fonte da pipeline</option>
          </CustomSelect>
        </Field>
        <Field label={origin === 'INBOUND' ? 'Fonte' : 'Quem trouxe'} hint={origin === 'INBOUND' && options.length === 0 ? 'Esta pipeline não tem fonte. Conecte uma em Configurações das pipelines.' : 'Sem origem o lead não pode ser criado.'}>
          <CustomSelect className="select" value={effectiveSource} onChange={(e) => setSourceName(e.target.value)} disabled={options.length === 0}>
            <option value="">Selecione…</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </CustomSelect>
        </Field>
        <div className="form-grid">
          <Field label="Dono"><CustomSelect className="select" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Sem dono</option>{team.map((m) => <option key={m.id}>{m.name}</option>)}</CustomSelect></Field>
          <Field label="Valor estimado" hint={valueError ?? undefined}><input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Opcional" /></Field>
        </div>
        <Field label="Tags" hint="Separe por vírgula."><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
        <Field label="Mensagem ou observação"><textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
      </div>
    </SidePanel>
  );
}
