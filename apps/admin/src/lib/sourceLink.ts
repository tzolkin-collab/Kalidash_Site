import type { Pipeline, Source } from '../domain';

// Fonte de um funil com a API ligada (B-05). A ÚNICA verdade é o projeto conectado no servidor
// (`ConnectedProject.pipelineId/stageId/sourceName`, GET /api/projects). `Pipeline.config.sources` só guarda
// as fontes que não são formulário (cadastro manual, importação, API); as de formulário são DERIVADAS dos
// projetos na leitura e nunca vão no corpo do PUT do funil. Partes puras, testadas em tests/sourceLink.test.ts.

/** O mínimo do projeto que a derivação e o vínculo usam (ApiProject satisfaz). */
export type LinkedProject = {
  id: string; name: string; url: string; origins: string[]; stack?: string; description?: string;
  pipelineId: string | null; stageId: string | null; sourceName: string; forms?: { name: string }[];
};

export type ProjectInputBody = { name: string; url: string; origins: string[]; stack: string; description: string; pipelineId: string | null; stageId: string | null; sourceName: string };

/** Fonte de formulário que vem de um projeto (id = id do projeto; não é editável pelo funil). */
export const sourceOfProject = (p: LinkedProject): Source => ({ id: p.id, name: p.sourceName || p.name, type: 'FORM', project: p.name, active: true, derived: true });

/** Fontes de formulário de um funil: os projetos que apontam para ele. Nenhum projeto ⇒ lista vazia ("Sem fonte"). */
export const projectSourcesOf = (pipelineId: string, projects: LinkedProject[]): Source[] =>
  projects.filter((p) => p.pipelineId === pipelineId).map(sourceOfProject);

/** O que vai para o servidor em `config.sources`: nunca as de formulário (derivadas do projeto). */
export const writableSources = (sources: Source[]): Source[] => sources.filter((s) => s.type !== 'FORM');

/**
 * Troca, em cada funil, as fontes de formulário pelas derivadas dos projetos. Devolve a MESMA lista (referência)
 * quando nada muda, para quem assina a store não entrar em laço.
 */
export function withProjectSources(pipelines: Pipeline[], projects: LinkedProject[]): Pipeline[] {
  let changed = false;
  const next = pipelines.map((p) => {
    const sources = [...writableSources(p.sources), ...projectSourcesOf(p.id, projects)];
    if (JSON.stringify(sources) === JSON.stringify(p.sources)) return p;
    changed = true;
    return { ...p, sources };
  });
  return changed ? next : pipelines;
}

/** Primeira etapa de tipo Lead do funil (a coluna onde os envios entram), ou undefined se não tem. */
export const firstLeadStage = (p: Pipeline) => p.stages.find((s) => s.kind === 'LEAD');

/** Corpo do PUT /api/projects/{id} que aponta o projeto para o funil (etapa = 1ª de tipo Lead) com o nome da fonte. */
export function connectBody(project: LinkedProject, pipeline: Pipeline, sourceName: string): ProjectInputBody | { error: string } {
  const stage = firstLeadStage(pipeline);
  if (!stage) return { error: 'Este funil não tem uma etapa do tipo Lead. Crie uma antes de conectar um formulário.' };
  return {
    name: project.name, url: project.url, origins: project.origins ?? [], stack: project.stack ?? '', description: project.description ?? '',
    pipelineId: pipeline.id, stageId: stage.id, sourceName: sourceName.trim() || project.sourceName || project.name,
  };
}

/** Corpo do PUT que desconecta a fonte (D40): mantém tudo do projeto e zera funil e coluna. O servidor passa a recusar envios. */
export function disconnectBody(project: LinkedProject): ProjectInputBody {
  return {
    name: project.name, url: project.url, origins: project.origins ?? [], stack: project.stack ?? '', description: project.description ?? '',
    pipelineId: null, stageId: null, sourceName: project.sourceName || project.name,
  };
}

/** Aviso mostrado antes de desconectar (o texto do critério de aceite). */
export const disconnectWarning = (project: LinkedProject) =>
  `Desconectar "${project.name}" deste funil? Novos envios do formulário serão recusados até reconectar. Os leads que já chegaram ficam como estão.`;

/** Funil para onde o projeto aponta hoje (entre os funis conhecidos), para avisar que ele será movido. */
export const currentPipelineOf = (project: LinkedProject, pipelines: Pipeline[]) => pipelines.find((p) => p.id === project.pipelineId);
