import { useState } from 'react';
import { manualLifecycle } from '../lib/edit';
import { formatCnpj, formatCpf, isValidCnpj, isValidCpf, stripDoc } from '../lib/documents';
import { emit } from '../lib/events';
import { logChange } from '../lib/history';
import { newId, useStore } from '../lib/store';
import { companiesStore, peopleStore } from '../mocks/people';
import type { PartyRef } from './PartySheets';
import { Field, SidePanel } from './ui';
import { CustomSelect } from '../components/ui';

type Props = {
  onClose: () => void;
  /** Depois de criar: abre a ficha do que nasceu e mostra o aviso. */
  onCreated: (ref: NonNullable<PartyRef>, message: string) => void;
  /** Cliente de antes do sistema: já nasce marcado como Cliente. */
  asLegacy?: boolean;
};

const LEGACY_REASON = 'Cliente de antes do sistema';

function LegacyCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <strong>Cliente de antes do sistema</strong>
        <span className="text-xs text-muted" style={{ display: 'block' }}>Marca como Cliente direto, sem passar pelo funil. Fica registrado no histórico.</span>
      </span>
    </label>
  );
}

/** Cadastro curto de pessoa. Escolhendo empresa (CNPJ), cria a empresa junto e liga a pessoa como contato padrão. */
export function NewPersonPanel({ onClose, onCreated, asLegacy = false }: Props) {
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
  const [legacy, setLegacy] = useState(asLegacy);

  const emailHit = people.find((p) => !p.archivedAt && [p.email, ...p.extraEmails.map((x) => x.value)].some((x) => x.toLowerCase() === email.trim().toLowerCase()));
  const cpfHit = kind === 'PERSON' && cpf ? people.find((p) => !p.archivedAt && p.document && stripDoc(p.document) === stripDoc(cpf)) : undefined;
  const cnpjHit = kind === 'COMPANY' && cnpj ? companies.find((c) => !c.archivedAt && c.document && stripDoc(c.document) === stripDoc(cnpj)) : undefined;
  const cpfError = kind === 'PERSON' && cpf && !isValidCpf(cpf) ? 'CPF inválido.' : null;
  const cnpjError = kind === 'COMPANY' && cnpj && !isValidCnpj(cnpj) ? 'CNPJ inválido.' : null;
  const existing: NonNullable<PartyRef> | null = emailHit ? { kind: 'person', id: emailHit.id } : cpfHit ? { kind: 'person', id: cpfHit.id } : cnpjHit ? { kind: 'company', id: cnpjHit.id } : null;
  const conflict = emailHit ? `Já existe uma pessoa com este e-mail: ${emailHit.name}.` : cpfHit ? `Já existe uma pessoa com este CPF: ${cpfHit.name}.` : cnpjHit ? `Já existe uma empresa com este CNPJ: ${cnpjHit.name}.` : null;
  const error = cpfError ?? cnpjError ?? conflict;
  const valid = name.trim() !== '' && /^\S+@\S+\.\S+$/.test(email) && (kind === 'PERSON' || companyName.trim() !== '') && !error;

  const save = () => {
    if (!valid) return;
    const now = new Date().toISOString();
    const personId = newId('p');
    const base = { id: personId, name: name.trim(), email: email.trim(), phone, extraEmails: [], extraPhones: [], role: role || undefined, tags: [] as string[], lifecycle: 'LEAD' as const, createdAt: now };

    if (kind === 'PERSON') {
      setPeople((prev) => [{ ...base, document: cpf || undefined, role: undefined }, ...prev]);
      logChange({ entity: 'person', entityId: personId, entityName: base.name, kind: 'create', note: 'Cadastro manual' });
      emit('pessoa.criada', { entity: 'person', entityId: personId, entityName: base.name, personId });
      if (legacy) manualLifecycle('person', personId, 'CLIENT', { reason: LEGACY_REASON, legacy: true });
      onCreated({ kind: 'person', id: personId }, `${base.name} foi cadastrada como pessoa.`);
      return;
    }

    const companyId = newId('c');
    const hasCnpj = cnpj !== '' && isValidCnpj(cnpj);
    setCompanies((prev) => [{ id: companyId, name: companyName.trim(), document: hasCnpj ? cnpj : undefined, status: hasCnpj ? 'ACTIVE' : 'REVIEW', defaultContactId: personId, stakeholders: [{ personId, description: role || 'Contato padrão', tag: 'Contato padrão' }], lifecycle: 'LEAD', segment: '—', createdAt: now }, ...prev]);
    setPeople((prev) => [{ ...base, tags: ['Contato padrão'] }, ...prev]);
    logChange({ entity: 'company', entityId: companyId, entityName: companyName.trim(), kind: 'create', note: `Criada junto de ${base.name}` });
    logChange({ entity: 'person', entityId: personId, entityName: base.name, kind: 'create', note: `Contato padrão de ${companyName.trim()}` });
    emit('pessoa.criada', { entity: 'person', entityId: personId, entityName: base.name, personId, companyId });
    emit('empresa.criada', { entity: 'company', entityId: companyId, entityName: companyName.trim(), companyId, personId });
    if (legacy) manualLifecycle('company', companyId, 'CLIENT', { reason: LEGACY_REASON, legacy: true });
    onCreated({ kind: 'company', id: companyId }, hasCnpj ? `${companyName.trim()} foi criada e ${base.name} é o contato padrão.` : `${companyName.trim()} foi criada em análise: falta o CNPJ. A tarefa "Informar CNPJ" ficou aberta.`);
  };

  return (
    <SidePanel
      title={asLegacy ? 'Adicionar cliente existente' : 'Nova pessoa'}
      subtitle="Cadastro curto. O resto se completa na ficha. Com CNPJ, o sistema cria a empresa e liga esta pessoa a ela."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!valid} onClick={save}>Cadastrar</button></>}
    >
      <div className="form-stack">
        <Field label="Tipo de cliente">
          <CustomSelect className="select" value={kind} onChange={(e) => setKind(e.target.value as 'PERSON' | 'COMPANY')}>
            <option value="PERSON">Pessoa (CPF)</option>
            <option value="COMPANY">Empresa (CNPJ)</option>
          </CustomSelect>
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
        <LegacyCheck checked={legacy} onChange={setLegacy} />
        {error && (
          <div className="form-error" role="alert">
            {error}
            {existing && <> <button type="button" className="link-inline" onClick={() => { onCreated(existing, 'Abrindo o cadastro que já existe.'); }}>Abrir a ficha</button></>}
          </div>
        )}
      </div>
    </SidePanel>
  );
}

