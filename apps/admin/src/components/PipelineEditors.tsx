import { useEffect, useState, useMemo } from 'react';
import { Bell, ExternalLink, Link2, Sparkles, Trash2 } from 'lucide-react';
import type { Pipeline, Requirement, RequirementGate, RequirementKind, Source, SourceType } from '../domain';
import { loadProjects, updateProject, useApiProjects } from '../lib/connectSync';
import { useLiveSources } from '../lib/projectSources';
import { connectBody, currentPipelineOf, firstLeadStage } from '../lib/sourceLink';
import { newId, useStore } from '../lib/store';
import { EVENTS, automationsStore } from '../mocks/automations';
import type { AutomationRow } from '../mocks/automations';
import { pipelinesStore } from '../mocks/pipelines';
import { projectsStore } from '../mocks/projects';
import { teamStore } from '../mocks/team';
import { Field, SidePanel } from './ui';
import { CustomSelect } from './ui';

// Painéis de edição do funil usados nos DOIS lugares onde se configura um funil: as Configurações das
// pipelines e o workflow (página Tarefas). Um só código, para o workflow nunca virar uma cópia que
// mostra o que o sistema não faz.

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = { FORM: 'Formulário conectado', MANUAL: 'Cadastro manual', IMPORT: 'Importação de planilha', API: 'API' };

/* ------------------------------ Fonte ------------------------------ */

/**
 * Conectar uma fonte. Com a API ligada (B-05), a lista é a dos PROJETOS reais (GET /api/projects) e conectar grava
 * `pipelineId`, `stageId` (1ª etapa Lead do funil) e `sourceName` no projeto: essa é a única fonte de verdade, e as
 * fontes do funil são derivadas dela. No modo exemplo, lista os formulários de exemplo e cria a automação gerenciada
 * (que só existe nesta aba do navegador).
 */
