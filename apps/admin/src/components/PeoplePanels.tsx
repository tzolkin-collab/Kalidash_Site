import { useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import type { Company, Lifecycle, Person } from '../domain';
import { formatCnpj, formatCpf, isValidCnpj, isValidCpf, stripDoc } from '../lib/documents';
import { newId, useStore } from '../lib/store';
import { companiesStore, peopleStore } from '../mocks/people';
import { LIFECYCLE_LABEL } from '../lib/people';
import { Badge, Field, SidePanel } from './ui';


const tagsToList = (raw: string) => raw.split(',').map((t) => t.trim()).filter(Boolean);
const lifecycleOptions = (Object.keys(LIFECYCLE_LABEL) as Lifecycle[]).map((k) => <option key={k} value={k}>{LIFECYCLE_LABEL[k]}</option>);

/** Deduplicação: e-mail e documento não se repetem entre pessoas. */
function personConflict(people: Person[], candidate: { email: string; document?: string }, ignoreId?: string): string | null {
  const email = candidate.email.trim().toLowerCase();
  const doc = candidate.document ? stripDoc(candidate.document) : '';
  for (const p of people) {
    if (p.id === ignoreId) continue;
    if (email && p.email.toLowerCase() === email) return `Já existe uma pessoa com este e-mail (${p.name}).`;
    if (doc && p.document && stripDoc(p.document) === doc) return `Já existe uma pessoa com este CPF (${p.name}).`;
  }
  return null;
}

function companyConflict(companies: Company[], document: string | undefined, ignoreId?: string): string | null {
  const doc = document ? stripDoc(document) : '';
  if (!doc) return null;
  const hit = companies.find((c) => c.id !== ignoreId && c.document && stripDoc(c.document) === doc);
  return hit ? `Já existe uma empresa com este CNPJ (${hit.name}).` : null;
}

/* ------------------------------ Pessoa ------------------------------ */

export function PersonPanel({ personId, onClose }: { personId: string; onClose: () => void }) {
  const [people, setPeople] = useStore(peopleStore);
  const [companies] = useStore(companiesStore);
  const person = people.find((p) => p.id === personId);
  if (!person) return null;
  return <PersonForm key={person.id} person={person} people={people} companies={companies} onSave={(next) => { setPeople((prev) => prev.map((p) => (p.id === next.id ? next : p))); onClose(); }} onClose={onClose} />;
}

type PersonFormProps = { person: Person; people: Person[]; companies: Company[]; onSave: (p: Person) => void; onClose: () => void };

function PersonForm({ person, people, companies, onSave, onClose }: PersonFormProps) {
  const [name, setName] = useState(person.name);
  const [email, setEmail] = useState(person.email);
  const [phone, setPhone] = useState(person.phone);
  const [document, setDocument] = useState(person.document ?? '');
  const [role, setRole] = useState(person.role ?? '');
  const [companyId, setCompanyId] = useState(person.companyId ?? '');
  const [tags, setTags] = useState(person.tags.join(', '));
  const [lifecycle, setLifecycle] = useState<Lifecycle>(person.lifecycle);

  const cpfError = document && !isValidCpf(document) ? 'CPF inválido.' : null;
  const conflict = personConflict(people, { email, document }, person.id);
  const error = cpfError ?? conflict;
  const valid = name.trim() !== '' && /^\S+@\S+\.\S+$/.test(email) && !error;

  return (
    <SidePanel
      title={person.name}
      subtitle="Pessoa"
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!valid} onClick={() => onSave({ ...person, name: name.trim(), email: email.trim(), phone, document: document || undefined, role: role || undefined, companyId: companyId || undefined, tags: tagsToList(tags), lifecycle })}>Salvar</button></>}
    >
      <div className="form-stack">
        <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="form-grid">
          <Field label="E-mail"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Telefone"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="CPF" hint="Opcional para pessoas ligadas a uma empresa."><input className="input mono" value={document} onChange={(e) => setDocument(formatCpf(e.target.value))} placeholder="000.000.000-00" /></Field>
          <Field label="Cargo"><input className="input" value={role} onChange={(e) => setRole(e.target.value)} /></Field>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <Field label="Empresa">
          <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Nenhuma (pessoa física)</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Ciclo de vida"><select className="select" value={lifecycle} onChange={(e) => setLifecycle(e.target.value as Lifecycle)}>{lifecycleOptions}</select></Field>
        <Field label="Tags" hint="Separe por vírgula. Ex.: Decisor, Financeiro."><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
      </div>
    </SidePanel>
  );
}

/* ------------------------------ Empresa ------------------------------ */

