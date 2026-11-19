"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./toc.module.css";

/* Índice lateral do artigo, no jeito do Notion: na borda direita, um traço curto por título do texto (h2 e h3),
 * com o da seção atual em destaque; ao passar o mouse (ou focar pelo teclado) os traços viram a lista com os
 * nomes, e o clique leva até o título. Lê os títulos do HTML já renderizado em [data-block="article-body"] e dá
 * um id a quem não tiver. Os traços são roxos e vão ficando dourados conforme a seção é lida. No desktop (1200px+)
 * ficam na borda direita, no meio da tela, com a lista ao passar o mouse; abaixo disso ficam só os traços, no canto
 * inferior esquerdo, na altura do botão do WhatsApp (que fica no direito). Com 2 títulos ou mais, enquanto o texto está na tela. */

type Heading = { id: string; text: string; level: 2 | 3 };

const OFFSET = 112; // altura do cabeçalho fixo + folga

const slugify = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "secao";

export default function ArticleToc({ watch }: { watch: string }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [inBody, setInBody] = useState(false);
  const [progress, setProgress] = useState<number[]>([]);

  useEffect(() => {
    const body = document.querySelector<HTMLElement>('[data-block="article-body"]');
    if (!body) return;
    const used = new Set<string>();
    const list: Heading[] = [];
    body.querySelectorAll<HTMLHeadingElement>("h2, h3").forEach((el) => {
      const text = el.textContent?.trim() ?? "";
      if (!text) return;
      // títulos de blocos interativos (ex.: o formulário de material, "Pronto, tudo certo") não são seções
      if (el.closest("form, [hidden], [aria-hidden='true'], [data-gate], [class*='gate']") || el.id.startsWith("gate")) return;
      if (el.getClientRects().length === 0) return; // escondido
      const base = el.id || slugify(text);
      let id = base;
      for (let n = 2; used.has(id) || (!el.id && document.getElementById(id)); n++) id = `${base}-${n}`;
      used.add(id);
      el.id = id;
      list.push({ id, text, level: el.tagName === "H3" ? 3 : 2 });
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeadings(list);
    if (list.length < 2) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = body.getBoundingClientRect();
      setInBody(rect.top < window.innerHeight * 0.6 && rect.bottom > window.innerHeight * 0.4);
      // a seção atual é a do último título que já passou do primeiro quarto da tela
      const line = Math.max(OFFSET + 8, window.innerHeight * 0.25);
      let current: string | null = list[0].id;
      const tops = list.map((h) => document.getElementById(h.id)?.getBoundingClientRect().top ?? Infinity);
      tops.forEach((top, i) => {
        if (top <= line) current = list[i].id;
      });
      setActive(current);
      // quanto de cada seção já foi lido (0 a 1): do título dela até o próximo título (a última, até o fim do texto)
      setProgress(
        tops.map((start, i) => {
          const end = i + 1 < tops.length ? tops[i + 1] : rect.bottom;
          if (!Number.isFinite(start) || end <= start) return start <= line ? 1 : 0;
          return Math.min(1, Math.max(0, (line - start) / (end - start)));
        }),
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [watch]);

  if (headings.length < 2) return null;

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - OFFSET, behavior: reduce ? "auto" : "smooth" });
    history.replaceState(null, "", `#${id}`);
    setActive(id);
  };

  return (
    <nav className={styles.rail} data-visible={inBody ? "true" : "false"} aria-label="Neste artigo">
      <ol className={styles.lines} aria-hidden="true">
        {headings.map((h, i) => (
          <li
            key={h.id}
            data-level={h.level}
            data-active={active === h.id ? "true" : undefined}
            style={{ "--read": progress[i] ?? 0 } as CSSProperties}
          />
        ))}
      </ol>
      <div className={styles.panel}>
        <p className={styles.panelTitle}>Neste artigo</p>
        <ol>
          {headings.map((h) => (
            <li key={h.id} data-level={h.level}>
              <a
                href={`#${h.id}`}
                aria-current={active === h.id ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  go(h.id);
                }}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
