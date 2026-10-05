import { Building2, CheckCircle2, CircleDashed, CircleDot, XCircle, User } from 'lucide-react';
import type { StageKind } from '../domain';
import type { Opportunity } from '../types';
import { resolveStage } from '../lib/stages';
import { useStore } from '../lib/store';
import { pipelinesStore } from '../mocks/pipelines';

const STAGES: Record<string, { label: string; color: string; Icon: typeof CircleDot }> = {
  INBOUND: { label: 'Entrada', color: 'var(--pipe-triage)', Icon: CircleDashed },
  QUALIFICATION: { label: 'Qualificação', color: 'var(--pipe-progress)', Icon: CircleDot },
  WON: { label: 'Ganho', color: 'var(--pipe-won)', Icon: CheckCircle2 },
};

const KIND_ICON: Record<StageKind, typeof CircleDot> = { LEAD: CircleDashed, OPEN: CircleDot, WON: CheckCircle2, LOST: XCircle };

/** Passe `opp` para resolver pelo funil da oportunidade (id de etapa ou valor antigo). */
export function StageBadge({ stage, opp }: { stage: string; opp?: Pick<Opportunity, 'stage' | 'pipeline'> }) {
  const [pipelines] = useStore(pipelinesStore);
  const real = resolveStage(opp ?? { stage }, pipelines).stage;
  if (real) {
    const Icon = KIND_ICON[real.kind];
    return (
      <span className="tag" style={{ color: real.color, borderColor: real.color, background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <Icon size={12} /> {real.name}
      </span>
    );
  }
  const known = STAGES[stage];
  if (!known) return <span className="tag">{stage || '—'}</span>; // etapa que a tela ainda não conhece
  const { label, color, Icon } = known;
  return (
    <span className="tag" style={{ color, borderColor: color, background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <Icon size={12} /> {label}
    </span>
  );
}

/** Empresa (B2B) mostra o prédio e o contato embaixo; Pessoa (B2C) mostra a pessoa. */
export function ClientCell({ opp }: { opp: Opportunity }) {
  const isCompany = Boolean(opp.companyName);
  const primary = isCompany ? opp.companyName : opp.contactName || 'Sem contato';
  const avatar = isCompany ? opp.companyLogo : opp.contactAvatar;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {avatar ? (
        <img src={avatar} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
      ) : (
        <div
          title={isCompany ? 'Empresa' : 'Pessoa'}
          style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          {isCompany ? <Building2 size={11} color="var(--text-muted)" /> : <User size={11} color="var(--text-muted)" />}
        </div>
      )}
      <div>
        <div className="text-sm font-medium">{primary}</div>
        {isCompany && opp.contactName && <div className="text-xs text-muted">{opp.contactName}</div>}
      </div>
    </div>
  );
}

export function Tags({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return <span className="text-muted">—</span>;
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {tags.map((t) => <span key={t} className="tag">{t}</span>)}
    </div>
  );
}

export function Owner({ opp }: { opp: Opportunity }) {
  if (!opp.ownerName) return <span className="text-muted">Não atribuído</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {opp.ownerAvatar
        ? <img src={opp.ownerAvatar} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
        : <User size={14} color="var(--text-muted)" />}
      <span className="text-sm">{opp.ownerName}</span>
    </div>
  );
}
