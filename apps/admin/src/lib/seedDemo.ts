// Semeadura de exemplo no servidor (D37): só em desenvolvimento, com VITE_SEED_DEMO=1 no build do Vite.
// Em produção a variável não existe e um servidor vazio continua vazio: o admin mostra estados vazios
// em vez de gravar funis, leads, pessoas e empresas de exemplo no banco real.
export const SEED_DEMO: boolean = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SEED_DEMO === '1';

/** Dados de exemplo das telas do núcleo (leads, pessoas, empresas, funis, projetos e chaves): só entram com
 * VITE_SEED_DEMO=1. Sem ela as stores nascem vazias, com a API ligada ou não, e nenhuma tela que já grava
 * na API mostra registro inventado. */
export const demoOnly = <T,>(data: T[]): T[] => (SEED_DEMO ? data : []);