export function ConnectSourcePanel({ pipeline, onClose, onConnect }: { pipeline: Pipeline; onClose: () => void; onConnect: (s: Source) => void }) {
  const live = useLiveSources();
  const apiProjects = useApiProjects();
  const [projects] = useStore(projectsStore);
  const [pipelines] = useStore(pipelinesStore);
  const [, setAutomations] = useStore(automationsStore);
  const [type, setType] = useState<SourceType>('FORM');
  const [formId, setFormId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (live) void loadProjects(); }, [live]);

  // Exemplo
  const forms = useMemo(() => projects.flatMap((pr) => pr.forms.map((f) => ({ form: f, project: pr }))), [projects]);
  const usedBy = (id: string) => pipelines.find((p) => p.sources.some((s) => s.formId === id));
  const picked = forms.find((f) => f.form.id === formId);
  const formModule = picked?.project.modules.find((m) => m.name === 'Formulário');
  // Real
  const realProjects = apiProjects.data ?? [];
  const realPicked = realProjects.find((p) => p.id === formId);
  const movedFrom = realPicked && realPicked.pipelineId !== pipeline.id ? currentPipelineOf(realPicked, pipelines) : undefined;

  const hasLeadStage = Boolean(firstLeadStage(pipeline));
  const valid = type !== 'FORM'
    ? name.trim() !== ''
    : live ? Boolean(realPicked) && realPicked!.pipelineId !== pipeline.id && hasLeadStage : formId !== '' && !usedBy(formId);

  const connect = async () => {
    if (type === 'FORM' && live && realPicked) {
      const body = connectBody(realPicked, pipeline, name);
      if ('error' in body) { setError(body.error); return; }
      setBusy(true);
      setError(null);
      const res = await updateProject(realPicked.id, body);
      setBusy(false);
      if ('error' in res) setError(res.error);
      else onClose(); // as fontes do funil se refazem a partir do projeto (lib/projectSources.ts)
      return;
    }
    const source: Source = type === 'FORM' && picked
      ? { id: newId('src'), name: name.trim() || picked.form.name, type, project: picked.project.name, formId: picked.form.id, active: true }
      : { id: newId('src'), name: name.trim(), type, active: true };
    if (type !== 'MANUAL' && !live) {
      setAutomations((prev) => [{
        id: newId('au'), name: `Criar lead a partir de "${source.name}"`, category: 'Fontes', trigger: 'Formulário enviado', action: 'Criar lead',
        triggerId: 'formulario.enviado', actionId: 'lead.criar', detail: `Pipeline ${pipeline.name}, etapa Novos`, pipeline: pipeline.name,
        origin: 'MANAGED', managedBy: `Conectar fonte: ${source.name}`, active: true, runs: 0,
      }, ...prev]);
    }
    onConnect(source);
  };

  return (
    <SidePanel
      title="Conectar fonte"
      subtitle={live
        ? `Os envios do formulário passam a criar leads na primeira etapa de Lead de ${pipeline.name}.`
        : `Alimenta a pipeline ${pipeline.name}. Exemplo: a automação criada aqui só existe neste navegador e some ao recarregar.`}
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!valid || busy} onClick={() => void connect()}>{busy ? 'Conectando…' : 'Conectar'}</button></>}
    >
      <div className="form-stack">
        <Field label="Tipo de fonte">
          <CustomSelect className="select" value={type} onChange={(e) => { setType(e.target.value as SourceType); setFormId(''); setError(null); }}>
            {(Object.keys(SOURCE_TYPE_LABEL) as SourceType[]).map((t) => <option key={t} value={t}>{SOURCE_TYPE_LABEL[t]}</option>)}
          </CustomSelect>
        </Field>
        {type === 'FORM' && live ? (
          <>
            <Field label="Projeto e formulário" hint="Vem dos projetos conectados de verdade. Um projeto alimenta um só funil: ao conectar aqui, ele deixa de alimentar o anterior.">
              <CustomSelect className="select" value={formId} onChange={(e) => setFormId(e.target.value)}>
                <option value="">{apiProjects.status === 'loading' && !apiProjects.data ? 'Carregando…' : 'Escolha um projeto…'}</option>
                {realProjects.map((pr) => (
                  <option key={pr.id} value={pr.id} disabled={pr.pipelineId === pipeline.id}>
                    {pr.name}{pr.forms.length ? ` › ${pr.forms.map((f) => f.name).join(', ')}` : ' (sem formulário cadastrado)'}{pr.pipelineId === pipeline.id ? ' (já alimenta este funil)' : ''}
                  </option>
                ))}
              </CustomSelect>
            </Field>
            {apiProjects.status === 'error' && <div className="task-callout" role="alert"><span>Não consegui carregar os projetos: {apiProjects.error}</span></div>}
            {apiProjects.status === 'ready' && realProjects.length === 0 && <div className="task-callout" role="status"><span>Nenhum projeto conectado ainda. Conecte o primeiro em Projetos conectados.</span></div>}
            {!hasLeadStage && <div className="task-callout" role="alert"><span>Este funil não tem uma etapa do tipo Lead. Crie uma antes de conectar um formulário.</span></div>}
            {movedFrom && <div className="task-callout" role="status"><span>Hoje este projeto alimenta "{movedFrom.name}". Ao conectar, ele passa a alimentar só este funil.</span></div>}
            <Field label="Nome da fonte" hint="Opcional. É o nome que aparece na origem dos leads. Sem nome, mantém o do projeto."><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            {error && <div className="task-callout" role="alert"><span>{error}</span></div>}
            <a className="link-inline" href="#/projetos"><ExternalLink size={12} /> Ainda não conectou o site? Vá em Projetos conectados</a>
          </>
        ) : type === 'FORM' ? (
          <>
            <Field label="Formulário rastreado" hint="Exemplo: vem dos projetos de exemplo. Com a API ligada, aqui entram os projetos reais.">
              <CustomSelect className="select" value={formId} onChange={(e) => setFormId(e.target.value)}>
                <option value="">Escolha um formulário…</option>
                {forms.map(({ form, project }) => {
                  const other = usedBy(form.id);
                  return <option key={form.id} value={form.id} disabled={Boolean(other)}>{project.name} › {form.name}{other ? ` (já alimenta ${other.name})` : ''}</option>;
                })}
              </CustomSelect>
            </Field>
            {formModule && formModule.status !== 'ACTIVE' && (
              <div className="task-callout" role="status"><span>O módulo Formulário deste projeto está {formModule.status === 'PENDING' ? 'pendente' : 'com erro'}. A fonte vai valer quando ele ficar ativo.</span></div>
            )}
            <Field label="Nome da fonte" hint="Opcional. Sem nome, usa o do formulário."><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <a className="link-inline" href="#/projetos"><ExternalLink size={12} /> Ainda não conectou o formulário? Vá em Projetos conectados</a>
          </>
        ) : (
          <Field label="Nome da fonte"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        )}
      </div>
    </SidePanel>
  );
}

