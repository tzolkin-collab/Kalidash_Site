import { useMemo, useState } from 'react';
import { ArrowRightCircle, Plus, RotateCcw, XCircle } from 'lucide-react';
import type { Lead, LeadOrigin } from '../domain';
import { formatDate } from '../lib/format';
import { newId, useStore } from '../lib/store';
import { usePaged } from '../lib/usePaged';
import { leadsStore } from '../mocks/leads';
import { pipelinesStore } from '../mocks/pipelines';
import { teamStore } from '../mocks/team';
import { Badge, EmptyState, Field, Page, PageHeader, Pagination, SampleBanner, SearchBox, SidePanel, Tabs } from '../components/ui';

type Status = Lead['status'];

const STATUS_TABS: { id: Status; label: string }[] = [
  { id: 'ACTIVE', label: 'Ativos' },
  { id: 'QUALIFIED', label: 'Qualificados' },
  { id: 'DISCARDED', label: 'Descartados' },
];

const stageName = (l: Lead) => (l.stageId.endsWith(':contato') ? 'Em contato' : 'Novos');

export default function Leads() {
  const [leads, setLeads] = useStore(leadsStore);
  const [pipelines] = useStore(pipelinesStore);
  const [team] = useStore(teamStore);

  const [status, setStatus] = useState<Status>('ACTIVE');
  const [search, setSearch] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [originFilter, setOriginFilter] = useState<'' | LeadOrigin>('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const pipelineName = (id: string) => pipelines.find((p) => p.id === id)?.name ?? id;
  const allTags = useMemo(() => [...new Set(leads.flatMap((l) => l.tags))].sort(), [leads]);

  const counts = useMemo(() => ({
    ACTIVE: leads.filter((l) => l.status === 'ACTIVE').length,
    QUALIFIED: leads.filter((l) => l.status === 'QUALIFIED').length,
    DISCARDED: leads.filter((l) => l.status === 'DISCARDED').length,
  }), [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (l.status !== status) return false;
      if (pipelineFilter && l.pipelineId !== pipelineFilter) return false;
      if (originFilter && l.origin !== originFilter) return false;
      if (tagFilter && !l.tags.includes(tagFilter)) return false;
      return !q || [l.name, l.email, l.sourceName].some((v) => v.toLowerCase().includes(q));
    });
  }, [leads, status, search, pipelineFilter, originFilter, tagFilter]);

  const paged = usePaged(filtered, 10);
  const selected = leads.find((l) => l.id === selectedId) ?? null;

  const setLeadStatus = (id: string, next: Status) => setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: next } : l)));

  const qualify = (l: Lead) => {
    setLeadStatus(l.id, 'QUALIFIED');
    setNotice(`${l.name} foi qualificado e agora é uma oportunidade em "${pipelineName(l.pipelineId)}", na etapa Qualificação.`);
    setSelectedId(null);
  };

  const discard = (l: Lead) => {
    setLeadStatus(l.id, 'DISCARDED');
    setSelectedId(null);
  };

  return (
    <Page>
      <PageHeader
        title="Leads"
        subtitle="Quem ainda não virou oportunidade. Todo lead nasce de uma fonte (inbound) ou de alguém da equipe (outbound)."
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
        <SearchBox value={search} onChange={setSearch} placeholder="Buscar por nome, e-mail ou fonte…" />
        <select className="select select-sm" value={pipelineFilter} onChange={(e) => setPipelineFilter(e.target.value)} aria-label="Filtrar por pipeline">
          <option value="">Todas as pipelines</option>
          {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="select select-sm" value={originFilter} onChange={(e) => setOriginFilter(e.target.value as '' | LeadOrigin)} aria-label="Filtrar por origem">
          <option value="">Inbound e outbound</option>
          <option value="INBOUND">Inbound (fonte)</option>
          <option value="OUTBOUND">Outbound (equipe)</option>
        </select>
        <select className="select select-sm" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} aria-label="Filtrar por tag">
          <option value="">Todas as tags</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Lead</th><th>Pipeline</th><th>Etapa</th><th>Origem</th><th>Tags</th><th>Entrou em</th><th style={{ width: '150px' }}></th></tr>
            </thead>
            <tbody>
              {paged.rows.map((l) => (
                <tr key={l.id} className="clickable" onClick={() => setSelectedId(l.id)}>
                  <td>
                    <div className="cell-stack">
                      <span className="cell-primary">{l.name}</span>
                      <span className="text-xs text-muted">{l.email}</span>
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
                  <td><div className="tag-row">{l.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div></td>
                  <td className="text-muted">{formatDate(l.createdAt)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      {l.status === 'ACTIVE' && (
                        <>
                          <button type="button" className="btn btn-sm" onClick={() => qualify(l)}><ArrowRightCircle size={13} /> Qualificar</button>
                          <button type="button" className="icon-btn" onClick={() => discard(l)} title="Descartar" aria-label={`Descartar ${l.name}`}><XCircle size={15} /></button>
                        </>
                      )}
                      {l.status === 'DISCARDED' && (
                        <button type="button" className="btn btn-sm" onClick={() => setLeadStatus(l.id, 'ACTIVE')}><RotateCcw size={13} /> Restaurar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7}><EmptyState title="Nenhum lead aqui">Ajuste os filtros ou clique em "Adicionar lead".</EmptyState></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onPage={paged.setPage} onPageSize={paged.setPageSize} />
      </div>

      {selected && (
        <SidePanel
          title={selected.name}
          subtitle={`${pipelineName(selected.pipelineId)} · ${stageName(selected)}`}
          onClose={() => setSelectedId(null)}
          footer={
            selected.status === 'ACTIVE' ? (
              <>
                <button type="button" className="btn btn-danger" onClick={() => discard(selected)}>Descartar</button>
                <button type="button" className="btn btn-solid" onClick={() => qualify(selected)}>Qualificar</button>
              </>
            ) : undefined
          }
        >
          <dl className="detail-list">
            <dt>E-mail</dt><dd>{selected.email}</dd>
            <dt>Telefone</dt><dd>{selected.phone ?? '—'}</dd>
            <dt>Origem</dt><dd>{selected.origin === 'INBOUND' ? `Inbound · ${selected.sourceName}` : `Outbound · trouxe ${selected.sourceName}`}</dd>
            <dt>Tags</dt><dd><div className="tag-row">{selected.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div></dd>
            <dt>Entrou em</dt><dd>{formatDate(selected.createdAt)}</dd>
          </dl>
          {selected.message && (
            <>
              <h3 className="section-title" style={{ marginTop: '20px' }}>Mensagem do formulário</h3>
              <p className="quote">{selected.message}</p>
            </>
          )}
        </SidePanel>
      )}

      {adding && (
        <AddLeadPanel
          onClose={() => setAdding(false)}
          onSave={(lead) => { setLeads((prev) => [lead, ...prev]); setAdding(false); setStatus('ACTIVE'); }}
          pipelines={pipelines}
          teamNames={team.map((m) => m.name)}
        />
      )}
    </Page>
  );
}

type AddProps = {
  onClose: () => void;
  onSave: (lead: Lead) => void;
  pipelines: ReturnType<typeof pipelinesStore.get>;
  teamNames: string[];
};

function AddLeadPanel({ onClose, onSave, pipelines, teamNames }: AddProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? '');
  const [origin, setOrigin] = useState<LeadOrigin>('OUTBOUND');
  const [sourceName, setSourceName] = useState('');
  const [tags, setTags] = useState('');
  const [message, setMessage] = useState('');

  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const sources = pipeline?.sources ?? [];
  const options = origin === 'INBOUND' ? sources.map((s) => s.name) : teamNames;

  // Sem origem o lead não pode ser criado (regra do domínio: origem obrigatória)
  const effectiveSource = options.includes(sourceName) ? sourceName : '';
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const valid = name.trim() !== '' && emailOk && effectiveSource !== '' && pipeline !== undefined;

  const save = () => {
    if (!valid) return;
    onSave({
      id: newId('l'), name: name.trim(), email: email.trim(), phone: phone.trim() || undefined,
      pipelineId, stageId: `${pipelineId}:novos`, origin, sourceName: effectiveSource,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean), message: message.trim() || undefined,
      status: 'ACTIVE', createdAt: new Date().toISOString(),
    });
  };

  return (
    <SidePanel
      title="Adicionar lead"
      subtitle="Todo lead precisa de uma origem: a fonte (inbound) ou quem da equipe o trouxe (outbound)."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!valid} onClick={save}>Adicionar</button></>}
    >
      <div className="form-stack">
        <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <div className="form-grid">
          <Field label="E-mail" hint={email && !emailOk ? 'Informe um e-mail válido.' : undefined}><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Telefone"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
        <Field label="Pipeline">
          <select className="select" value={pipelineId} onChange={(e) => setPipelineId(e.target.value)}>
            {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Origem">
          <select className="select" value={origin} onChange={(e) => { setOrigin(e.target.value as LeadOrigin); setSourceName(''); }}>
            <option value="OUTBOUND">Outbound: alguém da equipe trouxe</option>
            <option value="INBOUND">Inbound: veio de uma fonte da pipeline</option>
          </select>
        </Field>
        <Field
          label={origin === 'INBOUND' ? 'Fonte' : 'Quem trouxe'}
          hint={origin === 'INBOUND' && sources.length === 0 ? 'Esta pipeline não tem fonte. Conecte uma em Configurações das pipelines.' : undefined}
        >
          <select className="select" value={effectiveSource} onChange={(e) => setSourceName(e.target.value)} disabled={options.length === 0}>
            <option value="">Selecione…</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Tags" hint="Separe por vírgula."><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
        <Field label="Mensagem ou observação"><textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
      </div>
    </SidePanel>
  );
}
