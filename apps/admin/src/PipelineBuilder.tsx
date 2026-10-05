import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { LifecycleTemplate, StageKind } from './domain';
import { buildPipeline, colorFor, stageDraftsOf } from './lib/pipelineTemplate';
import type { StageDraft } from './lib/pipelineTemplate';
import { newId, useStore } from './lib/store';
import { useSyncMode } from './lib/workflowSync';
import { useShell } from './lib/shell';
import { pipelinesStore } from './mocks/pipelines';
import { templatesStore } from './mocks/templates';
import { Badge, Field, Page, PageHeader, SampleBanner } from './components/ui';
import { CustomSelect } from './components/ui';

const KIND_LABEL: Record<StageKind, string> = { LEAD: 'Lead', OPEN: 'Aberta', WON: 'Ganha', LOST: 'Perdida' };

/** Ponto de partida sem passos: só as etapas básicas. */
const BLANK: LifecycleTemplate = {
  id: 'tpl-blank', name: 'Em branco', kind: 'SALE', builtIn: true, version: 1,
  description: 'Só as etapas básicas, sem requisitos nem passos. Você monta tudo depois.',
  stages: [{ name: 'Novos', kind: 'LEAD', color: '#94a3b8' }, { name: 'Qualificação', kind: 'OPEN', color: '#f59e0b' }, { name: 'Ganho', kind: 'WON', color: '#10b981' }, { name: 'Perdido', kind: 'LOST', color: '#ef4444' }],
  requirements: [], steps: [],
};

