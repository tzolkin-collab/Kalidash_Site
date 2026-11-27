import TagChip from './TagChip';
import { useId, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Circle, HelpCircle, Lock, Pencil, Trash2, X } from 'lucide-react';
import type { ChangeEntry, EntityKind, Pipeline, Requirement, TaskItem } from '../domain';
import { emit } from '../lib/events';
import type { EventContext } from '../lib/events';
import { formatDate } from '../lib/format';
import { logChange, useHistory } from '../lib/history';
import { canDeleteTask, dateToDueAt, deleteTask, editTask, setTaskStatus, toggleTask } from '../lib/taskActions';
import { describeChange } from '../lib/historyText';
import { useStore } from '../lib/store';
import { pipelinesStore } from '../mocks/pipelines';
import { addTask, tasksStore } from '../mocks/tasks';
import { teamStore } from '../mocks/team';
import { EmptyState } from './ui';
import { CustomSelect } from '../components/ui';
import { EmptyBadge, LabelBadge, StageBadge, TaskStatusPicker } from './badges';

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Linha do tempo de tudo o que mudou no registro: quem, quando, antes e depois. */
export function HistoryTab({ entity, id, createdAt }: { entity: EntityKind; id: string; createdAt: string }) {
  const entries = useHistory(entity, id);
  return (
    <div className="peek-tl">
      {entries.map((h) => {
        const d = describeChange(h);
        return (
          <div key={h.id} className="peek-tl-item">
            <div className="peek-tl-dot" data-type={h.kind === 'edit' ? 'NOTE' : h.kind === 'lifecycle' ? 'CALL' : 'EMAIL'} />
            <div className="text-xs text-muted">{when(h.at)} • {h.actor}</div>
            <div className="font-medium text-sm">{d.title}</div>
            {d.detail && <div className="text-sm text-muted">{d.detail}</div>}
          </div>
        );
      })}
      <div className="peek-tl-item">
        <div className="peek-tl-dot" />
        <div className="text-xs text-muted">{formatDate(createdAt) ?? 'Criação'}</div>
        <div className="font-medium text-sm">Cadastro criado</div>
      </div>
    </div>
  );
}

/** Um lead ou oportunidade do cliente, com o funil e a etapa em que está. */
export type StageRecord = { kind: 'lead' | 'opportunity'; id: string; title: string; pipelineId?: string; stageId: string; pipelineName?: string; createdAt?: string };