/* ------------------------------ Tarefa (requisito de etapa) ------------------------------ */

/** Campos do cadastro que dá para marcar como tarefa. */
export const SYSTEM_FIELDS = ['Nome do contato', 'E-mail', 'Telefone', 'CPF ou CNPJ', 'Empresa', 'Valor da oportunidade', 'Prioridade', 'Dono da oportunidade'];

export const GATE_LABEL: Record<RequirementGate, string> = { NONE: 'Só pendência', ENTER: 'Impede entrar', EXIT: 'Impede sair' };

const FIELD_PREFIX = 'Informar ';

/** Eventos que fazem sentido para UMA tarefa específica: os dela, nada mais. */
const taskEvents = (hasDueDays: boolean) => EVENTS.filter((e) => ['tarefa.criada', 'tarefa.atrasada', 'tarefa.concluida'].includes(e.id) && (e.id !== 'tarefa.atrasada' || hasDueDays));

/**
 * Criar ou editar uma tarefa do funil (requisito de etapa). É o mesmo painel nas Configurações do funil e no
 * workflow: dois tipos (campo do cadastro, que conclui quando o campo é preenchido, e ação avulsa), etapa,
 * efeito na etapa (gate), tag, responsável, prazo, aviso por push e, no fim, a oferta de criar uma automação
 * a partir da tarefa. A tarefa não é automação: a automação só nasce se a pessoa pedir.
 */
