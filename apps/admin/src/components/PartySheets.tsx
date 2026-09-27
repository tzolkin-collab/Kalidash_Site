import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Plus, Trash2, UserPlus } from 'lucide-react';
import type { Company, Lifecycle, Person, Stakeholder } from '../domain';
import { formatCnpj, formatCpf, isValidCnpj, isValidCpf, stripDoc } from '../lib/documents';
import { editRecord, manualLifecycle, setArchived } from '../lib/edit';
import { emit } from '../lib/events';
import { formatDate } from '../lib/format';
import { logChange } from '../lib/history';
import { useCan } from '../lib/permissions';
import { newId, useStore } from '../lib/store';
import { useAllOpportunities } from '../lib/useAllOpportunities';
import { useViewSettings } from '../lib/viewSettings';
import { leadsStore } from '../mocks/leads';
import { companiesOf, companiesStore, contactTagsStore, peopleStore } from '../mocks/people';
import CustomFieldsSection from './CustomFieldsSection';
import { ContactListField, DocumentField, ReadOnlyField, SelectField, TagsField, TextField } from './fields';
import { HistoryTab, TasksTab } from './RecordTabs';
import RecordSheet from './RecordSheet';
import { Badge, LifecycleBadge } from './ui';
import { CustomSelect } from '../components/ui';

export type PartyRef = { kind: 'person' | 'company'; id: string } | null;

type HostProps = { open: PartyRef; onOpen: (ref: PartyRef) => void };

/** Abre a ficha da pessoa ou da empresa. Uma ficha pode abrir a outra (pessoa → empresa dela). */
export default function PartySheets({ open, onOpen }: HostProps) {
  if (!open) return null;
  return open.kind === 'person'
    ? <PersonSheet key={open.id} personId={open.id} onOpen={onOpen} />
    : <CompanySheet key={open.id} companyId={open.id} onOpen={onOpen} />;
}

const LGPD_BASES = ['Consentimento', 'Legítimo interesse', 'Execução de contrato', 'Obrigação legal'];
const SIZES = ['1 a 10', '11 a 50', '51 a 200', '201 a 1.000', 'Mais de 1.000'];

const emailKey = (v: string) => v.trim().toLowerCase();

/* ------------------------- ciclo de vida: ações manuais ------------------------- */

function LifecycleActions({ kind, id, lifecycle }: { kind: 'person' | 'company'; id: string; lifecycle: Lifecycle }) {
  const [prompt, setPrompt] = useState<null | 'inactive' | 'reactivate'>(null);
  const [reason, setReason] = useState('');

  const confirm = () => {
    if (!reason.trim()) return;
    if (prompt === 'inactive') manualLifecycle(kind, id, 'INACTIVE', { reason: reason.trim() });
    if (prompt === 'reactivate') manualLifecycle(kind, id, 'LEAD', { reason: reason.trim() });
    setPrompt(null);
    setReason('');
  };

  return (
    <div className="lifecycle-actions">
      {prompt ? (
        <div className="reason-prompt">
          <input className="input" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { e.stopPropagation(); setPrompt(null); } }} placeholder={prompt === 'inactive' ? 'Motivo para marcar como inativo' : 'Motivo para reativar'} aria-label="Motivo" />
          <button type="button" className="btn btn-sm btn-solid" disabled={!reason.trim()} onClick={confirm}>Confirmar</button>
          <button type="button" className="btn btn-sm" onClick={() => setPrompt(null)}>Cancelar</button>
        </div>
      ) : (
        <>
          {lifecycle !== 'CLIENT' && lifecycle !== 'INACTIVE' && (
            <button type="button" className="btn btn-sm" onClick={() => manualLifecycle(kind, id, 'CLIENT', { reason: 'Cliente de antes do sistema', legacy: true })}>Marcar como cliente (legado)</button>
          )}
          {lifecycle !== 'INACTIVE' && <button type="button" className="btn btn-sm" onClick={() => setPrompt('inactive')}>Marcar como inativo</button>}
          {lifecycle === 'INACTIVE' && <button type="button" className="btn btn-sm" onClick={() => setPrompt('reactivate')}>Reativar como lead</button>}
        </>
      )}
    </div>
  );
}

