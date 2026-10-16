"use client";

import styles from "./ChallengeBento.module.css";

// 01. Trabalho Manual: Loop de tarefas / engrenagens de processo em rotação
export function ManualWorkSvg() {
  return (
    <div className={styles.svgWrapper} aria-hidden="true">
      <svg
        viewBox="0 0 400 400"
        className={styles.svgManual}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="200"
          cy="200"
          r="150"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="8 8"
          className={styles.rotateCwSlow}
        />
        <circle
          cx="200"
          cy="200"
          r="105"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="4 6"
          className={styles.rotateCcwSlow}
        />
        <circle
          cx="200"
          cy="200"
          r="65"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeDasharray="14 10"
          className={styles.rotateCwFast}
        />
        <circle
          cx="200"
          cy="200"
          r="28"
          stroke="var(--accent, #b6644d)"
          strokeWidth="1.5"
          opacity="0.45"
        />
        <g className={styles.pulsePoint}>
          <circle cx="350" cy="200" r="5" fill="var(--accent, #b6644d)" />
          <circle cx="200" cy="50" r="4.5" fill="var(--accent, #b6644d)" />
          <circle cx="50" cy="200" r="4.5" fill="var(--accent, #b6644d)" />
          <circle cx="200" cy="350" r="5" fill="var(--accent, #b6644d)" />
        </g>
      </svg>
    </div>
  );
}

// 02. IA Superficial: Nódulos isolados com fluxo contínuo e rede que não fecha o loop
export function SuperficialAiSvg() {
  return (
    <div className={styles.svgWrapper} aria-hidden="true">
      <svg
        viewBox="0 0 400 400"
        className={styles.svgAi}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="aiCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent, #b6644d)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Órbita de nódulos satélites que giram suavemente */}
        <g className={styles.rotateCwSlow}>
          <circle cx="200" cy="200" r="120" stroke="currentColor" strokeWidth="1" strokeDasharray="5 8" opacity="0.45" />
          <circle cx="320" cy="200" r="6" fill="var(--accent, #b6644d)" />
          <circle cx="80" cy="200" r="5" fill="currentColor" opacity="0.6" />
        </g>

        <g className={styles.rotateCcwSlow}>
          <circle cx="200" cy="200" r="75" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 6" opacity="0.35" />
          <circle cx="200" cy="125" r="5.5" fill="var(--accent, #b6644d)" />
          <circle cx="200" cy="275" r="4.5" fill="currentColor" opacity="0.6" />
        </g>

        {/* Conexões pontilhadas de fluxo contínuo */}
        <path
          d="M 90 140 Q 180 70 270 140 T 350 200"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="6 6"
          className={styles.dashFlowForward}
        />
        <path
          d="M 80 260 Q 200 290 320 220"
          stroke="var(--accent, #b6644d)"
          strokeWidth="1.2"
          strokeDasharray="5 7"
          className={styles.dashFlowBack}
        />

        {/* Núcleo de IA central com halo pulsante */}
        <circle cx="200" cy="200" r="45" fill="url(#aiCoreGlow)" className={styles.ambientGlowPulse} />
        <circle cx="200" cy="200" r="22" stroke="var(--accent, #b6644d)" strokeWidth="1.5" className={styles.synapsePulse} />
        <circle cx="200" cy="200" r="8" fill="var(--accent, #b6644d)" />
        <circle cx="200" cy="200" r="3" fill="#ffffff" />
      </svg>
    </div>
  );
}

