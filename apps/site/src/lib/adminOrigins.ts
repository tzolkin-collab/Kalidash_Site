// Origens do admin autorizadas a embutir as rotas /preview/* e a conversar com elas por
// postMessage. NEXT_PUBLIC_ porque o mesmo valor é lido no navegador (checagem de
// event.origin) e no next.config.ts (CSP frame-ancestors).
export const ADMIN_ORIGINS: string[] = (
  process.env.NEXT_PUBLIC_ADMIN_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