function LifecycleRow({ lifecycle, legacy, reason, kind, id }: { lifecycle: Lifecycle; legacy?: boolean; reason?: string; kind: 'person' | 'company'; id: string }) {
  return (
    <>
      <ReadOnlyField label="Ciclo de vida" hint="Resulta dos eventos do funil e do template da pipeline. Não se escolhe à mão.">
        <span className="tag-row"><LifecycleBadge value={lifecycle} />{legacy && <Badge tone="info">Cliente legado</Badge>}{lifecycle === 'INACTIVE' && reason && <span className="text-xs text-muted">{reason}</span>}</span>
      </ReadOnlyField>
      <div className="sheet-actions-row"><LifecycleActions kind={kind} id={id} lifecycle={lifecycle} /></div>
    </>
  );
}

/* --------------------------------- pessoa --------------------------------- */

function PersonSheet({ personId, onOpen }: { personId: string; onOpen: (ref: PartyRef) => void }) {
  const [people] = useStore(peopleStore);
  const [companies] = useStore(companiesStore);
  const [leads] = useStore(leadsStore);
  const [contactTags, setContactTags] = useStore(contactTagsStore);
  const { all: opps } = useAllOpportunities();
  const { settings, update } = useViewSettings();
  const can = useCan();
  const [tab, setTab] = useState('overview');

  const person = people.find((p) => p.id === personId);
  const myCompanies = useMemo(() => companiesOf(companies, personId), [companies, personId]);
  if (!person) return null;

  const ctx = { entity: 'person' as const, entityId: person.id, entityName: person.name, personId: person.id, companyId: myCompanies[0]?.id };
  const save = (patch: Partial<Person>, field: string, from: unknown, to: unknown, fieldKey?: string) =>
    editRecord(peopleStore, person.id, patch, { entity: 'person', entityName: person.name, field, from, to, fieldKey, ctx: { personId: person.id } });

  const others = people.filter((p) => p.id !== person.id && !p.archivedAt);
  const emailTaken = (v: string) => {
    const hit = others.find((p) => [p.email, ...p.extraEmails.map((e) => e.value)].some((e) => emailKey(e) === emailKey(v)));
    return hit ? `Este e-mail já é de ${hit.name}.` : null;
  };
  const cpfTaken = (v: string) => {
    const hit = others.find((p) => p.document && stripDoc(p.document) === stripDoc(v));
    return hit ? `Este CPF já é de ${hit.name}.` : null;
  };

  const myLeads = leads.filter((l) => l.personId === person.id || emailKey(l.email) === emailKey(person.email));
  const myOpps = opps.filter((o) => o.contactName === person.name);

  const setCustom = (key: string, label: string, from: unknown, to: unknown) => {
    const next = { ...(person.customData ?? {}) };
    if (to === undefined) delete next[key]; else next[key] = to;
    save({ customData: next }, label, from, to);
  };

  return (
    <RecordSheet
      mode={settings.openMode}
      fontSize={settings.fontSize}
      onClose={() => onOpen(null)}
      onSwitchMode={() => update({ openMode: settings.openMode === 'side' ? 'center' : 'side' })}
      title={person.name}
      onTitle={(v) => save({ name: v }, 'Nome', person.name, v)}
      badges={<><LifecycleBadge value={person.lifecycle} />{person.archivedAt && <Badge tone="danger">Arquivada</Badge>}</>}
      subtitle={person.role}
      tabs={[{ id: 'overview', label: 'Visão geral' }, { id: 'links', label: 'Vínculos', count: myLeads.length + myOpps.length }, { id: 'tasks', label: 'Tarefas' }, { id: 'history', label: 'Histórico' }]}
      tab={tab}
      onTab={setTab}
      footer={
        <button type="button" className="btn" onClick={() => setArchived(peopleStore, 'person', person.id, person.name, !person.archivedAt)}>
          {person.archivedAt ? <><ArchiveRestore size={14} /> Restaurar</> : <><Archive size={14} /> Arquivar</>}
        </button>
      }
    >
      {tab === 'overview' && (
        <>
          <div className="sheet-section">
            <h3 className="sheet-section-title">Contato</h3>
            <TextField label="E-mail" type="email" required value={person.email} validate={(v) => (/^\S+@\S+\.\S+$/.test(v) ? emailTaken(v) : 'Informe um e-mail válido.')} onCommit={(v) => save({ email: v }, 'E-mail', person.email, v, 'email')} />
            <TextField label="Telefone" type="tel" value={person.phone} onCommit={(v) => save({ phone: v }, 'Telefone', person.phone, v, 'telefone')} />
          </div>
          <div className="sheet-section">
            <h3 className="sheet-section-title">Outros contatos</h3>
            <ContactListField label="E-mails" kind="email" value={person.extraEmails} onCommit={(v) => save({ extraEmails: v }, 'Outros e-mails', person.extraEmails.map((e) => e.value), v.map((e) => e.value))} />
            <ContactListField label="Telefones" kind="phone" value={person.extraPhones} onCommit={(v) => save({ extraPhones: v }, 'Outros telefones', person.extraPhones.map((e) => e.value), v.map((e) => e.value))} />
          </div>
          <div className="sheet-section">
            <h3 className="sheet-section-title">Dados da pessoa</h3>
            <DocumentField
              label="CPF"
              kind="cpf"
              value={person.document ?? ''}
              placeholder="000.000.000-00"
              format={formatCpf}
              validate={(v) => (isValidCpf(v) ? cpfTaken(v) : 'CPF inválido.')}
              canReveal={can.revealCpf}
              onReveal={() => logChange({ entity: 'person', entityId: person.id, entityName: person.name, kind: 'reveal', field: 'CPF', note: 'CPF exibido inteiro na ficha' })}
              onCommit={(v) => save({ document: v || undefined }, 'CPF', person.document ? 'CPF anterior' : '', v ? 'CPF novo' : '', 'cpf')}
            />
            <TextField label="Cargo" value={person.role ?? ''} onCommit={(v) => save({ role: v || undefined }, 'Cargo', person.role, v)} />
            <SelectField label="Base legal (LGPD)" value={person.lgpdBasis ?? ''} empty="Não informada" options={LGPD_BASES.map((b) => ({ value: b, label: b }))} onCommit={(v) => save({ lgpdBasis: v || undefined, lgpdAt: v ? new Date().toISOString() : undefined }, 'Base legal', person.lgpdBasis, v)} />
            {person.lgpdAt && <ReadOnlyField label="Registrada em">{formatDate(person.lgpdAt)}</ReadOnlyField>}
          </div>
          <div className="sheet-section">
            <h3 className="sheet-section-title">Classificação</h3>
            <TagsField label="Tags" value={person.tags} options={contactTags} allowCreate onCreate={(t) => setContactTags((prev) => [...prev, t])} onCommit={(v) => save({ tags: v }, 'Tags', person.tags, v)} hint="As tags de contato são do time." />
            <LifecycleRow lifecycle={person.lifecycle} legacy={person.legacyClient} reason={person.inactiveReason} kind="person" id={person.id} />
          </div>
          <div className="sheet-section">
            <h3 className="sheet-section-title">Empresas</h3>
            {myCompanies.length === 0 && <p className="text-sm text-muted" style={{ margin: 0 }}>Pessoa física. Para ligar a uma empresa, adicione-a como stakeholder na ficha da empresa.</p>}
            {myCompanies.map((c) => {
              const s = c.stakeholders.find((x) => x.personId === person.id);
              return (
                <div key={c.id} className="relation-row">
                  <button type="button" className="link-inline" onClick={() => onOpen({ kind: 'company', id: c.id })}>{c.name}</button>
                  <span className="text-xs text-muted">{s?.description}</span>
                  {s && <Badge tone="accent">{s.tag}</Badge>}
                  {c.defaultContactId === person.id && <Badge tone="success">Contato padrão</Badge>}
                </div>
              );
            })}
          </div>
          <CustomFieldsSection entity="person" values={person.customData} onChange={(f, from, to) => setCustom(f.key, f.label, from, to)} />
        </>
      )}

      {tab === 'links' && (
        <div className="sheet-section">
          <h3 className="sheet-section-title">Leads</h3>
          {myLeads.length === 0 && <p className="text-sm text-muted">Nenhum lead.</p>}
          {myLeads.map((l) => <div key={l.id} className="relation-row"><span className="cell-primary">{l.name}</span><Badge>{l.status === 'ACTIVE' ? 'Ativo' : l.status === 'QUALIFIED' ? 'Qualificado' : 'Descartado'}</Badge>{l.returningClient && <Badge tone="info">Cliente retornando</Badge>}</div>)}
          <h3 className="sheet-section-title" style={{ marginTop: '20px' }}>Oportunidades</h3>
          {myOpps.length === 0 && <p className="text-sm text-muted">Nenhuma oportunidade.</p>}
          {myOpps.map((o) => <div key={o.id} className="relation-row"><span className="cell-primary">{o.title}</span><Badge>{o.stage}</Badge>{o.isSample && <Badge tone="warning">Exemplo</Badge>}</div>)}
        </div>
      )}
      {tab === 'tasks' && <TasksTab entity="person" id={person.id} name={person.name} ctx={ctx} />}
      {tab === 'history' && <HistoryTab entity="person" id={person.id} createdAt={person.createdAt} />}
    </RecordSheet>
  );
}