export function RequirementPanel({ pipeline, requirement, stageId: presetStage, initialField, onClose, onSave, onDelete, onAutomationCreated }: {
  pipeline: Pipeline;
  /** Presente = edição. */
  requirement?: Requirement;
  /** Etapa já escolhida (clique em "Adicionar tarefa" no nó da etapa). */
  stageId?: string;
  /** Campo já escolhido (vem de "Tornar obrigatório" em Campos personalizados). */
  initialField?: string;
  onClose: () => void;
  onSave: (r: Requirement) => void;
  onDelete?: (r: Requirement) => void;
  onAutomationCreated: (requirementId: string, automationId: string) => void;
}) {
  const [automations, setAutomations] = useStore(automationsStore);
  const [team] = useStore(teamStore);
  const stages = pipeline.stages.filter((s) => s.kind === 'LEAD' || s.kind === 'OPEN');
  const editing = Boolean(requirement);

  const parsedField = requirement?.kind === 'FIELD' && requirement.label.startsWith(FIELD_PREFIX) ? requirement.label.slice(FIELD_PREFIX.length) : '';
  const [kind, setKind] = useState<RequirementKind>(requirement?.kind ?? (initialField || !presetStage ? 'FIELD' : 'ACTION'));
  const [field, setField] = useState(parsedField || initialField || '');
  const [title, setTitle] = useState(requirement && !parsedField ? requirement.label : '');
  // Travar a 1ª etapa é inútil: o lead já nasce nela, o ENTER nunca é avaliado. "Tornar obrigatório"
  // por isso mira a 2ª — a 1ª transição real que passa pelo gate.
  const [stageId, setStageId] = useState(requirement?.stageId ?? presetStage ?? (initialField ? stages[1] ?? stages[0] : stages[0])?.id ?? '');
  // Veio de "Tornar obrigatório": o motivo de vir aqui é travar a etapa, então já nasce como gate.
  const [gate, setGate] = useState<RequirementGate>(requirement?.gate ?? (initialField ? 'ENTER' : 'NONE'));
  const [tag, setTag] = useState(requirement?.tag ?? pipeline.taskTags[0] ?? 'Geral');
  const [assignee, setAssignee] = useState(requirement?.assignee ?? '');
  const [dueDays, setDueDays] = useState(requirement?.dueDays !== undefined ? String(requirement.dueDays) : '');
  const [notifyAssignee, setNotifyAssignee] = useState(requirement?.notifyAssignee ?? false);

  const [screen, setScreen] = useState<'form' | 'offer'>('form');
  const [saved, setSaved] = useState<Requirement | null>(null);
  const [event, setEvent] = useState('tarefa.criada');
  const events = taskEvents(dueDays !== '');
  const linked = requirement?.linkedAutomationId ? automations.find((a) => a.id === requirement.linkedAutomationId) : undefined;

  const label = kind === 'FIELD' ? (field ? `${FIELD_PREFIX}${field}` : '') : title.trim();
  const fieldOptions = [...SYSTEM_FIELDS, ...pipeline.customFields.map((f) => f.label)];
  const valid = label !== '' && stageId !== '';

  const build = (): Requirement => ({
    id: requirement?.id ?? newId('req'), stageId, label, tag, kind, gate,
    assignee: assignee.trim() || undefined, dueDays: dueDays === '' ? undefined : Math.max(0, Number(dueDays)),
    notifyAssignee: notifyAssignee && assignee.trim() !== '',
    blocked: requirement?.blocked ?? 0, overdue: requirement?.overdue ?? 0, linkedAutomationId: requirement?.linkedAutomationId,
  });

  const save = () => {
    const req = build();
    onSave(req);
    if (editing) { onClose(); return; }
    setSaved(req);
    setScreen('offer');
  };

  const offerFor = (req: Requirement) => { setSaved(req); setScreen('offer'); };

  const createAutomation = () => {
    if (!saved) return;
    const ev = events.find((e) => e.id === event) ?? events[0];
    const automation: AutomationRow = {
      id: newId('au'), name: `${saved.label}: notificar quando ${ev.label.toLowerCase()}`, category: 'Pendências',
      trigger: ev.label, action: 'Notificar alguém da equipe', triggerId: ev.id, actionId: 'notificar.equipe',
      detail: saved.assignee || 'Responsável pela tarefa', pipeline: pipeline.name,
      origin: 'MANAGED', managedBy: `Tarefa: ${saved.label}`, active: true, runs: 0,
    };
    setAutomations((prev) => [automation, ...prev]);
    onAutomationCreated(saved.id, automation.id);
    onClose();
  };

  if (screen === 'offer' && saved) {
    return (
      <SidePanel
        title="Quer avisar alguém?"
        subtitle={`A tarefa "${saved.label}" foi ${editing ? 'salva' : 'criada'}. O caminho simples já está pronto; o avançado cria uma automação de verdade.`}
        onClose={onClose}
        footer={<><button type="button" className="btn" onClick={onClose}>Não, só a tarefa</button><button type="button" className="btn btn-solid" onClick={createAutomation}><Sparkles size={14} /> Criar automação</button></>}
      >
        <div className="form-stack">
          {saved.notifyAssignee && (
            <div className="task-callout" role="status">
              <Bell size={16} />
              <div><strong>Caminho simples já ligado.</strong><div className="text-xs">{saved.assignee} recebe um push quando esta tarefa nascer. Não precisa configurar nada aqui.</div></div>
            </div>
          )}
          <p className="text-sm text-muted" style={{ margin: 0 }}>Caminho avançado: escolha o evento — a ação (notificar {saved.assignee || 'o responsável'}) já vem pronta.</p>
          <div className="vs-seg" role="radiogroup" aria-label="Evento">
            {events.map((e) => (
              <button key={e.id} type="button" role="radio" aria-checked={event === e.id} className={`vs-seg-btn ${event === e.id ? 'active' : ''}`} onClick={() => setEvent(e.id)}>{e.label}</button>
            ))}
          </div>
        </div>
      </SidePanel>
    );
  }

  return (
    <SidePanel
      title={editing ? 'Editar tarefa' : 'Nova tarefa'}
      subtitle={editing ? `${pipeline.name} · ${pipeline.stages.find((s) => s.id === requirement?.stageId)?.name ?? ''}` : 'Quem estiver na etapa precisa cumprir. A tarefa aparece no workflow e na ficha do registro.'}
      onClose={onClose}
      footer={
        <>
          {editing && onDelete && requirement && (
            <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(requirement)}><Trash2 size={14} /> Excluir</button>
          )}
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-solid" disabled={!valid} onClick={save}>{editing ? 'Salvar' : 'Criar tarefa'}</button>
        </>
      }
    >
      <div className="form-stack">
        <Field label="Tipo" hint={kind === 'FIELD' ? 'Conclui sozinha quando o campo é preenchido.' : 'Uma ação que alguém da equipe faz e marca como feita.'}>
          <div className="vs-seg" role="radiogroup" aria-label="Tipo de tarefa">
            <button type="button" role="radio" aria-checked={kind === 'FIELD'} className={`vs-seg-btn ${kind === 'FIELD' ? 'active' : ''}`} onClick={() => setKind('FIELD')}>Campo do cadastro</button>
            <button type="button" role="radio" aria-checked={kind === 'ACTION'} className={`vs-seg-btn ${kind === 'ACTION' ? 'active' : ''}`} onClick={() => setKind('ACTION')}>Ação</button>
          </div>
        </Field>
        {kind === 'FIELD' ? (
          <Field label="Campo">
            <CustomSelect className="select" value={field} onChange={(e) => setField(e.target.value)}>
              <option value="">Escolha um campo…</option>
              <optgroup label="Campos do sistema">{SYSTEM_FIELDS.map((f) => <option key={f}>{f}</option>)}</optgroup>
              {pipeline.customFields.length > 0 && <optgroup label="Campos personalizados">{pipeline.customFields.map((f) => <option key={f.id}>{f.label}</option>)}</optgroup>}
              {field && !fieldOptions.includes(field) && <option>{field}</option>}
            </CustomSelect>
          </Field>
        ) : (
          <Field label="Título da tarefa"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Enviar proposta" autoFocus={!editing} /></Field>
        )}
        <Field label="Etapa" hint={stageId === stages[0]?.id && gate === 'ENTER' ? 'Cuidado: "Impede entrar" na 1ª etapa não trava nada — o lead já nasce nela.' : undefined}>
          <CustomSelect className="select" value={stageId} onChange={(e) => setStageId(e.target.value)}>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</CustomSelect>
        </Field>
        <Field label="Efeito na etapa" hint="Impede entrar: o registro não chega aqui sem a tarefa concluída. Impede sair: não sai daqui sem ela.">
          <CustomSelect className="select" value={gate} onChange={(e) => setGate(e.target.value as RequirementGate)}>{(Object.keys(GATE_LABEL) as RequirementGate[]).map((g) => <option key={g} value={g}>{GATE_LABEL[g]}</option>)}</CustomSelect>
        </Field>
        <div className="form-grid">
          <Field label="Tag"><CustomSelect className="select" value={tag} onChange={(e) => setTag(e.target.value)}>{[...new Set([...pipeline.taskTags, tag])].map((t) => <option key={t}>{t}</option>)}</CustomSelect></Field>
          <Field label="Prazo (dias)"><input className="input" type="number" min={0} value={dueDays} onChange={(e) => setDueDays(e.target.value)} /></Field>
        </div>
        <Field label="Responsável" hint="Alguém da equipe ou uma função (ex.: Vendedor responsável).">
          <input className="input" list="req-assignees" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Nome ou função" />
          <datalist id="req-assignees">{team.map((m) => <option key={m.id} value={m.name} />)}<option value="Vendedor responsável" /></datalist>
        </Field>
        <label className="check-row">
          <input type="checkbox" checked={notifyAssignee} disabled={assignee.trim() === ''} onChange={(e) => setNotifyAssignee(e.target.checked)} />
          <span>
            <strong>Notificar por push quando esta tarefa for criada</strong>
            <span className="text-xs text-muted" style={{ display: 'block' }}>{assignee.trim() === '' ? 'Defina um responsável para ligar isto.' : `Avisa ${assignee} assim que a tarefa nascer. Não usa Automações.`}</span>
          </span>
        </label>
        {editing && requirement && (
          linked ? (
            <div className="task-callout" role="status"><Link2 size={16} /><div><strong>Automação ligada</strong><div className="text-xs">{linked.name} — {linked.trigger}. Edite em Automações; ela some junto com a tarefa.</div></div></div>
          ) : (
            <button type="button" className="btn" disabled={!valid} onClick={() => { const req = build(); onSave(req); offerFor(req); }}><Sparkles size={14} /> Criar automação a partir desta tarefa</button>
          )
        )}
      </div>
    </SidePanel>
  );
}

