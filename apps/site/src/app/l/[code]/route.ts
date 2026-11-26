import { API_URL } from "@/lib/api";

/* Link curto de divulgação: kalidash.com.br/l/<código> (gerado no admin, página Links; API em
 * apps/api/campaign_links.go). Pergunta à API o destino e as UTMs do código e redireciona (302) para a página com as
 * UTMs na URL; lá o tracking do site (lib/tracking.ts) guarda a atribuição como em qualquer link de campanha.
 * O referrer original (ex.: Instagram) segue no redirecionamento. Código desconhecido ou arquivado leva para a
 * home, sem UTMs: um link antigo num post nunca dá erro. */

const CODE = /^[a-z0-9]{4,16}$/i;

type Resolved = { destination: string; utm: Record<string, string> };

async function resolve(code: string, userAgent: string): Promise<Resolved | null> {
  try {
    const res = await fetch(`${API_URL.replace(/\/+$/, "")}/api/public/links/${encodeURIComponent(code.toLowerCase())}`, {
      cache: "no-store",
      // Navegador de quem clicou: a API não conta clique de robô de prévia (WhatsApp, LinkedIn...).
      headers: { "X-Client-User-Agent": userAgent.slice(0, 400) },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Resolved;
    // A API só grava caminhos do site; conferir de novo impede que um destino adulterado vire redirecionamento aberto.
    if (typeof data.destination !== "string" || !data.destination.startsWith("/") || data.destination.startsWith("//")) return null;
    return data;
  } catch {
    return null;
  }
}

function redirect(to: URL): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: to.toString(), "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const here = new URL(request.url);
  const found = CODE.test(code) ? await resolve(code, request.headers.get("user-agent") ?? "") : null;
  if (!found) return redirect(new URL("/", here));

  const to = new URL(found.destination, here);
  for (const [k, v] of Object.entries(found.utm ?? {})) {
    if (k.startsWith("utm_") && v) to.searchParams.set(k, v);
  }
  return redirect(to);
}