export function CompanyPanel({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [companies, setCompanies] = useStore(companiesStore);
  const [people] = useStore(peopleStore);
  const company = companies.find((c) => c.id === companyId);
  if (!company) return null;
  return <CompanyForm key={company.id} company={company} companies={companies} people={people} onSave={(next) => { setCompanies((prev) => prev.map((c) => (c.id === next.id ? next : c))); onClose(); }} onClose={onClose} />;
}

type CompanyFormProps = { company: Company; companies: Company[]; people: Person[]; onSave: (c: Company) => void; onClose: () => void };

function CompanyForm({ company, companies, people, onSave, onClose }: CompanyFormProps) {
  const [name, setName] = useState(company.name);
  const [document, setDocument] = useState(company.document ?? '');
  const [segment, setSegment] = useState(company.segment);
  const [lifecycle, setLifecycle] = useState<Lifecycle>(company.lifecycle);
  const [stakeholders, setStakeholders] = useState(company.stakeholders);
  const [defaultContactId, setDefaultContactId] = useState(company.defaultContactId ?? '');
  const [newPerson, setNewPerson] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTag, setNewTag] = useState('');

  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const docError = document && !isValidCnpj(document) ? 'CNPJ inválido. Confira os 14 caracteres e os dois dígitos finais.' : companyConflict(companies, document, company.id);
  const inReview = !document || !isValidCnpj(document);
  const valid = name.trim() !== '' && !docError;
  const available = people.filter((p) => !stakeholders.some((s) => s.personId === p.id));

  const addStakeholder = () => {
    if (!newPerson) return;
    setStakeholders((prev) => [...prev, { personId: newPerson, description: newDescription.trim(), tag: newTag.trim() || 'Stakeholder' }]);
    if (!defaultContactId) setDefaultContactId(newPerson);
    setNewPerson('');
    setNewDescription('');
    setNewTag('');
  };

  const removeStakeholder = (id: string) => {
    setStakeholders((prev) => prev.filter((s) => s.personId !== id));
    if (defaultContactId === id) setDefaultContactId('');
  };

  return (
    <SidePanel
      title={company.name}
      subtitle="Empresa"
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!valid} onClick={() => onSave({ ...company, name: name.trim(), document: document ? formatCnpj(document) : undefined, status: inReview ? 'REVIEW' : 'ACTIVE', segment, lifecycle, stakeholders, defaultContactId: defaultContactId || undefined })}>Salvar</button></>}
    >
      <div className="form-stack">
        {inReview && (
          <div className="task-callout" role="status">
            <AlertTriangle size={16} />
            <div>
              <strong>Em análise: falta o CNPJ.</strong>
              <div className="text-xs">A tarefa "Informar CNPJ" segue aberta e impede a oportunidade de entrar em "Assinatura do contrato".</div>
            </div>
          </div>
        )}
        <Field label="Razão social ou nome fantasia"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="form-grid">
          <Field label="CNPJ" hint="Aceita CNPJ numérico e alfanumérico."><input className="input mono" value={document} onChange={(e) => setDocument(formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" /></Field>
          <Field label="Segmento"><input className="input" value={segment} onChange={(e) => setSegment(e.target.value)} /></Field>
        </div>
        {docError && <div className="form-error" role="alert">{docError}</div>}
        <Field label="Ciclo de vida"><select className="select" value={lifecycle} onChange={(e) => setLifecycle(e.target.value as Lifecycle)}>{lifecycleOptions}</select></Field>

        <div>
          <h3 className="section-title">Stakeholders</h3>
          <p className="section-sub">Pessoas ligadas a esta empresa, cada uma com uma descrição e uma tag da função. Só uma é o contato padrão.</p>
          {stakeholders.length === 0 && <p className="text-muted text-sm">Ninguém ainda.</p>}
          <ul className="stake-list">
            {stakeholders.map((s) => (
              <li key={s.personId} className="stake-item">
                <label className="stake-default" title="Contato padrão">
                  <input type="radio" name="default-contact" checked={defaultContactId === s.personId} onChange={() => setDefaultContactId(s.personId)} />
                </label>
                <div className="cell-stack">
                  <span className="cell-primary">{personName(s.personId)}</span>
                  <span className="text-xs text-muted">{s.description || 'Sem descrição'}</span>
                </div>
                <Badge tone="accent">{s.tag}</Badge>
                <button type="button" className="icon-btn bare" onClick={() => removeStakeholder(s.personId)} aria-label={`Remover ${personName(s.personId)}`}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
          <div className="stake-add">
            <select className="select" value={newPerson} onChange={(e) => setNewPerson(e.target.value)} aria-label="Pessoa">
              <option value="">Adicionar pessoa…</option>
              {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className="input" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Descrição (o que ela faz aqui)" />
            <input className="input" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Tag da função" />
            <button type="button" className="btn" onClick={addStakeholder} disabled={!newPerson}><Plus size={14} /> Adicionar</button>
          </div>
        </div>
      </div>
    </SidePanel>
  );
}

/* ------------------------------ Cadastro novo ------------------------------ */

type NewProps = { onClose: () => void; onCreated?: (message: string) => void };

/** Cadastro por tipo de cliente. CNPJ cria a empresa e liga a pessoa como stakeholder padrão. */
export function NewPersonPanel({ onClose, onCreated }: NewProps) {
  const [people, setPeople] = useStore(peopleStore);
  const [companies, setCompanies] = useStore(companiesStore);
  const [kind, setKind] = useState<'PERSON' | 'COMPANY'>('PERSON');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [role, setRole] = useState('');

  const cpfError = kind === 'PERSON' && cpf && !isValidCpf(cpf) ? 'CPF inválido.' : null;
  const cnpjError = kind === 'COMPANY' && cnpj && !isValidCnpj(cnpj) ? 'CNPJ inválido.' : null;
  const conflict = personConflict(people, { email, document: kind === 'PERSON' ? cpf : undefined }) ?? (kind === 'COMPANY' ? companyConflict(companies, cnpj) : null);
  const error = cpfError ?? cnpjError ?? conflict;
  const valid = name.trim() !== '' && /^\S+@\S+\.\S+$/.test(email) && (kind === 'PERSON' || companyName.trim() !== '') && !error;

  const save = () => {
    if (!valid) return;
    const now = new Date().toISOString();
    const personId = newId('p');
    if (kind === 'PERSON') {
      setPeople((prev) => [{ id: personId, name: name.trim(), email: email.trim(), phone, document: cpf || undefined, tags: [], lifecycle: 'LEAD', createdAt: now }, ...prev]);
      onCreated?.(`${name.trim()} foi cadastrada como pessoa.`);
    } else {
      const companyId = newId('c');
      const hasCnpj = cnpj !== '' && isValidCnpj(cnpj);
      setCompanies((prev) => [{ id: companyId, name: companyName.trim(), document: hasCnpj ? cnpj : undefined, status: hasCnpj ? 'ACTIVE' : 'REVIEW', defaultContactId: personId, stakeholders: [{ personId, description: role || 'Contato padrão', tag: 'Contato padrão' }], lifecycle: 'LEAD', segment: '—', createdAt: now }, ...prev]);
      setPeople((prev) => [{ id: personId, name: name.trim(), email: email.trim(), phone, companyId, role: role || undefined, tags: ['Contato padrão'], lifecycle: 'LEAD', createdAt: now }, ...prev]);
      onCreated?.(hasCnpj ? `${companyName.trim()} foi criada e ${name.trim()} é o contato padrão.` : `${companyName.trim()} foi criada em análise: falta o CNPJ. A tarefa "Informar CNPJ" ficou aberta.`);
    }
    onClose();
  };

  return (
    <SidePanel
      title="Nova pessoa"
      subtitle="Escolha o tipo de cliente. Com CNPJ, o sistema cria a empresa e liga esta pessoa a ela."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!valid} onClick={save}>Cadastrar</button></>}
    >
      <div className="form-stack">
        <Field label="Tipo de cliente">
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value as 'PERSON' | 'COMPANY')}>
            <option value="PERSON">Pessoa (CPF)</option>
            <option value="COMPANY">Empresa (CNPJ)</option>
          </select>
        </Field>
        <Field label="Nome da pessoa"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <div className="form-grid">
          <Field label="E-mail"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Telefone"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
        {kind === 'PERSON' ? (
          <Field label="CPF" hint="Opcional agora; dá para completar depois."><input className="input mono" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" /></Field>
        ) : (
          <>
            <Field label="Nome da empresa"><input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></Field>
            <div className="form-grid">
              <Field label="CNPJ" hint="Sem CNPJ a empresa fica em análise."><input className="input mono" value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" /></Field>
              <Field label="Cargo da pessoa"><input className="input" value={role} onChange={(e) => setRole(e.target.value)} /></Field>
            </div>
          </>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </SidePanel>
  );
}

export function NewCompanyPanel({ onClose, onCreated }: NewProps) {
  const [companies, setCompanies] = useStore(companiesStore);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [segment, setSegment] = useState('');

  const cnpjError = cnpj && !isValidCnpj(cnpj) ? 'CNPJ inválido.' : companyConflict(companies, cnpj);
  const valid = name.trim() !== '' && !cnpjError;

  const save = () => {
    if (!valid) return;
    const hasCnpj = cnpj !== '' && isValidCnpj(cnpj);
    setCompanies((prev) => [{ id: newId('c'), name: name.trim(), document: hasCnpj ? cnpj : undefined, status: hasCnpj ? 'ACTIVE' : 'REVIEW', stakeholders: [], lifecycle: 'LEAD', segment: segment || '—', createdAt: new Date().toISOString() }, ...prev]);
    onCreated?.(hasCnpj ? `${name.trim()} foi cadastrada.` : `${name.trim()} foi cadastrada em análise: falta o CNPJ.`);
    onClose();
  };

  return (
    <SidePanel
      title="Nova empresa"
      subtitle="Para cadastrar a empresa de fato é preciso o CNPJ. Sem ele ela fica em análise."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!valid} onClick={save}>Cadastrar</button></>}
    >
      <div className="form-stack">
        <Field label="Razão social ou nome fantasia"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <div className="form-grid">
          <Field label="CNPJ"><input className="input mono" value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" /></Field>
          <Field label="Segmento"><input className="input" value={segment} onChange={(e) => setSegment(e.target.value)} /></Field>
        </div>
        {cnpjError && <div className="form-error" role="alert">{cnpjError}</div>}
      </div>
    </SidePanel>
  );
}
