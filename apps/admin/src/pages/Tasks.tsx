import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, Lock, Plug } from 'lucide-react';
import type { Pipeline, Stage } from '../domain';
import { pipelineStats } from '../lib/pipelineStats';
import { useShell } from '../lib/shell';
import { useStore } from '../lib/store';
import { pipelinesStore } from '../mocks/pipelines';
import { Badge, EmptyState, Page, PageHeader, SampleBanner, SearchBox } from '../components/ui';

function MiniWorkflow({ pipeline }: { pipeline: Pipeline }) {
  const reqsByStage = (s: Stage) => pipeline.requirements.filter((r) => r.stageId === s.id);
  return (
    <div className="mini-flow" aria-label="Miniatura do workflow">
      <span className={`mini-source ${pipeline.sources.length === 0 ? 'empty' : ''}`} title={pipeline.sources.length ? pipeline.sources.map((s) => s.name).join(', ') : 'Sem fonte conectada'}>
        <Plug size={11} /> {pipeline.sources.length}
      </span>
      {pipeline.stages.map((s) => {
        const reqs = reqsByStage(s);
        const gated = reqs.some((r) => r.gate !== 'NONE');
        return (
          <span key={s.id} className="mini-stage-wrap">
            <ChevronRight size={11} className="mini-arrow" />
            <span className="mini-stage" title={`${s.name}: ${reqs.length} ${reqs.length === 1 ? 'tarefa' : 'tarefas'}`}>
              <span className="mini-dot" style={{ background: s.color }} />
              <span className="mini-name">{s.name}</span>
              {reqs.length > 0 && <span className="mini-count">{gated && <Lock size={9} />}{reqs.length}</span>}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default function Tasks() {
  const { navigate } = useShell();
  const [pipelines] = useStore(pipelinesStore);
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');

  const tags = useMemo(() => [...new Set(pipelines.flatMap((p) => p.taskTags))].sort(), [pipelines]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pipelines.filter((p) => (!tag || p.taskTags.includes(tag)) && (!q || `${p.name} ${p.offer}`.toLowerCase().includes(q)));
  }, [pipelines, search, tag]);

  return (
    <Page>
      <PageHeader title="Tarefas" subtitle="Cada funil desenhado de ponta a ponta: fontes, etapas e o que a equipe precisa cumprir em cada uma. Abra um card para ver o workflow." />
      <SampleBanner phase={4} />

      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder="Buscar funil ou oferta…" />
        <select className="select select-sm" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filtrar por tag de tarefa">
          <option value="">Todas as tags de tarefa</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum funil encontrado">Ajuste a busca. Novos funis nascem em Oportunidades, com "Criar nova Pipeline".</EmptyState>
      ) : (
        <div className="funnel-grid">
          {filtered.map((p) => {
            const st = pipelineStats(p);
            return (
              <button key={p.id} type="button" className="funnel-card" onClick={() => navigate(`/tarefas/${p.id}`)}>
                <div className="funnel-card-head">
                  <div className="cell-stack">
                    <span className="funnel-card-title">{p.name}</span>
                    <span className="text-xs text-muted">{p.offer}</span>
                  </div>
                  {p.sources.length === 0 && <Badge tone="warning" title="Nenhuma fonte alimenta este funil"><AlertTriangle size={11} /> Sem fonte</Badge>}
                </div>
                <MiniWorkflow pipeline={p} />
                <div className="funnel-card-stats">
                  <div><strong>{st.records}</strong><span>registros</span></div>
                  <div><strong>{st.tasks}</strong><span>tarefas</span></div>
                  <div className={st.overdue ? 'is-warn' : ''}><strong>{st.overdue}</strong><span>atrasadas</span></div>
                  <div className={st.blocked ? 'is-danger' : ''}><strong>{st.blocked}</strong><span>bloqueados</span></div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Page>
  );
}
