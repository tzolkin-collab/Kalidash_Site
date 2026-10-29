"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ExperienceSyncGallery.module.css";

interface PhotoItem {
  src: string;
  alt: string;
  tag?: string;
}

// Fotos e legendas enviadas pela Carol em 20/10/2026 (doc "Copy site - V3 - Imagens").
const ROW_1: PhotoItem[] = [
  { src: "/home/g01-cupula.jpg", alt: "A Cúpula ∙ Governança e segurança de dados", tag: "A Cúpula ∙ Governança e segurança de dados" },
  { src: "/home/g02-zig.jpg", alt: "ZIG ∙ IA para Financeiro e Processos", tag: "ZIG ∙ IA para Financeiro e Processos" },
  { src: "/home/g03-imersao-claude.jpg", alt: "Imersão presencial de Claude", tag: "Imersão presencial de Claude" },
  { src: "/home/g04-quimica.jpg", alt: "Química Anastácio ∙ IA para lideranças", tag: "Química Anastácio ∙ IA para lideranças" },
  { src: "/home/g05-sao-carlos.jpg", alt: "São Carlos Experience", tag: "São Carlos Experience" },
  { src: "/home/g06-saam.jpg", alt: "SAAM Towage ∙ IA para alta liderança", tag: "SAAM Towage ∙ IA para alta liderança" },
  { src: "/home/g07-cooxupe.jpg", alt: "Cooxupé ∙ N8N para T.I", tag: "Cooxupé ∙ N8N para T.I" },
  { src: "/home/g08-clealco.jpg", alt: "Clealco ∙ IA para alta liderança", tag: "Clealco ∙ IA para alta liderança" },
  { src: "/home/g09-nexa.jpg", alt: "Nexa Resources ∙ IA para jurídico", tag: "Nexa Resources ∙ IA para jurídico" },
  // Fotos novas enviadas pela Carol em 21/10/2026 (Drive "fotos dos treinamentos").
  { src: "/home/g17-fdc-tech-week-1.jpg", alt: "Fundação Dom Cabral ∙ Tech Week", tag: "Fundação Dom Cabral ∙ Tech Week" },
  { src: "/home/g19-sifra-1.jpg", alt: "Grupo Sifra ∙ Treinamento de Claude e Lovable", tag: "Grupo Sifra ∙ Treinamento de Claude e Lovable" },
  { src: "/home/g21-cba-premio.jpg", alt: "CBA ∙ Finalista Prêmio Inovativos 2026", tag: "CBA ∙ Finalista Prêmio Inovativos 2026" },
];

const ROW_2: PhotoItem[] = [
  { src: "/home/g10-agir.jpg", alt: "Agir Saúde ∙ Segurança cibernética para a alta diretoria", tag: "Agir Saúde ∙ Segurança cibernética para a alta diretoria" },
  { src: "/home/g11-conquer.jpg", alt: "Conquer ∙ A era da IA", tag: "Conquer ∙ A era da IA" },
  { src: "/home/g12-totvs.jpg", alt: "Totvs ∙ Liderança & Gestão de projetos", tag: "Totvs ∙ Liderança & Gestão de projetos" },
  { src: "/home/g13-bigdata.jpg", alt: "Big Data Experience", tag: "Big Data Experience" },
  { src: "/home/g14-sicoob.jpg", alt: "Sicoob ∙ IA para alta liderança", tag: "Sicoob ∙ IA para alta liderança" },
  { src: "/home/g15-sky.jpg", alt: "SKY ∙ IA para produtos", tag: "SKY ∙ IA para produtos" },
  { src: "/home/g16-votorantim.jpg", alt: "Votorantim ∙ Análise de Dados suportada por IA", tag: "Votorantim ∙ Análise de Dados suportada por IA" },
  { src: "/home/evento-sala.jpg", alt: "Treinamento Corporativo", tag: "Treinamento Corporativo" },
  { src: "/home/g18-fdc-tech-week-2.jpg", alt: "Fundação Dom Cabral ∙ Tech Week", tag: "Fundação Dom Cabral ∙ Tech Week" },
  { src: "/home/g20-sifra-2.jpg", alt: "Grupo Sifra ∙ Treinamento de Claude e Lovable", tag: "Grupo Sifra ∙ Treinamento de Claude e Lovable" },
];

// Duplicamos as listas para permitir loop contínuo infinito e sem emendas
const FULL_ROW_1 = [...ROW_1, ...ROW_1];
const FULL_ROW_2 = [...ROW_2, ...ROW_2];

