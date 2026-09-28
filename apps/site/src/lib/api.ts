// URL da API em Go. Sobrescreva com API_URL (env do servidor, sem NEXT_PUBLIC_ porque as
// páginas do blog rodam no servidor/build, não no navegador). Mesmo padrão do apps/admin.
export const API_URL: string = process.env.API_URL ?? "http://localhost:8080";
