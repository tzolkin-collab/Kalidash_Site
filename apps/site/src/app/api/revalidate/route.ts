import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";

// Chamado pela API em Go quando um artigo é criado/editado/excluído, pra /blog e /blog/[slug]
// regenerarem na hora (em vez de esperar o revalidate de 60s). Protegido por REVALIDATE_SECRET
// (o mesmo valor está no .env da API); sem o segredo configurado, o endpoint fica desligado.
export const dynamic = "force-dynamic";

const ALLOWED = /^\/blog(\/[a-z0-9-]+)?$/;

function sameSecret(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return Response.json({ ok: false, error: "desativado" }, { status: 503 });
  if (!sameSecret(request.headers.get("x-revalidate-secret"), secret)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { paths?: unknown } | null;
  const paths = Array.isArray(body?.paths)
    ? (body.paths as unknown[]).filter((p): p is string => typeof p === "string" && ALLOWED.test(p))
    : [];
  for (const path of paths) revalidatePath(path);
  return Response.json({ ok: true, revalidated: paths });
}