/* --------------------------------- empresa --------------------------------- */

function CompanySheet({ companyId, onOpen }: { companyId: string; onOpen: (ref: PartyRef) => void }) {
  const [companies] = useStore(companiesStore);
  const [leads] = useStore(leadsStore);
  const { all: opps } = useAllOpportunities();
  const { settings, update } = useViewSettings();
  const [tab, setTab] = useState('overview');

  const company = companies.find((c) => c.id === companyId);
  if (!company) return null;

  const inReview = !company.document;
  const ctx = { entity: 'company' as const, entityId: company.id, entityName: company.name, companyId: company.id, personId: company.defaultContactId };
  const save = (patch: Partial<Company>, field: string, from: unknown, to: unknown, fieldKey?: string) =>
    editRecord(companiesStore, company.id, patch, { entity: 'company', entityName: company.name, field, from, to, fieldKey, ctx: { companyId: company.id, personId: company.defaultContactId } });

  const cnpjTaken = (v: string) => {
    const hit = companies.find((c) => c.id !== company.id && !c.archivedAt && c.document && stripDoc(c.document) === stripDoc(v));
    return hit ? `Este CNPJ já é de ${hit.name}.` : null;
  };

  const myLeads = leads.filter((l) => l.companyId === company.id);
  const myOpps = opps.filter((o) => o.companyName === company.name);

  const setCustom = (key: string, label: string, from: unknown, to: unknown) => {
    const next = { ...(company.customData ?? {}) };
    if (to === undefined) delete next[key]; else next[key] = to;
    save({ customData: next }, label, from, to);
  };

  return (
    <RecordSheet
      mode={settings.openMode}
      fontSize={settings.fontSize}
      onClose={() => onOpen(null)}
      onSwitchMode={() => update({ openMode: settings.openMode === 'side' ? 'center' : 'side' })}
      title={company.name}
      onTitle={(v) => save({ name: v }, 'Nome', company.name, v)}
      badges={<><LifecycleBadge value={company.lifecycle} />{inReview ? <Badge tone="warning">Em análise</Badge> : <Badge tone="success">Cadastro completo</Badge>}{company.archivedAt && <Badge tone="danger">Arquivada</Badge>}</>}
      subtitle={company.segment}
      tabs={[{ id: 'overview', label: 'Visão geral' }, { id: 'links', label: 'Oportunidades e leads', count: myLeads.length + myOpps.length }, { id: 'tasks', label: 'Tarefas' }, { id: 'history', label: 'Histórico' }]}
      tab={tab}
      onTab={setTab}
      footer={
        <button type="button" className="btn" onClick={() => setArchived(companiesStore, 'company', company.id, company.name, !company.archivedAt)}>
          {company.archivedAt ? <><ArchiveRestore size={14} /> Restaurar</> : <><Archive size={14} /> Arquivar</>}
        </button>
      }
    >
      {tab === 'overview' && (
        <>
          {inReview && (
            <div className="task-callout" role="status" style={{ marginBottom: '16px' }}>
              <span>Em análise: falta o CNPJ. A tarefa "Informar CNPJ" segue aberta e impede a oportunidade de entrar em "Assinatura do contrato". Informar o CNPJ abaixo conclui a tarefa.</span>
            </div>
          )}
          <div className="sheet-section">
            <h3 className="sheet-section-title">Cadastro</h3>
            <TextField label="Razão social" value={company.legalName ?? ''} onCommit={(v) => save({ legalName: v || undefined }, 'Razão social', company.legalName, v)} />
            <DocumentField label="CNPJ" kind="cnpj" value={company.document ?? ''} placeholder="00.000.000/0000-00" format={formatCnpj} validate={(v) => (isValidCnpj(v) ? cnpjTaken(v) : 'CNPJ inválido. Confira os 14 caracteres e os dois dígitos finais.')} onCommit={(v) => save({ document: v || undefined, status: v ? 'ACTIVE' : 'REVIEW' }, 'CNPJ', company.document, v, 'cnpj')} />
            <TextField label="Segmento" value={company.segment === '—' ? '' : company.segment} onCommit={(v) => save({ segment: v || '—' }, 'Segmento', company.segment, v)} />
            <SelectField label="Porte" value={company.sizeRange ?? ''} empty="Não informado" options={SIZES.map((s) => ({ value: s, label: `${s} pessoas` }))} onCommit={(v) => save({ sizeRange: v || undefined }, 'Porte', company.sizeRange, v)} />
            <TextField label="Site" type="url" value={company.website ?? ''} validate={(v) => (/^https?:\/\/\S+\.\S+/.test(v) ? null : 'Use o endereço completo, com https://')} onCommit={(v) => save({ website: v || undefined }, 'Site', company.website, v)} />
            <TextField label="Cidade" value={company.city ?? ''} onCommit={(v) => save({ city: v || undefined }, 'Cidade', company.city, v)} />
            <TextField label="UF" value={company.state ?? ''} format={(v) => v.toUpperCase().slice(0, 2)} validate={(v) => (/^[A-Z]{2}$/.test(v) ? null : 'Use a sigla com duas letras.')} onCommit={(v) => save({ state: v || undefined }, 'UF', company.state, v)} />
            <LifecycleRow lifecycle={company.lifecycle} legacy={company.legacyClient} reason={company.inactiveReason} kind="company" id={company.id} />
          </div>
          <StakeholdersField company={company} onOpenPerson={(id) => onOpen({ kind: 'person', id })} />
          <CustomFieldsSection entity="company" values={company.customData} onChange={(f, from, to) => setCustom(f.key, f.label, from, to)} />
        </>
      )}

      {tab === 'links' && (
        <div className="sheet-section">
          <h3 className="sheet-section-title">Leads</h3>
          {myLeads.length === 0 && <p className="text-sm text-muted">Nenhum lead.</p>}
          {myLeads.map((l) => <div key={l.id} className="relation-row"><span className="cell-primary">{l.name}</span><Badge>{l.status === 'ACTIVE' ? 'Ativo' : l.status === 'QUALIFIED' ? 'Qualificado' : 'Descartado'}</Badge></div>)}
          <h3 className="sheet-section-title" style={{ marginTop: '20px' }}>Oportunidades</h3>
          {myOpps.length === 0 && <p className="text-sm text-muted">Nenhuma oportunidade.</p>}
          {myOpps.map((o) => <div key={o.id} className="relation-row"><span className="cell-primary">{o.title}</span><Badge>{o.stage}</Badge>{o.isSample && <Badge tone="warning">Exemplo</Badge>}</div>)}
        </div>
      )}
      {tab === 'tasks' && <TasksTab entity="company" id={company.id} name={company.name} ctx={ctx} />}
      {tab === 'history' && <HistoryTab entity="company" id={company.id} createdAt={company.createdAt} />}
    </RecordSheet>
  );
}