const DAY = 86_400_000;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const span = (from: string, to: number) => {
  const d = Math.floor((to - new Date(from).getTime()) / DAY);
  return d <= 0 ? 'menos de 1 dia' : d === 1 ? '1 dia' : `${d} dias`;
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Visit = { name: string; at?: string; leftAt?: string };
type StageState = 'done' | 'current' | 'next';
type Item = { req: Requirement; task?: TaskItem };

/**
 * Por onde o registro passou, em ordem: a etapa em que nasceu (na data do cadastro) e cada mudança de "Etapa" do
 * histórico. A última visita a cada etapa é a que vale para mostrar "entrou em" e "ficou N dias".
 */
function visitsByStage(createdAt: string | undefined, moves: ChangeEntry[], currentName: string): Map<string, Visit> {
  const sorted = [...moves].sort((a, b) => a.at.localeCompare(b.at));
  const path: Visit[] = [{ name: sorted[0]?.from ?? currentName, at: createdAt }, ...sorted.map((m) => ({ name: m.to ?? '', at: m.at }))];
  path.forEach((v, i) => { v.leftAt = path[i + 1]?.at; });
  const out = new Map<string, Visit>();
  for (const v of path) out.set(v.name, v);
  return out;
}

const ORIGIN_TEXT: Record<TaskItem['source'], string> = { manual: 'Criada à mão', passo: 'Criada por um passo automático', requisito: 'Criada por um requisito de etapa' };
const STATE_TEXT: Record<StageState, string> = { done: 'Passou', current: 'Etapa atual', next: 'Próxima' };

/** O porquê de a tarefa de um requisito ainda não existir: curto na tela, completo no balão. */
function missingText(req: Requirement, state: StageState): { short: string; long: string } {
  if (req.gate === 'NONE') return { short: 'Não trava', long: 'Pendência sem trava: não bloqueia a mudança de etapa. Só vira tarefa se alguém ligá-la em Workflow.' };
  if (state === 'next') return req.gate === 'ENTER'
    ? { short: 'Criada ao tentar entrar', long: 'Vira tarefa quando alguém tentar mover o registro para esta etapa. Até estar concluída, ele não entra.' }
    : { short: 'Criada ao tentar sair', long: 'Vira tarefa quando o registro estiver aqui e alguém tentar levá-lo adiante.' };
  if (state === 'current') return req.gate === 'EXIT'
    ? { short: 'Criada ao tentar avançar', long: 'Vira tarefa quando alguém tentar mover para a próxima etapa. Até estar concluída, o registro não sai daqui.' }
    : { short: 'Não cobrada na entrada', long: 'Era exigida para entrar, mas o registro chegou aqui sem ela (cadastro direto ou importação).' };
  return { short: 'Não cobrada', long: 'O registro passou por esta etapa sem que a tarefa fosse cobrada.' };
}

/** Responsável e prazo (ou quando foi concluída) de uma tarefa. */
function taskMeta(task: TaskItem, now: number): string {
  const parts: string[] = task.assignee ? [task.assignee] : [];
  if (task.done) parts.push(task.doneAt ? `concluída em ${shortDate(task.doneAt)}` : 'concluída');
  else if (task.dueAt) parts.push(new Date(task.dueAt).getTime() < now ? `atrasada desde ${shortDate(task.dueAt)}` : `vence em ${shortDate(task.dueAt)}`);
  return parts.join(' · ');
}

function GateBadge({ gate }: { gate: Requirement['gate'] }) {
  if (gate === 'NONE') return null;
  return (
    <LabelBadge tone="warning" icon={<Lock size={11} aria-hidden="true" className="tagc-icon" />} title={gate === 'ENTER' ? 'Precisa estar concluída para entrar na etapa' : 'Precisa estar concluída para sair da etapa'}>
      {gate === 'ENTER' ? 'Para entrar' : 'Para sair'}
    </LabelBadge>
  );
}

/** Uma tarefa de etapa: a que o requisito gerou, ou o requisito ainda sem tarefa com o porquê. */
function RequirementRow({ req, task, state, now }: Item & { state: StageState; now: number }) {
  const why = task ? undefined : missingText(req, state);
  const meta = task ? taskMeta(task, now) : why!.short;
  return (
    <li className="stg-task" data-missing={task ? undefined : ''}>
      <div className="stg-task-row">
        <span className={`stg-task-title ${task?.done ? 'is-done' : ''}`}>{task?.title ?? req.label}</span>
        <GateBadge gate={req.gate} />
        {task
          ? <TaskStatusPicker task={task} onChange={(st) => setTaskStatus(task, st)} />
          : <EmptyBadge title={why!.long}>Ainda não criada</EmptyBadge>}
      </div>
      {meta && <p className="stg-task-meta" title={why?.long}>{meta}</p>}
    </li>
  );
}

/** A linha do tempo de um lead ou oportunidade: o status no topo, a etapa atual aberta e as outras recolhidas. */
function StageTimeline({ r, pipeline, tasks, now }: { r: StageRecord; pipeline: Pipeline; tasks: TaskItem[]; now: number }) {
  const headId = useId();
  const history = useHistory(r.kind, r.id);
  const current = pipeline.stages.findIndex((s) => s.id === r.stageId);
  const currentStage = pipeline.stages[current];
  const visits = visitsByStage(r.createdAt, history.filter((h) => h.field === 'Etapa'), currentStage?.name ?? '');
  // Perdido só aparece se for a etapa atual.
  const stages = pipeline.stages.filter((s, i) => s.kind !== 'LOST' || i === current);
  const itemsOf = (stageId: string): Item[] => pipeline.requirements.filter((q) => q.stageId === stageId).map((q) => ({ req: q, task: tasks.find((t) => t.requirementId === q.id) }));
  const fromReq = new Set(pipeline.requirements.map((q) => q.id));
  const loose = tasks.filter((t) => !t.requirementId || !fromReq.has(t.requirementId));
  const here = currentStage ? visits.get(currentStage.name) : undefined;
  const path = pipeline.stages.filter((s) => s.kind !== 'LOST');
  const step = currentStage ? path.indexOf(currentStage) : -1;
  const blocking = currentStage ? itemsOf(currentStage.id).filter((x) => x.req.gate === 'EXIT' && !x.task?.done) : [];
  const closed = currentStage?.kind === 'WON' || currentStage?.kind === 'LOST';

  return (
    <section className="stg-record" aria-labelledby={headId}>
      <header className="stg-record-head">
        <h3 id={headId} className="stg-record-title">{r.title}</h3>
        <LabelBadge tone={r.kind === 'lead' ? 'accent' : 'neutral'}>{r.kind === 'lead' ? 'Lead' : 'Oportunidade'}</LabelBadge>
        <span className="stg-record-meta">{pipeline.name}</span>
      </header>

      {currentStage && (
        <div className="stg-status" data-blocked={blocking.length ? '' : undefined}>
          <p className="stg-status-main">
            Em <strong>{currentStage.name}</strong>
            {here?.at ? ` há ${span(here.at, now)}` : ''}
            {step >= 0 && <span className="stg-status-step"> · {step + 1} de {path.length}</span>}
          </p>
          {!closed && blocking.length > 0 && (
            <p className="stg-status-gate"><AlertTriangle size={14} aria-hidden="true" /> Falta: {blocking.map((x) => x.task?.title ?? x.req.label).join(', ')}</p>
          )}
        </div>
      )}

      <ol className="stg-list" aria-label={`Etapas de ${r.title} no funil ${pipeline.name}`}>
        {stages.map((s) => {
          const index = pipeline.stages.indexOf(s);
          const state: StageState = current < 0 ? 'next' : index < current ? 'done' : index === current ? 'current' : 'next';
          const items = itemsOf(s.id);
          const visit = visits.get(s.name);
          const doneCount = items.filter((x) => x.task?.done).length;
          const when = state === 'done' && visit?.at && visit.leftAt ? span(visit.at, new Date(visit.leftAt).getTime()) : '';
          const count = items.length === 0 || state === 'current' ? '' : state === 'next' ? plural(items.length, 'tarefa', 'tarefas') : `${doneCount}/${items.length} tarefas`;
          const head = (
            <>
              <StageBadge stage={s.id} />
              <span className={state === 'current' ? 'stg-state' : 'stg-sr'}>{STATE_TEXT[state]}</span>
              {(when || count) && <span className="stg-when">{[when, count].filter(Boolean).join(' · ')}</span>}
            </>
          );
          const list = items.length > 0 && (
            <ul className="stg-tasks">
              {items.map((x) => <RequirementRow key={x.req.id} {...x} state={state} now={now} />)}
            </ul>
          );
          return (
            <li key={s.id} className="stg-item" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
              {state === 'current' ? (
                <div className="stg-current">
                  <div className="stg-head">{head}</div>
                  {list || <p className="stg-none">Sem tarefas.</p>}
                </div>
              ) : items.length > 0 ? (
                <details className="stg-fold">
                  <summary className="stg-head">{head}<ChevronDown size={14} aria-hidden="true" className="stg-chevron" /></summary>
                  {list}
                </details>
              ) : (
                <div className="stg-head">{head}</div>
              )}
            </li>
          );
        })}
      </ol>

      {loose.length > 0 && (
        <div className="stg-loose">
          <h4 className="stg-sub">Outras tarefas deste {r.kind === 'lead' ? 'lead' : 'negócio'}</h4>
          <ul className="stg-tasks">
            {loose.map((t) => (
              <li key={t.id} className="stg-task">
                <div className="stg-task-row">
                  <span className={`stg-task-title ${t.done ? 'is-done' : ''}`}>{t.title}</span>
                  <TaskStatusPicker task={t} onChange={(st) => setTaskStatus(t, st)} />
                </div>
                {taskMeta(t, now) && <p className="stg-task-meta" title={ORIGIN_TEXT[t.source]}>{taskMeta(t, now)}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * Etapas do cliente, como cronologia: para cada lead e oportunidade dele, onde está e o que falta (no topo), a etapa
 * atual aberta com as tarefas, e as etapas já passadas e as próximas recolhidas, com datas. Etapa é o conjunto de
 * tarefas: cada requisito aparece com a tarefa que gerou ou com o porquê de ela ainda não existir. As tarefas avulsas
 * do cliente ficam no fim.
 */
export function StagesTab({ entity, id, name, ctx, records }: { entity: EntityKind; id: string; name: string; ctx: EventContext; records: StageRecord[] }) {
  const [all] = useStore(tasksStore);
  const [pipelines] = useStore(pipelinesStore);
  const [now] = useState(() => Date.now());
  const ownId = useId();

  return (
    <div className="stg">
      {records.length === 0 ? (
        <EmptyState title="Nenhuma etapa ainda">As etapas aparecem quando o cliente tem um lead ou uma oportunidade num funil.</EmptyState>
      ) : (
        <details className="stg-help">
          <summary><HelpCircle size={14} aria-hidden="true" /> Como funcionam as etapas</summary>
          <ul>
            <li>Cada etapa do funil reúne as tarefas que ela pede.</li>
            <li><strong>Para entrar</strong> e <strong>Para sair</strong> travam a mudança de etapa até a tarefa estar concluída. Elas só viram tarefa quando alguém tenta mover o registro.</li>
            <li>As demais são pendências: não travam nada.</li>
          </ul>
        </details>
      )}
      {records.map((r) => {
        const pipeline = pipelines.find((p) => p.id === r.pipelineId) ?? pipelines.find((p) => p.stages.some((s) => s.id === r.stageId)) ?? pipelines.find((p) => p.name === r.pipelineName);
        if (!pipeline) {
          return (
            <section key={`${r.kind}-${r.id}`} className="stg-record">
              <header className="stg-record-head"><h3 className="stg-record-title">{r.title}</h3><LabelBadge tone={r.kind === 'lead' ? 'accent' : 'neutral'}>{r.kind === 'lead' ? 'Lead' : 'Oportunidade'}</LabelBadge></header>
              <p className="stg-none">O funil deste registro não foi encontrado.</p>
            </section>
          );
        }
        return <StageTimeline key={`${r.kind}-${r.id}`} r={r} pipeline={pipeline} tasks={all.filter((t) => t.entity === r.kind && t.entityId === r.id)} now={now} />;
      })}

      <section className="stg-own" aria-labelledby={ownId}>
        <h3 id={ownId} className="sheet-section-title">Tarefas avulsas do cliente</h3>
        <TasksTab entity={entity} id={id} name={name} ctx={ctx} empty={{ title: 'Nenhuma tarefa avulsa', text: 'As tarefas das etapas ficam acima, em cada etapa. Aqui entra o que você criar à mão para o cliente.' }} />
      </section>
    </div>
  );
}

const TAG_FALLBACK = ['Dados do cliente', 'Dados da empresa', 'Comercial', 'Jurídico', 'Pós-venda', 'Configuração'];

/** Tarefas do registro. Concluir uma emite `tarefa.concluida`. */
export function TasksTab({ entity, id, name, ctx, empty }: { entity: EntityKind; id: string; name: string; ctx: EventContext; empty?: { title: string; text: string } }) {
  const [all] = useStore(tasksStore);
  const [pipelines] = useStore(pipelinesStore);
  const [team] = useStore(teamStore);
  const tasks = useMemo(() => all.filter((t) => t.entity === entity && t.entityId === id), [all, entity, id]);
  const tags = useMemo(() => [...new Set([...pipelines.flatMap((p) => p.taskTags), ...TAG_FALLBACK])], [pipelines]);

  const [title, setTitle] = useState('');
  const [tag, setTag] = useState(tags[0] ?? 'Geral');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [now] = useState(() => Date.now());

  const add = () => {
    if (!title.trim()) return;
    addTask({ entity, entityId: id, entityName: name, title: title.trim(), tag, assignee: assignee || undefined, dueAt: dateToDueAt(due), source: 'manual' });
    logChange({ entity, entityId: id, entityName: name, kind: 'event', note: `Tarefa criada: ${title.trim()}` });
    emit('tarefa.criada', ctx);
    setTitle('');
    setDue('');
  };

  const toggle = (taskId: string) => {
    const task = all.find((t) => t.id === taskId);
    if (task) toggleTask(task, ctx);
  };

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', assignee: '', due: '' });
  const startEdit = (t: TaskItem) => {
    setEditing(t.id);
    setDraft({ title: t.title, assignee: t.assignee ?? '', due: t.dueAt ? t.dueAt.slice(0, 10) : '' });
  };
  const saveEdit = (task: TaskItem) => {
    if (!draft.title.trim()) return;
    editTask(task, { title: draft.title, assignee: draft.assignee || undefined, dueAt: dateToDueAt(draft.due) });
    setEditing(null);
  };
  const remove = (task: TaskItem) => {
    if (window.confirm(`Excluir a tarefa "${task.title}"?`)) deleteTask(task);
  };

  const open = tasks.filter((t) => !t.done);
  const closed = tasks.filter((t) => t.done);
  const overdue = (iso?: string) => iso !== undefined && new Date(iso).getTime() < now;

  return (
    <div>
      <div className="task-add">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Nova tarefa…" aria-label="Título da tarefa" />
        <CustomSelect className="select" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">{tags.map((t) => <option key={t}>{t}</option>)}</CustomSelect>
        <CustomSelect className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Responsável"><option value="">Sem responsável</option>{team.map((m) => <option key={m.id}>{m.name}</option>)}</CustomSelect>
        <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Prazo" />
        <button type="button" className="btn btn-solid" disabled={!title.trim()} onClick={add}>Adicionar</button>
      </div>

      {tasks.length === 0 && <EmptyState title={empty?.title ?? 'Nenhuma tarefa'}>{empty?.text ?? 'As tarefas dos requisitos e dos passos do ciclo de vida aparecem aqui.'}</EmptyState>}
      <ul className="task-list">
        {[...open, ...closed].map((t) => editing === t.id ? (
          <li key={t.id} className="task-row task-editing">
            <span />
            <div className="task-edit">
              <input className="input" value={draft.title} autoFocus onChange={(e) => setDraft({ ...draft, title: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(t); } if (e.key === 'Escape') setEditing(null); }} aria-label="Título da tarefa" />
              <CustomSelect className="select" value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })} aria-label="Responsável"><option value="">Sem responsável</option>{team.map((m) => <option key={m.id}>{m.name}</option>)}</CustomSelect>
              <input className="input" type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} aria-label="Prazo" />
            </div>
            <div className="tag-row">
              <button type="button" className="btn btn-solid" disabled={!draft.title.trim()} onClick={() => saveEdit(t)}>Salvar</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)} aria-label="Cancelar edição"><X size={14} /></button>
            </div>
          </li>
        ) : (
          <li key={t.id} className={`task-row ${t.done ? 'done' : ''}`}>
            <button type="button" className="task-check" onClick={() => toggle(t.id)} aria-label={t.done ? 'Reabrir' : 'Concluir'}>{t.done ? <Check size={14} /> : <Circle size={14} />}</button>
            <div className="cell-stack">
              <span className="cell-primary">{t.title}</span>
              <span className="text-xs text-muted">
                {t.assignee ?? 'Sem responsável'}
                {t.dueAt && <> · <span className={!t.done && overdue(t.dueAt) ? 'overdue' : ''}>prazo {formatDate(t.dueAt)}</span></>}
                {t.done && t.doneAt && <> · concluída em {formatDate(t.doneAt)}</>}
              </span>
            </div>
            <div className="tag-row"><TaskStatusPicker task={t} onChange={(s) => setTaskStatus(t, s)} /><TagChip name={t.tag} category="TASK" /><LabelBadge>{t.source === 'passo' ? 'Passo do ciclo' : t.source === 'requisito' ? 'Requisito' : 'Manual'}</LabelBadge>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(t)} aria-label="Editar tarefa"><Pencil size={14} /></button>
              {/* Tarefa de requisito não se exclui: o gate a recriaria na próxima checagem. */}
              {canDeleteTask(t) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(t)} aria-label="Excluir tarefa"><Trash2 size={14} /></button>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
