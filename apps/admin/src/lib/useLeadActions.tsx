import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Lead } from '../domain';
import { DiscardPanel, QualifyPanel } from '../components/LeadPanels';
import type { QualifyExtra } from '../components/LeadPanels';
import { crmModeStore } from './crmMode';
import { qualifyLeadOnServer } from './crmSync';
import { emit } from './events';
import { discardLead, leadCtx, missingForQualify, qualifyLead } from './leadFlow';
import { lostReasonLabel } from './lostReasons';
import { pushAviso } from './notify';

type Pending = { kind: 'qualify' | 'discard'; lead: Lead } | null;

/**
 * Qualificar e descartar, com as perguntas que cada um pede.
 * `qualify` só abre o painel se a pipeline exigir valor ou dono que faltam; senão qualifica direto.
 * Com o CRM na API, qualificar é do servidor (a oportunidade passa a existir de verdade); sem ela, é exemplo.
 */
export function useLeadActions(onNotice: (message: string) => void, onDone?: () => void) {
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const runQualify = async (lead: Lead, extra: QualifyExtra = {}) => {
    if (crmModeStore.get() !== 'api') {
      const opp = qualifyLead(lead, extra);
      onNotice(`${lead.name} foi qualificado e agora é a oportunidade de exemplo "${opp.title}" em ${opp.pipeline}. As tarefas foram junto.`);
      setPending(null);
      onDone?.();
      return;
    }
    if (busy) return;
    setBusy(true);
    const r = await qualifyLeadOnServer(lead, { value: extra.value, ownerId: extra.ownerId });
    setBusy(false);
    if (!r.ok) {
      pushAviso(r.title, r.detail, { kind: 'lead', id: lead.id });
      return; // o painel (se aberto) continua, para corrigir e tentar de novo
    }
    // Os mesmos eventos do modo de exemplo: os passos de ciclo de vida que rodam nesta aba reagem a eles.
    emit('lead.qualificado', leadCtx(r.lead));
    emit('oportunidade.criada', { entity: 'opportunity', entityId: r.opportunityId, entityName: r.lead.name, pipelineId: r.lead.pipelineId, personId: r.lead.personId, companyId: r.lead.companyId, leadId: r.lead.id });
    const tasks = r.movedTasks === 1 ? ' 1 tarefa foi junto.' : r.movedTasks > 1 ? ` ${r.movedTasks} tarefas foram junto.` : '';
    onNotice(`${lead.name} foi qualificado e agora é uma oportunidade em Oportunidades.${tasks}`);
    setPending(null);
    onDone?.();
  };

  const qualify = (lead: Lead) => {
    if (missingForQualify(lead).length === 0) void runQualify(lead);
    else setPending({ kind: 'qualify', lead });
  };
  const discard = (lead: Lead) => setPending({ kind: 'discard', lead });

  const panels: ReactNode = pending && (
    pending.kind === 'qualify'
      ? <QualifyPanel lead={pending.lead} busy={busy} onClose={() => setPending(null)} onConfirm={(extra) => void runQualify(pending.lead, extra)} />
      : <DiscardPanel lead={pending.lead} onClose={() => setPending(null)} onConfirm={(reason, note) => { discardLead(pending.lead, reason, note); onNotice(`${pending.lead.name} foi descartado (${lostReasonLabel(reason, note)}).`); setPending(null); onDone?.(); }} />
  );

  return { qualify, discard, panels };
}
