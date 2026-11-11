import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api";

const MAX_BODY_BYTES = 8 * 1024; // 8 KB (mesmo teto de public_leads.go)

function resolveUpstreamUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_LEAD_ENDPOINT?.trim() ?? "";
  if (/^https?:\/\//i.test(explicit)) {
    return explicit.includes("/api/")
      ? explicit
      : `${explicit.replace(/\/+$/, "")}/api/public/leads`;
  }
  return `${API_URL.replace(/\/+$/, "")}/api/public/leads`;
}

// Proxy server-side para POST /api/public/leads na API Go.
// Faz a chamada servidor-para-servidor (sem cabeçalho Origin de navegador), evitando
// bloqueios de CORS ("origem não permitida") entre www.kalidash.com, kalidash.com e previews.
export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const forwardedFor =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
  if (forwardedFor) {
    headers["X-Forwarded-For"] = forwardedFor;
  }
  // Navegador de quem enviou: a API de Conversões da Meta usa (client_user_agent) para casar o lead.
  const userAgent = request.headers.get("user-agent") || "";
  if (userAgent) {
    headers["X-Client-User-Agent"] = userAgent.slice(0, 400);
  }

  try {
    const upstream = await fetch(resolveUpstreamUrl(), {
      method: "POST",
      headers,
      body: rawBody,
      cache: "no-store",
    });

    const text = await upstream.text();
    return new NextResponse(text || JSON.stringify({ ok: upstream.ok }), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
}
