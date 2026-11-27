import { CheckCircle2, CircleDashed, CircleDot, Compass, FlaskConical, Flag, XCircle } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { Lead, Lifecycle, StageKind, TaskStatus } from '../domain';
import type { Opportunity } from '../types';
import { LIFECYCLE_LABEL, LIFECYCLE_TONE } from '../lib/people';
import { resolveStage } from '../lib/stages';
import { useStore } from '../lib/store';
import { TASK_STATUSES, TASK_STATUS_META, statusOf } from '../lib/taskStatus';
import { pipelinesStore } from '../mocks/pipelines';

// SELOS DO ADMIN — o conjunto fechado. Toda marca pequena com texto sai daqui (ou de TagChip.tsx, para tags).
// Nenhuma tela inventa selo: tests/badges.test.ts falha se aparecer <Badge>, classe "badge"/"tag" ou data-cat fora
// destes arquivos. Regras e exemplos em docs/selos.md.
//
//   StatusBadge   estado que MUDA com o tempo        pílula tingida com ponto     Ativo, Publicado, Arquivada, Em análise
//   LabelBadge    tipo, papel, classificação, conta  contorno reto, sem ponto     Venda, Admin, Produção, 3 passos, v2
//   SampleBadge   não é real / não roda no servidor  contorno âmbar + frasco      Exemplo
//   EmptyBadge    campo sem valor                    cinza, sem cor               Sem dono, Sem responsável
//   StageBadge    etapa do funil                     fita em seta na cor da etapa Novos, Proposta, Ganho
//   SourceBadge   origem/fonte do lead               tracejado azul + bússola     Inbound · Formulário da LP
//   PriorityBadge prioridade                         barra lateral + bandeira     Alta, Média, Baixa
//   TagChip       tag (texto livre do usuário)       forma pela categoria         B2B, Decisor, Feira X
//
// Cor (tone) diz o sentido, não o enfeite: success = deu certo/ativo, warning = pede atenção, danger = falhou/parado/
// arquivado, info = informativo, accent = destaque da marca, neutral = sem juízo.

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

type BaseProps = { tone?: BadgeTone; title?: string; icon?: ReactNode; children: ReactNode };

/** Estado que muda: ponto + texto. Com `icon`, o ícone toma o lugar do ponto. */
export function StatusBadge({ tone = 'neutral', title, icon, children }: BaseProps) {
  return <span className="tagc" data-cat="STATUS" data-tone={tone} data-icon={icon ? '' : undefined} title={title}>{icon}<span className="tagc-text">{children}</span></span>;
}

/** Tipo, papel, classificação fixa ou contagem: contorno reto, sem ponto. */
export function LabelBadge({ tone = 'neutral', title, icon, children }: BaseProps) {
  return <span className="tagc" data-cat="LABEL" data-tone={tone} title={title}>{icon}<span className="tagc-text">{children}</span></span>;
}

/** Dado ou automação de exemplo (não é real, não roda no servidor). Texto padrão: "Exemplo". */
export function SampleBadge({ title, icon, children = 'Exemplo' }: { title?: string; icon?: ReactNode; children?: ReactNode }) {
  return <span className="tagc" data-cat="SAMPLE" title={title}>{icon ?? <FlaskConical size={11} aria-hidden="true" className="tagc-icon" />}<span className="tagc-text">{children}</span></span>;
}

/** Campo sem valor ("Sem dono", "Sem responsável"): cinza e sem cor, para ler como ausência e não como valor. */
export function EmptyBadge({ title, children }: { title?: string; children: ReactNode }) {
  return <span className="tagc" data-cat="EMPTY" title={title}>{children}</span>;
}

/* ------------------------------- estados com significado fixo ------------------------------- */

export function LifecycleBadge({ value }: { value: Lifecycle }) {
  return <StatusBadge tone={LIFECYCLE_TONE[value]}>{LIFECYCLE_LABEL[value]}</StatusBadge>;
}

