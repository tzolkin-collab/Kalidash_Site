import { useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ArrowRightCircle, RotateCcw, XCircle } from 'lucide-react';
import type { Lead, LeadOrigin } from '../domain';
import { editRecord, setArchived } from '../lib/edit';
import { formatCurrency, formatDate, formatDateTime, moneyToInput, parseMoney } from '../lib/format';
import { leadCtx, moveLeadStage, restoreLead } from '../lib/leadFlow';
import { avisoForBlockers, pushAviso } from '../lib/notify';
import { useCan } from '../lib/permissions';
import { useStore } from '../lib/store';
import { useLeadActions } from '../lib/useLeadActions';
import { useViewSettings } from '../lib/viewSettings';
import { leadsStore } from '../mocks/leads';
import { companiesStore, peopleStore } from '../mocks/people';
import { pipelinesStore } from '../mocks/pipelines';
import { teamStore } from '../mocks/team';
import CustomFieldsSection from './CustomFieldsSection';
import { ReadOnlyField, SelectField, TagsField, TextField } from './fields';
import type { PartyRef } from './PartySheets';
import { HistoryTab, TasksTab } from './RecordTabs';
import RecordSheet from './RecordSheet';
import { Badge } from './ui';

type Props = {
  leadId: string;
  onClose: () => void;
  onOpenParty: (ref: PartyRef) => void;
  onNotice: (message: string) => void;
};

const ORIGINS: { value: LeadOrigin; label: string }[] = [{ value: 'INBOUND', label: 'Inbound (fonte)' }, { value: 'OUTBOUND', label: 'Outbound (equipe)' }];

