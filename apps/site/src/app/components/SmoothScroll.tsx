"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* Rolagem controlada no computador (pedido do dono em 06/11): a roda do mouse desliza em vez de pular, com o Lenis.
 * Ele continua movendo a rolagem nativa da janela, então position: sticky, cortinas, palcos e o cabeçalho seguem funcionando.
 * Fica de fora: telas de até 1100 px, toque, movimento reduzido e as telas de formulário e de administração.
 * A biblioteca só é baixada depois da pintura, e só onde vai ser usada. Não renderiza nada. */
const OFF_ROUTES = ["/admin", "/preview", "/diagnostico"];

export default function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (OFF_ROUTES.some((route) => pathname.startsWith(route))) return;
    const allowed = window.matchMedia("(min-width: 1101px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let lenis: { destroy: () => void } | null = null;
    let cancelled = false;

    const stop = () => {
      lenis?.destroy();
      lenis = null;
    };
    const sync = async () => {
      if (!allowed.matches) return stop();
      if (lenis) return;
      const { default: Lenis } = await import("lenis");
      if (cancelled || !allowed.matches || lenis) return;
      lenis = new Lenis({
        autoRaf: true,
        lerp: 0.11,
        wheelMultiplier: 0.9,
        allowNestedScroll: true,
        anchors: { offset: -96 },
        prevent: (node: HTMLElement) => Boolean(node.closest?.("[data-lenis-prevent]")),
      });
    };

    void sync();
    allowed.addEventListener("change", sync);
    return () => {
      cancelled = true;
      allowed.removeEventListener("change", sync);
      stop();
    };
  }, [pathname]);

  return null;
}