/* ------------------------------ Fonte existente ------------------------------ */

/** Ver e ajustar uma fonte já conectada: nome, ligar/desligar, remover (a automação gerenciada vai junto). */
export function SourceDetailPanel({ pipeline, source, onClose, onChange, onRemove }: {
  pipeline: Pipeline;
  source: Source;
  onClose: () => void;
  onChange: (s: Source) => void;
  onRemove: (s: Source) => void;
}) {
  const [, setAutomations] = useStore(automationsStore);
  const live = useLiveSources();
  const [name, setName] = useState(source.name);
  const [active, setActive] = useState(source.active);
  const save = () => {
    const next = name.trim();
    if (next !== source.name) {
      // A automação gerenciada acompanha o nome da fonte (é por ele que ela é achada ao remover).
      setAutomations((prev) => prev.map((a) => (a.managedBy === `Conectar fonte: ${source.name}` ? { ...a, managedBy: `Conectar fonte: ${next}`, name: `Criar lead a partir de "${next}"` } : a)));
    }
    onChange({ ...source, name: next, active });
    onClose();
  };
  return (
    <SidePanel
      title="Fonte"
      subtitle={`${SOURCE_TYPE_LABEL[source.type]} · alimenta ${pipeline.name}`}
      onClose={onClose}
      footer={
        <>
          {!source.derived && <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => onRemove(source)}><Trash2 size={14} /> Remover fonte</button>}
          <button type="button" className="btn" onClick={onClose}>{source.derived ? 'Fechar' : 'Cancelar'}</button>
          {!source.derived && <button type="button" className="btn btn-solid" disabled={!name.trim()} onClick={save}>Salvar</button>}
        </>
      }
    >
      <div className="form-stack">
        <Field label="Nome da fonte"><input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={source.derived} /></Field>
        {source.project && <Field label="Projeto de origem"><div className="text-sm">{source.project}</div></Field>}
        {source.derived && <div className="task-callout" role="status"><Link2 size={16} /><div><strong>Vem do projeto conectado</strong><div className="text-xs">O vínculo com este funil é do projeto. Para trocar de funil ou desconectar, use <a className="link-inline" href="#/projetos">Projetos conectados</a>.</div></div></div>}
        {!source.derived && <label className="check-row">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span><strong>Fonte ativa</strong><span className="text-xs text-muted" style={{ display: 'block' }}>Novos registros entram nesta pipeline.</span></span>
        </label>}
        {source.type !== 'MANUAL' && !source.derived && !live && <div className="task-callout" role="status"><Link2 size={16} /><div><strong>Exemplo de automação</strong><div className="text-xs">"Criar lead a partir de {source.name}" só existe neste navegador (Automações) e some ao recarregar.</div></div></div>}
      </div>
    </SidePanel>
  );
}
