// URL da API em Go. Sobrescreva com VITE_API_URL (ex.: no .env.local) fora do ambiente local.
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