const LEAD_STATUS: Record<Lead['status'], { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Ativo', tone: 'info' },
  QUALIFIED: { label: 'Qualificado', tone: 'success' },
  DISCARDED: { label: 'Descartado', tone: 'neutral' },
};

/** Situação do lead (Ativo, Qualificado, Descartado). `label` troca o texto mantendo a cor (ex.: "Lead" na ficha). */
export function LeadStatusBadge({ status, label }: { status: Lead['status']; label?: string }) {
  return <StatusBadge tone={LEAD_STATUS[status].tone}>{label ?? LEAD_STATUS[status].label}</StatusBadge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const m = TASK_STATUS_META[status];
  return <StatusBadge tone={m.tone}>{m.label}</StatusBadge>;
}

/** O selo de status que também é o seletor: um <select> nativo (acessível e com teclado) por cima do selo. */
export function TaskStatusPicker({ task, onChange }: { task: { done: boolean; status?: TaskStatus; title: string }; onChange: (next: TaskStatus) => void }) {
  const status = statusOf(task);
  return (
    <label className="status-pick" title="Mudar o status da tarefa">
      <TaskStatusBadge status={status} />
      <span className="status-pick-caret" aria-hidden="true">▾</span>
      <select className="status-pick-select" value={status} aria-label={`Status de “${task.title}”`} onChange={(e) => onChange(e.target.value as TaskStatus)}>
        {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_META[s].label}</option>)}
      </select>
    </label>
  );
}

/* ------------------------------------- campos do CRM ------------------------------------- */

const PRIORITY: Record<string, { label: string; tone: BadgeTone }> = {
  HIGH: { label: 'Alta', tone: 'danger' },
  MEDIUM: { label: 'Média', tone: 'warning' },
  LOW: { label: 'Baixa', tone: 'neutral' },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const m = PRIORITY[priority] ?? { label: priority, tone: 'neutral' as const };
  return <span className="tagc" data-cat="PRIORITY" data-tone={m.tone}><Flag size={11} aria-hidden="true" className="tagc-icon" /><span className="tagc-text">{m.label}</span></span>;
}

export function SourceBadge({ children, title, icon }: { children: ReactNode; title?: string; icon?: ReactNode }) {
  return <span className="tagc" data-cat="SOURCE" title={title}>{icon ?? <Compass size={11} aria-hidden="true" className="tagc-icon" />}<span className="tagc-text">{children}</span></span>;
}

const LEGACY_STAGE: Record<string, { label: string; color: string; kind: StageKind }> = {
  INBOUND: { label: 'Entrada', color: 'var(--pipe-triage)', kind: 'LEAD' },
  QUALIFICATION: { label: 'Qualificação', color: 'var(--pipe-progress)', kind: 'OPEN' },
  WON: { label: 'Ganho', color: 'var(--pipe-won)', kind: 'WON' },
};
const KIND_ICON: Record<StageKind, typeof CircleDot> = { LEAD: CircleDashed, OPEN: CircleDot, WON: CheckCircle2, LOST: XCircle };

/** Etapa do funil: a fita em seta, cheia na cor da etapa, com o ícone do tipo. Só a etapa usa a seta. Passe `opp` para resolver pelo funil (id de etapa ou valor antigo). */
export function StageBadge({ stage, opp }: { stage: string; opp?: Pick<Opportunity, 'stage' | 'pipeline'> }) {
  const [pipelines] = useStore(pipelinesStore);
  const real = resolveStage(opp ?? { stage }, pipelines).stage;
  const shown = real ? { label: real.name, color: real.color, kind: real.kind } : LEGACY_STAGE[stage];
  if (!shown) return <LabelBadge>{stage || '—'}</LabelBadge>; // etapa que a tela ainda não conhece
  const Icon = KIND_ICON[shown.kind];
  return (
    <span className="tagc" data-cat="STAGE" style={{ '--tc': shown.color } as CSSProperties}>
      <Icon size={12} aria-hidden="true" className="tagc-icon" /><span className="tagc-text">{shown.label}</span>
    </span>
  );
}