export function NewCompanyPanel({ onClose, onCreated, asLegacy = false }: Props) {
  const [companies, setCompanies] = useStore(companiesStore);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [segment, setSegment] = useState('');
  const [legacy, setLegacy] = useState(asLegacy);

  const hit = cnpj ? companies.find((c) => !c.archivedAt && c.document && stripDoc(c.document) === stripDoc(cnpj)) : undefined;
  const cnpjError = cnpj && !isValidCnpj(cnpj) ? 'CNPJ inválido.' : hit ? `Já existe uma empresa com este CNPJ: ${hit.name}.` : null;
  const valid = name.trim() !== '' && !cnpjError;

  const save = () => {
    if (!valid) return;
    const id = newId('c');
    const hasCnpj = cnpj !== '' && isValidCnpj(cnpj);
    setCompanies((prev) => [{ id, name: name.trim(), document: hasCnpj ? cnpj : undefined, status: hasCnpj ? 'ACTIVE' : 'REVIEW', stakeholders: [], lifecycle: 'LEAD', segment: segment || '—', createdAt: new Date().toISOString() }, ...prev]);
    logChange({ entity: 'company', entityId: id, entityName: name.trim(), kind: 'create', note: 'Cadastro manual' });
    emit('empresa.criada', { entity: 'company', entityId: id, entityName: name.trim(), companyId: id });
    if (legacy) manualLifecycle('company', id, 'CLIENT', { reason: LEGACY_REASON, legacy: true });
    onCreated({ kind: 'company', id }, hasCnpj ? `${name.trim()} foi cadastrada.` : `${name.trim()} foi cadastrada em análise: falta o CNPJ.`);
  };

  return (
    <SidePanel
      title={asLegacy ? 'Adicionar empresa cliente' : 'Nova empresa'}
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
        <LegacyCheck checked={legacy} onChange={setLegacy} />
        {cnpjError && <div className="form-error" role="alert">{cnpjError}{hit && <> <button type="button" className="link-inline" onClick={() => onCreated({ kind: 'company', id: hit.id }, 'Abrindo o cadastro que já existe.')}>Abrir a ficha</button></>}</div>}
      </div>
    </SidePanel>
  );
}
