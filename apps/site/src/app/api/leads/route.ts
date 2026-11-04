import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api";

const MAX_BODY_BYTES = 8 * 1024; // 8 KB (mesmo teto de public_leads.go)

// Proxy server-side para POST /api/public/leads na API Go.
// Permite que /diagnostico funcione automaticamente com a mesma variável API_URL usada pelo /blog,
// sem exigir NEXT_PUBLIC_LEAD_ENDPOINT exposto no bundle e sem problemas de CORS entre www/apex.
export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large or empty" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const forwardedFor =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
  if (forwardedFor) {
    headers["X-Forwarded-For"] = forwardedFor;
  }

  const origin = process.env.SITE_URL || request.headers.get("origin") || "";
  if (origin) {
    headers["Origin"] = origin;
  }

  try {
    const upstream = await fetch(`${API_URL}/api/public/leads`, {
      method: "POST",
      headers,
      body: rawBody,
      cache: "no-store",
    });

    const text = await upstream.text();
    return new NextResponse(text || JSON.stringify({ status: upstream.ok ? "ok" : "error" }), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
}