export default function PipelineBuilder({ onBack }: { onBack: () => void }) {
  const { navigate } = useShell();
  const [, setPipelines] = useStore(pipelinesStore);
  const syncMode = useSyncMode();
  const [templates] = useStore(templatesStore);
  const saleTemplates = useMemo(() => [...templates.filter((t) => t.kind === 'SALE'), BLANK], [templates]);
  const postSaleTemplates = templates.filter((t) => t.kind === 'POST_SALE');

  const [templateId, setTemplateId] = useState(saleTemplates[0].id);
  const [postSaleId, setPostSaleId] = useState(postSaleTemplates[0]?.id ?? '');
  const [name, setName] = useState('');
  const [offer, setOffer] = useState('');
  const [stages, setStages] = useState<StageDraft[]>(() => stageDraftsOf(saleTemplates[0]));

  const template = saleTemplates.find((t) => t.id === templateId) ?? BLANK;
  const postSale = postSaleTemplates.find((t) => t.id === postSaleId);

  const pick = (t: LifecycleTemplate) => { setTemplateId(t.id); setStages(stageDraftsOf(t)); };
  const setStage = (key: string, change: Partial<StageDraft>) => setStages((prev) => prev.map((s) => (s.key === key ? { ...s, ...change } : s)));

  const move = (i: number, delta: number) =>
    setStages((prev) => {
      const t = i + delta;
      if (t < 0 || t >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[t]] = [next[t], next[i]];
      return next;
    });

  const addStage = () =>
    setStages((prev) => {
      const at = prev.findIndex((s) => s.kind === 'WON' || s.kind === 'LOST');
      const next = [...prev];
      next.splice(at === -1 ? next.length : at, 0, { key: newId('d'), name: 'Nova etapa', kind: 'OPEN', color: colorFor('OPEN') });
      return next;
    });

  const problem = useMemo(() => {
    if (!name.trim()) return 'Dê um nome à pipeline.';
    if (!stages.some((s) => s.kind === 'WON')) return 'Falta uma etapa do tipo Ganha.';
    if (!stages.some((s) => s.kind === 'LOST')) return 'Falta uma etapa do tipo Perdida.';
    if (!stages.some((s) => s.kind === 'OPEN')) return 'Falta ao menos uma etapa Aberta.';
    return null;
  }, [name, stages]);

  const droppedRequirements = template.requirements.filter((r) => !stages.some((s) => s.ref === r.stageName)).length;
  const droppedSteps = template.steps.filter((s) => s.stageName && !stages.some((d) => d.ref === s.stageName)).length;

  const save = () => {
    if (problem) return;
    const built = buildPipeline(name, offer, template, stages, postSale);
    const pipeline = template.id === BLANK.id ? { ...built, templateId: undefined } : built;
    setPipelines((prev) => [...prev, pipeline]);
    navigate(`/oportunidades/pipelines/${pipeline.id}`);
  };

  return (
    <Page>
      <PageHeader
        back={{ label: 'Configurações das pipelines', to: '/oportunidades/pipelines' }}
        title="Nova pipeline"
        subtitle="Cada pipeline é um funil ligado a uma oferta. Escolha um template de ciclo de vida: ele é copiado para a pipeline e você edita a cópia depois."
      />
      {syncMode !== 'api' && <SampleBanner phase={1}>A pipeline nova só existe até recarregar a página.</SampleBanner>}

      <div className="form-stack" style={{ maxWidth: '860px' }}>
        <div>
          <h3 className="section-title">Template de ciclo de vida</h3>
          <div className="template-pick">
            {saleTemplates.map((t) => (
              <button key={t.id} type="button" className={`pick-card ${t.id === templateId ? 'active' : ''}`} onClick={() => pick(t)} aria-pressed={t.id === templateId}>
                <strong>{t.name}</strong>
                <span className="text-xs text-muted">{t.description}</span>
                <span className="tag-row"><Badge>{t.steps.length} passos</Badge><Badge>{t.stages.length} etapas</Badge><Badge>{t.requirements.length} requisitos</Badge></span>
              </button>
            ))}
          </div>
          {postSaleTemplates.length > 0 && (
            <label className="check-row" style={{ marginTop: '12px' }}>
              <input type="checkbox" checked={postSaleId !== ''} onChange={(e) => setPostSaleId(e.target.checked ? postSaleTemplates[0].id : '')} />
              <span><strong>Encadear pós-venda</strong><span className="text-xs text-muted" style={{ display: 'block' }}>{postSale ? `${postSale.name}: ${postSale.description}` : 'Sem pós-venda depois do ganho.'}</span></span>
            </label>
          )}
        </div>

        <div className="form-grid">
          <Field label="Nome da pipeline"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Parcerias B2B Q4" autoFocus /></Field>
          <Field label="Oferta" hint="O que este funil vende."><input className="input" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Ex.: Programa de parcerias" /></Field>
        </div>

        <div>
          <div className="pane-head" style={{ marginBottom: '8px' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Etapas do funil</h3>
            <button type="button" className="btn" onClick={addStage}><Plus size={14} /> Adicionar etapa</button>
          </div>
          <ul className="row-list">
            {stages.map((s, i) => (
              <li key={s.key} className="row-item">
                <span className="mini-dot" style={{ background: s.color }} />
                <input className="input" value={s.name} onChange={(e) => setStage(s.key, { name: e.target.value })} aria-label="Nome da etapa" />
                <CustomSelect className="select" style={{ width: '130px' }} value={s.kind} onChange={(e) => setStage(s.key, { kind: e.target.value as StageKind, color: colorFor(e.target.value as StageKind) })} aria-label="Tipo da etapa">
                  {(Object.keys(KIND_LABEL) as StageKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </CustomSelect>
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp size={13} /></button>
                <button type="button" className="icon-btn" disabled={i === stages.length - 1} onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown size={13} /></button>
                <button type="button" className="icon-btn bare" disabled={stages.length <= 3} onClick={() => setStages((prev) => prev.filter((x) => x.key !== s.key))} aria-label={`Remover ${s.name}`}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </div>

        <div className="task-callout" role="note">
          <Sparkles size={16} />
          <div>
            <strong>O que vem junto</strong>
            <div className="text-xs">
              {template.requirements.length} requisitos de etapa e {template.steps.length + (postSale?.steps.length ?? 0)} passos de ciclo de vida, como cópia editável. Depois, conecte uma fonte e ajuste tudo nas configurações da pipeline.
              {(droppedRequirements > 0 || droppedSteps > 0) && ` Como você removeu etapas do template, ${droppedRequirements} requisitos e ${droppedSteps} passos que dependiam delas ficam de fora.`}
            </div>
          </div>
        </div>

        {problem && <div className="text-sm text-muted" role="status">{problem}</div>}
        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onBack}>Cancelar</button>
          <button type="button" className="btn btn-solid" disabled={problem !== null} onClick={save}>Criar pipeline</button>
        </div>
      </div>
    </Page>
  );
}