/** Ficha do lead, com edição por campo. Qualificar e descartar pedem só o que a pipeline exige. */
export default function LeadSheet({ leadId, onClose, onOpenParty, onNotice }: Props) {
  const [leads] = useStore(leadsStore);
  const [pipelines] = useStore(pipelinesStore);
  const [people] = useStore(peopleStore);
  const [companies] = useStore(companiesStore);
  const [team] = useStore(teamStore);
  const { settings, update } = useViewSettings();
  const can = useCan();
  const [tab, setTab] = useState('overview');
  const [stageDenied, setStageDenied] = useState(false);
  const actions = useLeadActions(onNotice, onClose);

  const lead = leads.find((l) => l.id === leadId);

  // Abrir a ficha marca o lead como visto
  useEffect(() => {
    leadsStore.set((prev) => prev.map((l) => (l.id === leadId && !l.wasSeen ? { ...l, wasSeen: true } : l)));
  }, [leadId]);

  const pipe = pipelines.find((p) => p.id === lead?.pipelineId);
  const allTags = useMemo(() => [...new Set(leads.flatMap((l) => l.tags))].sort(), [leads]);
  if (!lead) return null;

  const save = (patch: Partial<Lead>, field: string, from: unknown, to: unknown, fieldKey?: string) =>
    editRecord(leadsStore, lead.id, patch, { entity: 'lead', entityName: lead.name, field, from, to, fieldKey, ctx: leadCtx(lead) });

  const stageOptions = (pipe?.stages ?? []).filter((s) => s.kind === 'LEAD').map((s) => ({ value: s.id, label: s.name }));
  const sourceOptions = lead.origin === 'INBOUND' ? (pipe?.sources ?? []).map((s) => s.name) : team.map((m) => m.name);
  const sourceValues = sourceOptions.includes(lead.sourceName) ? sourceOptions : [lead.sourceName, ...sourceOptions];
  const person = people.find((p) => p.id === lead.personId);
  const company = companies.find((c) => c.id === lead.companyId);
  const active = lead.status === 'ACTIVE';

  const changePipeline = (id: string) => {
    const next = pipelines.find((p) => p.id === id);
    if (!next || next.id === lead.pipelineId) return;
    const currentStage = pipe?.stages.find((s) => s.id === lead.stageId);
    const target = next.stages.find((s) => s.kind === 'LEAD' && s.name === currentStage?.name) ?? next.stages.find((s) => s.kind === 'LEAD');
    save({ pipelineId: next.id, stageId: target?.id ?? lead.stageId }, 'Pipeline', pipe?.name, next.name);
  };

  const changeOrigin = (origin: LeadOrigin) => {
    if (origin === lead.origin) return;
    const first = origin === 'INBOUND' ? pipe?.sources[0]?.name : team[0]?.name;
    save({ origin, sourceName: first ?? '' }, 'Origem', lead.origin, origin);
  };

  const setCustom = (key: string, label: string, from: unknown, to: unknown) => {
    const next = { ...(lead.customData ?? {}) };
    if (to === undefined) delete next[key]; else next[key] = to;
    save({ customData: next }, label, from, to);
  };

  return (
    <>
      <RecordSheet
        mode={settings.openMode}
        fontSize={settings.fontSize}
        onClose={onClose}
        onSwitchMode={() => update({ openMode: settings.openMode === 'side' ? 'center' : 'side' })}
        title={lead.name}
        onTitle={(v) => save({ name: v }, 'Nome', lead.name, v)}
        badges={
          <>
            <Badge tone={active ? 'accent' : lead.status === 'QUALIFIED' ? 'success' : 'danger'}>{active ? 'Lead' : lead.status === 'QUALIFIED' ? 'Qualificado' : 'Descartado'}</Badge>
            {lead.returningClient && <Badge tone="info" title="Já é cliente e preencheu de novo">Cliente retornando</Badge>}
            {!lead.wasSeen && <Badge tone="warning">Novo</Badge>}
            {lead.archivedAt && <Badge tone="danger">Arquivado</Badge>}
          </>
        }
        subtitle={pipe?.name}
        tabs={[{ id: 'overview', label: 'Visão geral' }, { id: 'tasks', label: 'Tarefas' }, { id: 'history', label: 'Histórico' }]}
        tab={tab}
        onTab={setTab}
        footer={
          <>
            {active && (
              <>
                <button type="button" className="btn btn-solid" onClick={() => actions.qualify(lead)}><ArrowRightCircle size={14} /> Qualificar</button>
                <button type="button" className="btn btn-danger" onClick={() => actions.discard(lead)}><XCircle size={14} /> Descartar</button>
              </>
            )}
            {lead.status === 'DISCARDED' && <button type="button" className="btn" onClick={() => restoreLead(lead)}><RotateCcw size={14} /> Restaurar</button>}
            <button type="button" className="btn" style={{ marginLeft: 'auto' }} onClick={() => setArchived(leadsStore, 'lead', lead.id, lead.name, !lead.archivedAt)}>
              {lead.archivedAt ? <><ArchiveRestore size={14} /> Desarquivar</> : <><Archive size={14} /> Arquivar</>}
            </button>
          </>
        }
      >
        {tab === 'overview' && (
          <>
            {lead.status === 'DISCARDED' && lead.discardReason && <div className="task-callout" role="note" style={{ marginBottom: '16px' }}><span>Descartado. Motivo: {lead.discardReason}.</span></div>}
            {lead.status === 'QUALIFIED' && <div className="task-callout" role="note" style={{ marginBottom: '16px' }}><span>Este lead já virou oportunidade. Veja em Oportunidades.</span></div>}

            <div className="sheet-section">
              <h3 className="sheet-section-title">Contato</h3>
              <TextField label="E-mail" type="email" required value={lead.email} validate={(v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Informe um e-mail válido.')} onCommit={(v) => save({ email: v }, 'E-mail', lead.email, v, 'email')} />
              <TextField label="Telefone" type="tel" value={lead.phone ?? ''} onCommit={(v) => save({ phone: v || undefined }, 'Telefone', lead.phone, v, 'telefone')} />
              <SelectField label="Pessoa" value={lead.personId ?? ''} empty="Nenhuma" options={people.filter((p) => !p.archivedAt).map((p) => ({ value: p.id, label: p.name }))} onCommit={(v) => save({ personId: v || undefined }, 'Pessoa', person?.name, people.find((p) => p.id === v)?.name)} />
              {person && <div className="sheet-actions-row"><button type="button" className="link-inline" onClick={() => onOpenParty({ kind: 'person', id: person.id })}>Abrir a ficha de {person.name}</button></div>}
              <SelectField label="Empresa" value={lead.companyId ?? ''} empty="Nenhuma" options={companies.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name }))} onCommit={(v) => save({ companyId: v || undefined }, 'Empresa', company?.name, companies.find((c) => c.id === v)?.name)} />
              {company && <div className="sheet-actions-row"><button type="button" className="link-inline" onClick={() => onOpenParty({ kind: 'company', id: company.id })}>Abrir a ficha de {company.name}</button></div>}
            </div>

            <div className="sheet-section">
              <h3 className="sheet-section-title">Funil</h3>
              <SelectField label="Pipeline" value={lead.pipelineId} options={pipelines.filter((p) => !p.archivedAt || p.id === lead.pipelineId).map((p) => ({ value: p.id, label: p.name }))} onCommit={changePipeline} />
              <div className={stageDenied ? 'deny-shake' : undefined} onAnimationEnd={() => setStageDenied(false)}>
                <SelectField
                  label="Etapa"
                  value={lead.stageId}
                  options={stageOptions}
                  readOnly={!active}
                  onCommit={(v) => {
                    const result = moveLeadStage(lead, v);
                    if (!result.ok) {
                      setStageDenied(true);
                      const { title, detail } = avisoForBlockers(lead.name, result.blockers);
                      pushAviso(title, detail, { kind: 'lead', id: lead.id });
                    }
                  }}
                  hint="Ir para Em contato registra o primeiro contato. Etapas travadas por tarefa pendente não deixam mover."
                />
              </div>
              <SelectField label="Origem" value={lead.origin} options={ORIGINS} readOnly={!can.editOrigin} hint="Só Admin e Gerente trocam a origem." onCommit={(v) => changeOrigin(v as LeadOrigin)} />
              <SelectField label={lead.origin === 'INBOUND' ? 'Fonte' : 'Quem trouxe'} value={lead.sourceName} options={sourceValues.map((s) => ({ value: s, label: s }))} readOnly={!can.editOrigin} hint="Todo lead precisa de origem." onCommit={(v) => save({ sourceName: v }, lead.origin === 'INBOUND' ? 'Fonte' : 'Quem trouxe', lead.sourceName, v)} />
              <SelectField label="Dono" value={lead.owner ?? ''} empty="Sem dono" options={team.map((m) => ({ value: m.name, label: m.name }))} onCommit={(v) => save({ owner: v || undefined }, 'Dono', lead.owner, v)} />
              <TextField
                label="Valor estimado"
                value={lead.estimatedValue ? moneyToInput(lead.estimatedValue) : ''}
                display={lead.estimatedValue ? formatCurrency(lead.estimatedValue) : undefined}
                placeholder="Ex.: 5000,00"
                validate={(v) => (parseMoney(v) === null ? 'Valor inválido. Use, por exemplo, 5000 ou 5.000,50.' : null)}
                onCommit={(v) => { const n = v === '' ? undefined : parseMoney(v) ?? undefined; save({ estimatedValue: n }, 'Valor estimado', lead.estimatedValue, n); }}
              />
              <TextField label="Previsão de fechamento" type="date" value={lead.expectedCloseAt ?? ''} display={lead.expectedCloseAt ? formatDateTime(lead.expectedCloseAt) : undefined} onCommit={(v) => save({ expectedCloseAt: v || undefined }, 'Previsão', lead.expectedCloseAt, v)} />
              <TextField label="Primeiro contato" type="date" value={lead.firstContactAt ?? ''} display={lead.firstContactAt ? formatDateTime(lead.firstContactAt) : undefined} onCommit={(v) => { const iso = v ? (/T\d{2}:\d{2}/.test(v) ? new Date(v).toISOString() : new Date(`${v}T12:00:00`).toISOString()) : undefined; save({ firstContactAt: iso }, 'Primeiro contato', lead.firstContactAt, v); }} hint="Alimenta o tempo até o primeiro contato no dashboard." />
              <TagsField label="Tags" value={lead.tags} options={allTags} allowCreate onCommit={(v) => save({ tags: v }, 'Tags', lead.tags, v)} />
            </div>

            <div className="sheet-section">
              <h3 className="sheet-section-title">Mensagem</h3>
              <TextField label="Do formulário" multiline value={lead.message ?? ''} placeholder="Sem mensagem" onCommit={(v) => save({ message: v || undefined }, 'Mensagem', lead.message, v)} />
              <ReadOnlyField label="Entrou em">{formatDate(lead.createdAt)}</ReadOnlyField>
            </div>

            <CustomFieldsSection entity="lead" values={lead.customData} onChange={(f, from, to) => setCustom(f.key, f.label, from, to)} extra={pipe?.customFields} />
          </>
        )}
        {tab === 'tasks' && <TasksTab entity="lead" id={lead.id} name={lead.name} ctx={leadCtx(lead)} />}
        {tab === 'history' && <HistoryTab entity="lead" id={lead.id} createdAt={lead.createdAt} />}
      </RecordSheet>
      {actions.panels}
    </>
  );
}
