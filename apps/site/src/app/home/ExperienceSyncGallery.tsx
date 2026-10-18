"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ExperienceSyncGallery.module.css";

interface PhotoItem {
  src: string;
  alt: string;
  tag?: string;
}

const ROW_1: PhotoItem[] = [
  { src: "/home/cooxupe.jpg", alt: "Equipe Kalidash na Cooxupé", tag: "Cooxupé • +500 Colaboradores" },
  { src: "/home/evento-palestra.jpg", alt: "Keynote Executivo de Inteligência Artificial", tag: "Keynote Executivo" },
  { src: "/home/evento-sala.jpg", alt: "Imersão Presencial com Lideranças", tag: "Imersão Presencial" },
  { src: "/home/evento-mesa.jpg", alt: "Laboratório Prático de Operações", tag: "Laboratório de Agentes" },
  { src: "/home/evento-ai-os.jpg", alt: "Metodologia AI OS em Apresentação", tag: "Arquitetura AI OS" },
  { src: "/home/metodo-reuniao.jpg", alt: "Alinhamento Estratégico com Diretoria", tag: "Estratégia & Conselho" },
  { src: "/home/depoimento-fundo.jpg", alt: "Auditório e Plenária de Líderes", tag: "Auditório & Ambiência" },
  { src: "/founders-studio.jpg", alt: "Carol e André — Fundadores Kalidash", tag: "Liderança Kalidash" },
  { src: "/home/cooxupe.jpg", alt: "Operação de Campo na Economia Real", tag: "Operação Real" },
  { src: "/home/evento-palestra.jpg", alt: "Masterclass de IA e Produtividade", tag: "Masterclass de IA" },
  { src: "/home/evento-sala.jpg", alt: "Formação de Equipes em Agentes Autônomos", tag: "Capacitação de Times" },
  { src: "/home/evento-mesa.jpg", alt: "Workshops e Sprints de Implementação", tag: "Sprint Prático" },
];

const ROW_2: PhotoItem[] = [
  { src: "/home/metodo-reuniao.jpg", alt: "Desenho Estratégico de Soluções", tag: "Desenho de Soluções" },
  { src: "/home/evento-mesa.jpg", alt: "Validação Prática de Modelos em Tempo Real", tag: "Validação em Tempo Real" },
  { src: "/home/evento-sala.jpg", alt: "Turma Executiva em Treinamento Imersivo", tag: "Treinamento Corporativo" },
  { src: "/home/evento-palestra.jpg", alt: "Palestra: Da Estratégia à Execução", tag: "Execução Prática" },
  { src: "/home/cooxupe.jpg", alt: "Transformação de Processos em Grande Escala", tag: "Registro de Campo" },
  { src: "/home/evento-ai-os.jpg", alt: "Estruturação de Inteligência Operacional", tag: "Framework Kalidash" },
  { src: "/founders-formal.jpg", alt: "Diretoria e Governança Kalidash", tag: "Diretoria & Governança" },
  { src: "/home/depoimento-fundo.jpg", alt: "Encontro com Tomadores de Decisão", tag: "Encontro com C-Levels" },
  { src: "/home/metodo-reuniao.jpg", alt: "Governança e Cultura de Inteligência", tag: "Cultura & Processos" },
  { src: "/home/evento-mesa.jpg", alt: "Laboratório Hands-On com Gestores", tag: "Workshops" },
  { src: "/home/evento-palestra.jpg", alt: "Casos Reais e Resultados Práticos", tag: "Resultados Reais" },
  { src: "/home/cooxupe.jpg", alt: "Vivência de Campo — Operação Real", tag: "Vivência de Campo" },
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

        // Card width 280px + 10px gap = 290px. Meio bloco de 12 itens = 3480px
        const singleSetWidth = 12 * 290;

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

        const wrapped1 = wrapValue(target1, singleSetWidth);
        const wrapped2 = wrapValue(target2, singleSetWidth);

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
