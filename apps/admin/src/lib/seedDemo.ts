// Semeadura de exemplo no servidor (D37): só em desenvolvimento, com VITE_SEED_DEMO=1 no build do Vite.
// Em produção a variável não existe e um servidor vazio continua vazio: o admin mostra estados vazios
// em vez de gravar funis, leads, pessoas e empresas de exemplo no banco real.
export const SEED_DEMO: boolean = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SEED_DEMO === '1';