/* ------------------- stakeholders: campo de relação da empresa ------------------- */

function StakeholdersField({ company, onOpenPerson }: { company: Company; onOpenPerson: (id: string) => void }) {
  const [people, setPeople] = useStore(peopleStore);
  const [tags, setTags] = useStore(contactTagsStore);
  const [mode, setMode] = useState<'closed' | 'existing' | 'new'>('closed');
  const [personId, setPersonId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('Stakeholder');

  const byId = new Map(people.map((p) => [p.id, p]));
  const names = (list: Stakeholder[]) => list.map((s) => byId.get(s.personId)?.name ?? s.personId);
  const available = people.filter((p) => !p.archivedAt && !company.stakeholders.some((s) => s.personId === p.id));

  const write = (stakeholders: Stakeholder[], defaultContactId: string | undefined, field: string) =>
    editRecord(companiesStore, company.id, { stakeholders, defaultContactId }, { entity: 'company', entityName: company.name, field, from: names(company.stakeholders), to: names(stakeholders) });

  const patchOne = (id: string, change: Partial<Stakeholder>) => write(company.stakeholders.map((s) => (s.personId === id ? { ...s, ...change } : s)), company.defaultContactId, 'Stakeholders');
  const remove = (id: string) => {
    const next = company.stakeholders.filter((s) => s.personId !== id);
    write(next, company.defaultContactId === id ? next[0]?.personId : company.defaultContactId, 'Stakeholders');
  };

  const reset = () => { setMode('closed'); setPersonId(''); setName(''); setEmail(''); setDescription(''); setTag('Stakeholder'); };
  const emailTaken = people.find((p) => emailKey(p.email) === emailKey(email));
  const canAdd = mode === 'existing' ? personId !== '' : name.trim() !== '' && /^\S+@\S+\.\S+$/.test(email) && !emailTaken;

  const add = () => {
    if (!canAdd) return;
    let id = personId;
    if (mode === 'new') {
      id = newId('p');
      const now = new Date().toISOString();
      setPeople((prev) => [{ id, name: name.trim(), email: email.trim(), phone: '', extraEmails: [], extraPhones: [], tags: [], lifecycle: 'LEAD', createdAt: now }, ...prev]);
      logChange({ entity: 'person', entityId: id, entityName: name.trim(), kind: 'create', note: `Criada pela ficha de ${company.name}` });
      emit('pessoa.criada', { entity: 'person', entityId: id, entityName: name.trim(), personId: id, companyId: company.id });
    }
    const cleanTag = tag.trim();
    if (!tags.includes(cleanTag)) setTags((prev) => [...prev, cleanTag]);
    const next = [...company.stakeholders, { personId: id, description: description.trim(), tag: cleanTag }];
    write(next, company.defaultContactId ?? id, 'Stakeholders');
    reset();
  };

  return (
    <div className="sheet-section">
      <h3 className="sheet-section-title">Stakeholders <span className="tab-count">{company.stakeholders.length}</span></h3>
      <p className="text-xs text-muted" style={{ margin: '0 0 10px' }}>Todas as pessoas cadastradas nesta empresa, com a função de cada uma. A oportunidade puxa o contato padrão e deixa trocar e escolher quem recebe e-mails e reuniões.</p>
      {company.stakeholders.length === 0 && <p className="text-sm text-muted">Nenhum stakeholder ainda.</p>}
      <ul className="stake-list">
        {company.stakeholders.map((s) => {
          const p = byId.get(s.personId);
          return (
            <li key={s.personId} className="stake-item stake-edit">
              <label className="stake-default" title="Contato padrão">
                <input type="radio" name={`default-${company.id}`} checked={company.defaultContactId === s.personId} onChange={() => write(company.stakeholders, s.personId, 'Contato padrão')} />
              </label>
              <div className="cell-stack">
                <button type="button" className="link-inline" onClick={() => onOpenPerson(s.personId)}>{p?.name ?? s.personId}</button>
                <input key={s.description} className="inline-input stake-desc" defaultValue={s.description} placeholder="Descrição (o que faz aqui)" onBlur={(e) => { if (e.target.value.trim() !== s.description) patchOne(s.personId, { description: e.target.value.trim() }); }} aria-label="Descrição" />
              </div>
              <CustomSelect className="inline-select" value={s.tag} onChange={(e) => patchOne(s.personId, { tag: e.target.value })} aria-label="Tag da função">
                {(tags.includes(s.tag) ? tags : [...tags, s.tag]).map((t) => <option key={t}>{t}</option>)}
              </CustomSelect>
              <button type="button" className="icon-btn bare" onClick={() => remove(s.personId)} aria-label={`Remover ${p?.name ?? ''}`}><Trash2 size={14} /></button>
            </li>
          );
        })}
      </ul>

      {mode === 'closed' ? (
        <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="btn btn-sm" onClick={() => setMode('existing')}><Plus size={12} /> Vincular pessoa</button>
          <button type="button" className="btn btn-sm" onClick={() => setMode('new')}><UserPlus size={12} /> Nova pessoa</button>
        </div>
      ) : (
        <div className="stake-add">
          {mode === 'existing' ? (
            <CustomSelect className="select" value={personId} onChange={(e) => setPersonId(e.target.value)} aria-label="Pessoa">
              <option value="">Escolha uma pessoa…</option>
              {available.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
            </CustomSelect>
          ) : (
            <>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" aria-label="Nome" />
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" aria-label="E-mail" />
              {emailTaken && <div className="field-error">Este e-mail já é de {emailTaken.name}. Use "Vincular pessoa".</div>}
            </>
          )}
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (o que faz aqui)" />
          <input className="input" list="stake-tags" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag da função (escolha ou crie)" aria-label="Tag da função" />
          <datalist id="stake-tags">{tags.map((t) => <option key={t} value={t} />)}</datalist>
          <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="btn btn-sm btn-solid" disabled={!canAdd || tag.trim() === ''} onClick={add}>Adicionar</button>
            <button type="button" className="btn btn-sm" onClick={reset}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
