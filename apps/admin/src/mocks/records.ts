// Registros de exemplo para "seguir um registro" na página do workflow (fase 4 do plano).

export type TrackedRecord = {
  id: string;
  name: string;
  kind: 'lead' | 'opportunity';
  pipelineId: string;
  stageId: string;
  /** Requisitos já cumpridos na etapa atual. Os das etapas anteriores contam como cumpridos. */
  done: string[];
};

export const trackedRecords: TrackedRecord[] = [
  { id: 't1', name: 'Renata Moura', kind: 'lead', pipelineId: 'q4', stageId: 'q4:novos', done: [] },
  { id: 't2', name: 'Consultoria de Vendas Q4', kind: 'opportunity', pipelineId: 'q4', stageId: 'q4:proposta', done: [] },
  { id: 't3', name: 'Grupo Vértice', kind: 'opportunity', pipelineId: 'q4', stageId: 'q4:negociacao', done: [] },
  { id: 't4', name: 'Instituto Aurora', kind: 'lead', pipelineId: 'b2b', stageId: 'b2b:novos', done: [] },
  { id: 't5', name: 'Casa do Código Aberto', kind: 'opportunity', pipelineId: 'b2b', stageId: 'b2b:negociacao', done: [] },
  { id: 't6', name: 'Tatiane Freitas', kind: 'lead', pipelineId: 'exp26', stageId: 'exp26:novos', done: [] },
];
