import { useState } from 'react';
import type { Lead } from '../domain';
import { moneyToInput, parseMoney } from '../lib/format';
import { lostReasonProblem, lostReasonsFor, OTHER_LOST_REASON } from '../lib/lostReasons';
import { useStore } from '../lib/store';
import { pipelinesStore } from '../mocks/pipelines';
import { teamStore } from '../mocks/team';
import { Field, SidePanel } from './ui';
import { CustomSelect } from '../components/ui';

export type QualifyExtra = { value?: number; owner?: string; ownerId?: string };

/** Perguntas do Qualificar. Só aparece quando a pipeline exige valor ou dono e o lead ainda não tem. */
export function QualifyPanel({ lead, busy, onClose, onConfirm }: { lead: Lead; busy?: boolean; onClose: () => void; onConfirm: (extra: QualifyExtra) => void }) {
  const [pipelines] = useStore(pipelinesStore);
  const [team] = useStore(teamStore);
  const pipe = pipelines.find((p) => p.id === lead.pipelineId);
  const needsValue = pipe?.qualifyRequires.includes('value') ?? false;
  const needsOwner = pipe?.qualifyRequires.includes('owner') ?? false;

  const [value, setValue] = useState(lead.estimatedValue ? moneyToInput(lead.estimatedValue) : '');
  // O dono é uma pessoa da equipe (D36): guarda o id e manda também o nome, que o modo sem API usa.
  const [ownerId, setOwnerId] = useState(lead.ownerId ?? team.find((m) => m.name === lead.owner)?.id ?? '');
  const member = team.find((m) => m.id === ownerId);

  const parsed = value.trim() === '' ? undefined : parseMoney(value);
  const valueError = value.trim() !== '' && parsed === null ? 'Valor inválido. Use, por exemplo, 5000 ou 5.000,50.' : null;
  const ok = (!needsValue || (parsed !== undefined && parsed !== null && parsed > 0)) && (!needsOwner || ownerId !== '') && !valueError;

  return (
    <SidePanel
      title={`Qualificar ${lead.name}`}
      subtitle={`Cria a oportunidade na primeira etapa aberta de ${pipe?.name ?? 'a pipeline'} e leva as tarefas e o histórico junto.`}
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!ok || busy} onClick={() => onConfirm({ value: parsed ?? undefined, owner: member?.name, ownerId: member?.id })}>{busy ? 'Qualificando…' : 'Qualificar'}</button></>}
    >
      <div className="form-stack">
        <Field label={`Valor estimado${needsValue ? ' (obrigatório nesta pipeline)' : ''}`} hint={valueError ?? undefined}>
          <input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: 5000,00" autoFocus />
        </Field>
        <Field label={`Dono${needsOwner ? ' (obrigatório nesta pipeline)' : ''}`}>
          <CustomSelect className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}><option value="">Sem dono</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</CustomSelect>
        </Field>
      </div>
    </SidePanel>
  );
}

/**
 * Motivo de perda (D28): lista do funil, "Outro" pede a observação. Serve ao descarte do lead e à oportunidade
 * que vai para uma etapa Perdida; o servidor confere a mesma regra.
 */
export function LostReasonPanel({ title, subtitle, reasons, confirmLabel, busy, onClose, onConfirm }: {
  title: string; subtitle: string; reasons: string[]; confirmLabel: string; busy?: boolean;
  onClose: () => void; onConfirm: (reason: string, note: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const problem = lostReasonProblem(reasons, reason, note);

  return (
    <SidePanel
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-danger" disabled={Boolean(problem) || busy} title={problem ?? undefined} onClick={() => onConfirm(reason, note.trim())}>{busy ? 'Salvando…' : confirmLabel}</button></>}
    >
      <div className="form-stack">
        <Field label="Motivo">
          <CustomSelect className="select" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus>
            <option value="">Escolha o motivo</option>
            {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
          </CustomSelect>
        </Field>
        <Field label="Observação" hint={reason === OTHER_LOST_REASON ? 'Obrigatória com "Outro".' : 'Opcional.'}>
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
      </div>
    </SidePanel>
  );
}

export function DiscardPanel({ lead, busy, onClose, onConfirm }: { lead: Lead; busy?: boolean; onClose: () => void; onConfirm: (reason: string, note: string) => void }) {
  const [pipelines] = useStore(pipelinesStore);
  const reasons = lostReasonsFor(pipelines.find((p) => p.id === lead.pipelineId));
  return (
    <LostReasonPanel
      title={`Descartar ${lead.name}`}
      subtitle="Descartar não conta como oportunidade perdida. Dá para restaurar depois."
      reasons={reasons}
      confirmLabel="Descartar"
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