export default function ExperienceSyncGallery() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const row1Ref = useRef<HTMLDivElement>(null);
  const row2Ref = useRef<HTMLDivElement>(null);

  const [isHovered, setIsHovered] = useState(false);

  // Posições base iniciais exatamente como na referência da Lastlink
  const currentX1 = useRef<number>(-132.815);
  const currentX2 = useRef<number>(-87.185);

  const ambientOffset = useRef<number>(0);
  const isVisible = useRef<boolean>(true);

  useEffect(() => {
    // Respeito à preferência de redução de movimento do sistema operacional
    if (typeof window === "undefined") return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const wrapEl = wrapRef.current;
    if (!wrapEl) return;

    // Observer de visibilidade para zerar o uso de GPU quando fora da tela
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        isVisible.current = entry.isIntersecting;
      },
      { rootMargin: "250px 0px" }
    );
    observer.observe(wrapEl);

    let animationFrameId: number;

    const tick = () => {
      if (isVisible.current && wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // Progresso do scroll do elemento na tela (0 no rodapé da janela, 1 no topo)
        const totalTravel = windowHeight + rect.height;
        const currentProgress = Math.max(0, Math.min(1, (windowHeight - rect.top) / totalTravel));

        // Deriva sutil contínua quando o cursor não está pausando sobre os cards
        if (!isHovered) {
          ambientOffset.current += 0.35;
        }

        // Card width 280px + 10px gap = 290px. Meio bloco = itens de uma linha * 290px
        const setWidth1 = ROW_1.length * 290;
        const setWidth2 = ROW_2.length * 290;

        // Cálculo de translação com scroll parallax + drift suave
        // Linha 1 corre para a esquerda conforme scrolla para baixo
        const target1 = -132.815 - currentProgress * 420 - ambientOffset.current;
        // Linha 2 corre para a direita (ou contra-fluxo) conforme scrolla
        const target2 = -87.185 + currentProgress * 360 + ambientOffset.current * 0.8;

        // Normalização matemática para wrap infinito
        const wrapValue = (val: number, max: number) => {
          const mod = val % max;
          return mod > 0 ? mod - max : mod;
        };

        const wrapped1 = wrapValue(target1, setWidth1);
        const wrapped2 = wrapValue(target2, setWidth2);

        // Interpolação suave (Lerp) para fluidez de 60-120fps nativa
        currentX1.current += (wrapped1 - currentX1.current) * 0.09;
        currentX2.current += (wrapped2 - currentX2.current) * 0.09;

        if (row1Ref.current) {
          row1Ref.current.style.transform = `translate3d(${currentX1.current.toFixed(2)}px, 0, 0)`;
        }
        if (row2Ref.current) {
          row2Ref.current.style.transform = `translate3d(${currentX2.current.toFixed(2)}px, 0, 0)`;
        }
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, [isHovered]);

  return (
    <div
      ref={wrapRef}
      className={`${styles.syncScrollWrap} sync-scroll-wrap`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Galeria de registros de campo, imersões e workshops da Kalidash"
    >
      {/* Linha 1 */}
      <div
        id="sync-row1"
        ref={row1Ref}
        className={styles.syncRow}
        style={{
          transform: "translate3d(-132.815px, 0, 0)",
        }}
      >
        {FULL_ROW_1.map((item, idx) => (
          <div key={`row1-${idx}`} className={styles.syncCard}>
            <img
              src={item.src}
              alt={item.alt}
              width={280}
              height={184}
              loading="lazy"
              decoding="async"
              className={styles.syncImg}
            />
            <div className={styles.syncVignette} aria-hidden="true" />
            {item.tag && <span className={styles.syncBadge}>{item.tag}</span>}
          </div>
        ))}
      </div>

      {/* Linha 2 */}
      <div
        id="sync-row2"
        ref={row2Ref}
        className={styles.syncRow}
        style={{
          transform: "translate3d(-87.185px, 0, 0)",
        }}
      >
        {FULL_ROW_2.map((item, idx) => (
          <div key={`row2-${idx}`} className={styles.syncCard}>
            <img
              src={item.src}
              alt={item.alt}
              width={280}
              height={184}
              loading="lazy"
              decoding="async"
              className={styles.syncImg}
            />
            <div className={styles.syncVignette} aria-hidden="true" />
            {item.tag && <span className={styles.syncBadge}>{item.tag}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
