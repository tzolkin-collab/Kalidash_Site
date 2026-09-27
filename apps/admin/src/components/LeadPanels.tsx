import { useState } from 'react';
import type { Lead } from '../domain';
import { moneyToInput, parseMoney } from '../lib/format';
import { useStore } from '../lib/store';
import { discardReasonsStore } from '../mocks/leads';
import { pipelinesStore } from '../mocks/pipelines';
import { teamStore } from '../mocks/team';
import { Field, SidePanel } from './ui';
import { CustomSelect } from '../components/ui';

/** Perguntas do Qualificar. Só aparece quando a pipeline exige valor ou dono e o lead ainda não tem. */
export function QualifyPanel({ lead, onClose, onConfirm }: { lead: Lead; onClose: () => void; onConfirm: (extra: { value?: number; owner?: string }) => void }) {
  const [pipelines] = useStore(pipelinesStore);
  const [team] = useStore(teamStore);
  const pipe = pipelines.find((p) => p.id === lead.pipelineId);
  const needsValue = pipe?.qualifyRequires.includes('value') ?? false;
  const needsOwner = pipe?.qualifyRequires.includes('owner') ?? false;

  const [value, setValue] = useState(lead.estimatedValue ? moneyToInput(lead.estimatedValue) : '');
  const [owner, setOwner] = useState(lead.owner ?? '');

  const parsed = value.trim() === '' ? undefined : parseMoney(value);
  const valueError = value.trim() !== '' && parsed === null ? 'Valor inválido. Use, por exemplo, 5000 ou 5.000,50.' : null;
  const ok = (!needsValue || (parsed !== undefined && parsed !== null && parsed > 0)) && (!needsOwner || owner !== '') && !valueError;

  return (
    <SidePanel
      title={`Qualificar ${lead.name}`}
      subtitle={`Cria a oportunidade na primeira etapa aberta de ${pipe?.name ?? 'a pipeline'} e leva as tarefas e o histórico junto.`}
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!ok} onClick={() => onConfirm({ value: parsed ?? undefined, owner: owner || undefined })}>Qualificar</button></>}
    >
      <div className="form-stack">
        <Field label={`Valor estimado${needsValue ? ' (obrigatório nesta pipeline)' : ''}`} hint={valueError ?? undefined}>
          <input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: 5000,00" autoFocus />
        </Field>
        <Field label={`Dono${needsOwner ? ' (obrigatório nesta pipeline)' : ''}`}>
          <CustomSelect className="select" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Sem dono</option>{team.map((m) => <option key={m.id}>{m.name}</option>)}</CustomSelect>
        </Field>
      </div>
    </SidePanel>
  );
}

export function DiscardPanel({ lead, onClose, onConfirm }: { lead: Lead; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reasons] = useStore(discardReasonsStore);
  const [reason, setReason] = useState(reasons[0] ?? '');
  const [note, setNote] = useState('');

  return (
    <SidePanel
      title={`Descartar ${lead.name}`}
      subtitle="Descartar não conta como oportunidade perdida. Dá para restaurar depois."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-danger" disabled={!reason} onClick={() => onConfirm(note.trim() ? `${reason} · ${note.trim()}` : reason)}>Descartar</button></>}
    >
      <div className="form-stack">
        <Field label="Motivo"><CustomSelect className="select" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus>{reasons.map((r) => <option key={r}>{r}</option>)}</CustomSelect></Field>
        <Field label="Observação" hint="Opcional."><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </SidePanel>
  );
}