// 03. Operação Desconectada: Visualizador de Dessincronia e Ritmos Operacionais (Linhas Contínuas e Infinitas)
export function DisconnectedOpsSvg() {
  return (
    <div className={styles.svgWrapper} aria-hidden="true">
      <svg
        viewBox="0 0 540 260"
        className={styles.svgOps}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="opsGradLine1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent, #b6644d)" stopOpacity="0.2" />
            <stop offset="50%" stopColor="var(--accent, #b6644d)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--accent, #b6644d)" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="opsGradLine2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#28183b" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#28183b" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#28183b" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="opsGradLine3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a88a58" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#a88a58" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#a88a58" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Linhas de referência de medição / Grid de precisão */}
        <line x1="0" y1="60" x2="540" y2="60" stroke="#eee6dc" strokeWidth="0.8" strokeDasharray="2 4" />
        <line x1="0" y1="125" x2="540" y2="125" stroke="#eee6dc" strokeWidth="0.8" strokeDasharray="2 4" />
        <line x1="0" y1="190" x2="540" y2="190" stroke="#eee6dc" strokeWidth="0.8" strokeDasharray="2 4" />

        {/* Marcadores verticais de fase (mostrando o descompasso entre as 3 trilhas) */}
        <line x1="140" y1="35" x2="140" y2="215" stroke="#e4ded5" strokeWidth="1" strokeDasharray="3 4" />
        <line x1="310" y1="35" x2="310" y2="215" stroke="#e4ded5" strokeWidth="1" strokeDasharray="3 4" />
        <line x1="460" y1="35" x2="460" y2="215" stroke="#e4ded5" strokeWidth="1" strokeDasharray="3 4" />

        {/* Indicadores sutis de descompasso vertical */}
        <circle cx="140" cy="60" r="3" fill="var(--accent, #b6644d)" opacity="0.6" />
        <circle cx="140" cy="125" r="2.5" fill="#28183b" opacity="0.4" />
        <circle cx="140" cy="190" r="3" fill="#a88a58" opacity="0.5" />

        {/* Trilha 1: Pessoas — Ritmo Lento, Orgânico e Cadenciado (Período 160px em loop contínuo) */}
        <g className={styles.waveStream1}>
          <path
            d="M -160 60 C -120 38, -120 38, -80 60 C -40 82, -40 82, 0 60 C 40 38, 40 38, 80 60 C 120 82, 120 82, 160 60 C 200 38, 200 38, 240 60 C 280 82, 280 82, 320 60 C 360 38, 360 38, 400 60 C 440 82, 440 82, 480 60 C 520 38, 520 38, 560 60 C 600 82, 600 82, 640 60 C 680 38, 680 38, 720 60"
            stroke="url(#opsGradLine1)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Pulsos luminosos que viajam junto com a onda */}
          <circle cx="0" cy="60" r="5" fill="var(--accent, #b6644d)" />
          <circle cx="160" cy="60" r="5" fill="var(--accent, #b6644d)" />
          <circle cx="320" cy="60" r="5" fill="var(--accent, #b6644d)" />
          <circle cx="480" cy="60" r="5" fill="var(--accent, #b6644d)" />
        </g>

        {/* Trilha 2: Processos — Ritmo Intermediário, Estruturado e Pontilhado (Período 110px em loop contínuo) */}
        <g className={styles.waveStream2}>
          <path
            d="M -110 125 C -82.5 111, -82.5 111, -55 125 C -27.5 139, -27.5 139, 0 125 C 27.5 111, 27.5 111, 55 125 C 82.5 139, 82.5 139, 110 125 C 137.5 111, 137.5 111, 165 125 C 192.5 139, 192.5 139, 220 125 C 247.5 111, 247.5 111, 275 125 C 302.5 139, 302.5 139, 330 125 C 357.5 111, 357.5 111, 385 125 C 412.5 139, 412.5 139, 440 125 C 467.5 111, 467.5 111, 495 125 C 522.5 139, 522.5 139, 550 125 C 577.5 111, 577.5 111, 605 125 C 632.5 139, 632.5 139, 660 125 C 687.5 111, 687.5 111, 715 125"
            stroke="url(#opsGradLine2)"
            strokeWidth="1.6"
            strokeDasharray="6 5"
          />
          <circle cx="55" cy="125" r="4" fill="#28183b" opacity="0.6" />
          <circle cx="165" cy="125" r="4" fill="#28183b" opacity="0.6" />
          <circle cx="275" cy="125" r="4" fill="#28183b" opacity="0.6" />
          <circle cx="385" cy="125" r="4" fill="#28183b" opacity="0.6" />
          <circle cx="495" cy="125" r="4" fill="#28183b" opacity="0.6" />
        </g>

        {/* Trilha 3: Tecnologia — Alta Frequência, Ágil e Digital (Período 70px em loop contínuo) */}
        <g className={styles.waveStream3}>
          <path
            d="M -70 190 C -52.5 172, -52.5 172, -35 190 C -17.5 208, -17.5 208, 0 190 C 17.5 172, 17.5 172, 35 190 C 52.5 208, 52.5 208, 70 190 C 87.5 172, 87.5 172, 105 190 C 122.5 208, 122.5 208, 140 190 C 157.5 172, 157.5 172, 175 190 C 192.5 208, 192.5 208, 210 190 C 227.5 172, 227.5 172, 245 190 C 262.5 208, 262.5 208, 280 190 C 297.5 172, 297.5 172, 315 190 C 332.5 208, 332.5 208, 350 190 C 367.5 172, 367.5 172, 385 190 C 402.5 208, 402.5 208, 420 190 C 437.5 172, 437.5 172, 455 190 C 472.5 208, 472.5 208, 490 190 C 507.5 172, 507.5 172, 525 190 C 542.5 208, 542.5 208, 560 190 C 577.5 172, 577.5 172, 595 190 C 612.5 208, 612.5 208, 630 190 C 647.5 172, 647.5 172, 665 190"
            stroke="url(#opsGradLine3)"
            strokeWidth="1.4"
          />
          <circle cx="70" cy="190" r="3.5" fill="#a88a58" />
          <circle cx="210" cy="190" r="3.5" fill="#a88a58" />
          <circle cx="350" cy="190" r="3.5" fill="#a88a58" />
          <circle cx="490" cy="190" r="3.5" fill="#a88a58" />
        </g>
      </svg>
    </div>
  );
}

// 04. Manifesto: Alinhamento harmônico e convergência para o topo
export function ManifestoSvg() {
  return (
    <div className={styles.svgWrapper} aria-hidden="true">
      <svg
        viewBox="0 0 780 320"
        className={styles.svgManifesto}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="manifestoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent, #b6644d)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
          </linearGradient>
          <radialGradient id="manifestoGlow" cx="82%" cy="45%" r="60%">
            <stop offset="0%" stopColor="var(--accent, #b6644d)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="780" height="320" fill="url(#manifestoGlow)" className={styles.ambientGlowPulse} />
        <path d="M 80 0 L 540 160 L 780 0" stroke="url(#manifestoGrad)" strokeWidth="1" opacity="0.4" />
        <path d="M 0 160 L 540 160 L 780 160" stroke="url(#manifestoGrad)" strokeWidth="1.5" strokeDasharray="6 5" className={styles.dashFlowForward} />
        <path d="M 80 320 L 540 160 L 780 320" stroke="url(#manifestoGrad)" strokeWidth="1" opacity="0.4" />
        <g className={styles.centerStarGlow}>
          <circle cx="540" cy="160" r="48" stroke="var(--accent, #b6644d)" strokeWidth="1" opacity="0.25" />
          <circle cx="540" cy="160" r="16" fill="var(--accent, #b6644d)" opacity="0.6" />
          <circle cx="540" cy="160" r="5" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
}
