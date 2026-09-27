import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Lead } from '../domain';
import { DiscardPanel, QualifyPanel } from '../components/LeadPanels';
import { discardLead, missingForQualify, qualifyLead } from './leadFlow';

type Pending = { kind: 'qualify' | 'discard'; lead: Lead } | null;

/**
 * Qualificar e descartar, com as perguntas que cada um pede.
 * `qualify` só abre o painel se a pipeline exigir valor ou dono que faltam; senão qualifica direto.
 */
export function useLeadActions(onNotice: (message: string) => void, onDone?: () => void) {
  const [pending, setPending] = useState<Pending>(null);

  const runQualify = (lead: Lead, extra: { value?: number; owner?: string } = {}) => {
    const opp = qualifyLead(lead, extra);
    onNotice(`${lead.name} foi qualificado e agora é a oportunidade "${opp.title}" em ${opp.pipeline}, na etapa Qualificação. As tarefas foram junto.`);
    setPending(null);
    onDone?.();
  };

  const qualify = (lead: Lead) => {
    if (missingForQualify(lead).length === 0) runQualify(lead);
    else setPending({ kind: 'qualify', lead });
  };
  const discard = (lead: Lead) => setPending({ kind: 'discard', lead });

  const panels: ReactNode = pending && (
    pending.kind === 'qualify'
      ? <QualifyPanel lead={pending.lead} onClose={() => setPending(null)} onConfirm={(extra) => runQualify(pending.lead, extra)} />
      : <DiscardPanel lead={pending.lead} onClose={() => setPending(null)} onConfirm={(reason) => { discardLead(pending.lead, reason); onNotice(`${pending.lead.name} foi descartado (${reason}).`); setPending(null); onDone?.(); }} />
  );

  return { qualify, discard, panels };
}
