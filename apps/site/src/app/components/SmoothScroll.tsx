"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* Rolagem controlada no computador (pedido do dono em 06/11): a roda do mouse desliza em vez de pular, com o Lenis.
 * Ele continua movendo a rolagem nativa da janela, então position: sticky, cortinas, palcos e o cabeçalho seguem funcionando.
 * Fica de fora: telas de até 1100 px, toque, movimento reduzido e as telas de formulário e de administração.
 * A biblioteca só é baixada depois da pintura, e só onde vai ser usada. Não renderiza nada.
 *
 * Freio nos palcos (pedido do dono em 09/11): dentro de um trecho preso com animação de rolagem ([data-live] mais alto que a tela, como
 * os palcos da Advisory, os passos e as histórias das páginas de produto), cada giro da roda anda menos e a rolagem não pode correr
 * muito à frente do que está na tela. Assim um giro forte não atravessa a animação de uma vez. Fora dos palcos nada muda. */
const OFF_ROUTES = ["/admin", "/preview", "/diagnostico"];

const LERP = 0.11;
const STAGE_LERP = 0.08; /* um pouco mais macio dentro do palco */
const STAGE_WHEEL = 0.5; /* metade do passo da roda */
const STAGE_LEAD = 0.3; /* no máximo 30% da altura da tela à frente do que já foi mostrado */

/* Faixas de rolagem (em px do documento) em que algum palco está preso na tela. */
function stageRanges() {
  const vh = window.innerHeight;
  return [...document.querySelectorAll<HTMLElement>("[data-live]")]
    .filter((el) => el.offsetHeight > vh * 1.2)
    .map((el) => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      return [top, top + el.offsetHeight - vh] as const;
    });
}

type LenisLike = { destroy: () => void; targetScroll: number; animatedScroll: number; options: { lerp?: number } };

export default function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (OFF_ROUTES.some((route) => pathname.startsWith(route))) return;
    const allowed = window.matchMedia("(min-width: 1101px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let lenis: LenisLike | null = null;
    let cancelled = false;

    /* A instância fica em window.__lenis para quem precisa rolar por código (o índice clicável de "O que construímos"). */
    const shared = window as unknown as { __lenis?: LenisLike };
    const stop = () => {
      if (shared.__lenis === lenis) delete shared.__lenis;
      lenis?.destroy();
      lenis = null;
    };
    const sync = async () => {
      if (!allowed.matches) return stop();
      if (lenis) return;
      const { default: Lenis } = await import("lenis");
      if (cancelled || !allowed.matches || lenis) return;
      const instance: LenisLike = new Lenis({
        autoRaf: true,
        lerp: LERP,
        wheelMultiplier: 0.9,
        allowNestedScroll: true,
        anchors: { offset: -96 },
        prevent: (node: HTMLElement) => Boolean(node.closest?.("[data-lenis-prevent]")),
        /* Chamado a cada giro, antes de a Lenis somar o passo ao destino: pode encurtar o passo (data.deltaY). */
        virtualScroll: (data: { deltaY: number; event: Event }) => {
          if (!data.event.type.includes("wheel") || !data.deltaY) return true;
          const from = instance.targetScroll;
          const to = from + data.deltaY;
          const lo = Math.min(from, to);
          const hi = Math.max(from, to);
          const inStage = stageRanges().some(([a, b]) => hi >= a && lo <= b);
          instance.options.lerp = inStage ? STAGE_LERP : LERP;
          if (!inStage) return true;
          const maxLead = window.innerHeight * STAGE_LEAD;
          const lead = from - instance.animatedScroll; /* quanto o destino já está à frente do que está na tela */
          let delta = data.deltaY * STAGE_WHEEL;
          delta = Math.max(-maxLead - lead, Math.min(maxLead - lead, delta));
          if (Math.sign(delta) !== Math.sign(data.deltaY) || Math.abs(delta) < 0.5) {
            /* Já está no limite: segura este giro (sem deixar a rolagem nativa passar) e espera a tela alcançar. */
            if (data.event.cancelable) data.event.preventDefault();
            return false;
          }
          data.deltaY = delta;
          return true;
        },
      });
      lenis = instance;
      shared.__lenis = instance;
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
