import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { ReactFlow } from '@xyflow/react';
import type { Pipeline } from '../domain';
import { pipelineStats } from '../lib/pipelineStats';
import { useShell } from '../lib/shell';
import { useStore } from '../lib/store';
import { useSyncMode } from '../lib/workflowSync';
import { pipelinesStore } from '../mocks/pipelines';
import { Badge, EmptyState, Page, PageHeader, SampleBanner, SearchBox } from '../components/ui';
import { buildGraph, nodeTypes } from './TaskWorkflow';
import { CustomSelect } from '../components/ui';

function CardWorkflow({ pipeline }: { pipeline: Pipeline }) {
  const { nodes, edges } = useMemo(() => buildGraph(pipeline, null, () => {}), [pipeline]);
  return (
    <div style={{ width: '800px', height: '180px', pointerEvents: 'none' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        panOnScroll={false}
        zoomOnDoubleClick={false}
        fitView
        proOptions={{ hideAttribution: true }}
      />
    </div>
  );
}

export default function Tasks() {
  const { navigate } = useShell();
  const [pipelines] = useStore(pipelinesStore);
  const syncMode = useSyncMode();
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
      {syncMode !== 'api' && <SampleBanner phase={4} />}

      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder="Buscar funil ou oferta…" />
        <CustomSelect className="select select-sm" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filtrar por tag de tarefa">
          <option value="">Todas as tags de tarefa</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </CustomSelect>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum funil encontrado">Ajuste a busca. Novos funis nascem em Oportunidades, com "Criar nova Pipeline".</EmptyState>
      ) : (
        <div className="funnel-grid">
          {filtered.map((p) => {
            const st = pipelineStats(p);
            return (
              <button key={p.id} type="button" className="funnel-card" onClick={() => navigate(`/tarefas/${p.id}`)}>
                <div className="bento-bg">
                  <CardWorkflow pipeline={p} />
                </div>
                <div className="bento-content">
                  <div className="bento-left">
                    <div className="funnel-card-head">
                      <div className="cell-stack">
                        <span className="funnel-card-title">{p.name}</span>
                        <span className="text-sm text-muted">{p.offer}</span>
                      </div>
                      {p.sources.length === 0 && <Badge tone="warning" title="Nenhuma fonte alimenta este funil"><AlertTriangle size={11} /> Sem fonte</Badge>}
                    </div>
                    <div className="funnel-card-stats">
                      <div><strong>{st.records}</strong><span>registros</span></div>
                      <div><strong>{st.tasks}</strong><span>tarefas</span></div>
                      {st.overdue > 0 && <div className="is-warn"><strong>{st.overdue}</strong><span>atrasadas</span></div>}
                      {st.blocked > 0 && <div className="is-danger"><strong>{st.blocked}</strong><span>bloqueados</span></div>}
                    </div>
                  </div>
                  <div className="bento-right">
                    <div className="bento-cta">
                      Ver workflow <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Page>
  );
}
