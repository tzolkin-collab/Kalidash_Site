"use client";
import { useEffect, useState } from "react";
import { ADMIN_ORIGINS } from "@/lib/adminOrigins";

/* Ponte de preview com o admin (o admin embute estas rotas num iframe).
 *  admin -> site: { type: "kalidash:preview", kind, payload }   (rascunho, sem salvar)
 *  site -> admin: { type: "kalidash:preview-ready", kind }      (pede o rascunho atual)
 *                 { type: "kalidash:focus", kind, focus, blockId?, text? } (clique no preview)
 * Só aceita mensagens vindas de ADMIN_ORIGINS e só responde para elas. */
export function usePreviewData<T>(kind: "gallery" | "article"): T | null {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    const tell = (msg: Record<string, unknown>) => {
      if (window.parent === window) return;
      for (const origin of ADMIN_ORIGINS) window.parent.postMessage(msg, origin);
    };

    const onMessage = (e: MessageEvent) => {
      if (!ADMIN_ORIGINS.includes(e.origin)) return;
      const m = e.data as { type?: string; kind?: string; payload?: T } | null;
      if (m?.type === "kalidash:preview" && m.kind === kind) setData(m.payload ?? null);
    };

    // Clique no preview: não navega; avisa o admin o que foi clicado pra ele focar o campo.
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("a")) e.preventDefault();
      const zone = target.closest<HTMLElement>("[data-focus]");
      if (!zone) return;
      const textEl = target.closest<HTMLElement>("p,h1,h2,h3,li,blockquote,figcaption,div");
      tell({
        type: "kalidash:focus",
        kind,
        focus: zone.dataset.focus,
        blockId: zone.dataset.blockId,
        text: (textEl && textEl !== zone ? textEl.textContent : "")?.trim().slice(0, 200),
      });
    };

    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick, true);
    tell({ type: "kalidash:preview-ready", kind });
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
    };
  }, [kind]);

  return data;
}
