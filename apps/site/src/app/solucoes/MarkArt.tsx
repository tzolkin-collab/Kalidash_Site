import type { CSSProperties, ReactNode } from "react";
import a from "./mark-art.module.css";

/* Ilustrações dos quatro passos de "Não entregamos um plano." (Advisory). Cada uma lê um progresso --k (0..1) do <li> dela; cada peça
 * tem a sua janela [--a, --b] dentro desse progresso e anda em linha reta (sem easing), indo e voltando com a rolagem. No palco preso o
 * AdvisoryMotion escreve --k0..--k3, uma janela de rolagem para cada passo, emendadas (sem pausa entre elas). Fora do palco --k vale 1:
 * tudo aparece completo (ou é tocado uma vez ao entrar na tela, ver advisory-motion.module.css). Decorativas: aria-hidden. */

type V = Record<string, number | string>;
const w = (from: number, to: number, extra: V = {}) => ({ "--a": from, "--b": to, ...extra }) as CSSProperties;
const mv = (from: number, to: number, x0: number, y0: number, x1: number, y1: number) => w(from, to, { "--x0": x0, "--y0": y0, "--x1": x1, "--y1": y1 });

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg className={a.art} viewBox="0 0 200 120" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/* 01 · Decidir o que priorizar: o briefing se desfaz em pontos, os pontos viram datas no calendário e as prioridades ganham check no prazo. */
const CELLS = [0, 1, 2, 3].flatMap((col) => [0, 1, 2].map((row) => ({ x: 104 + col * 22, y: 44 + row * 20 })));
const DATES = [1, 3, 6, 8, 11]; /* células que recebem um ponto */
const CHECKED = [1, 6, 11]; /* as que viram prioridade */
const LINES = [36, 48, 60, 72];

function Prioritize() {
  return (
    <Svg>
      <g className={a.out} style={w(0.3, 0.5)}>
        <rect className={a.draw} pathLength={1} x="10" y="18" width="46" height="74" rx="3" style={w(0, 0.12)} />
        <path className={a.draw} pathLength={1} d="M20 26h18" style={w(0.06, 0.14)} />
        {LINES.map((y, i) => (
          <path key={y} className={a.draw} pathLength={1} d={`M20 ${y}h${i % 2 ? 20 : 26}`} style={w(0.08 + i * 0.04, 0.16 + i * 0.04)} />
        ))}
      </g>
      <rect className={a.draw} pathLength={1} x="94" y="16" width="96" height="92" rx="4" style={w(0.12, 0.3)} />
      <path className={a.draw} pathLength={1} d="M94 32h96M114 10v12M170 10v12" style={w(0.2, 0.32)} />
      {CELLS.map((cell, i) => (
        <rect key={i} className={a.faint} x={cell.x - 7} y={cell.y - 7} width="14" height="14" rx="2" style={w(0.24 + i * 0.008, 0.32 + i * 0.008)} />
      ))}
      {DATES.map((cell, i) => {
        const to = CELLS[cell];
        return (
          <circle key={cell} className={a.dot} r="2.6" style={mv(0.32 + i * 0.05, 0.52 + i * 0.05, 26 + (i % 2) * 8, LINES[i % 4], to.x, to.y)} />
        );
      })}
      {CHECKED.map((cell, i) => {
        const c = CELLS[cell];
        return (
          <g key={cell}>
            <rect className={a.fill} x={c.x - 8} y={c.y - 8} width="16" height="16" rx="3" style={w(0.74 + i * 0.08, 0.82 + i * 0.08)} />
            <path className={a.drawInk} pathLength={1} d={`M${c.x - 4} ${c.y}l3 3 5-6`} style={w(0.78 + i * 0.08, 0.86 + i * 0.08)} />
          </g>
        );
      })}
    </Svg>
  );
}

/* 02 · Medir o que funciona: o gráfico se monta e a lupa percorre até o resultado que importa. */
const BARS = [
  { x: 40, h: 30 },
  { x: 72, h: 46 },
  { x: 104, h: 38 },
  { x: 136, h: 64 },
  { x: 168, h: 52 },
];

function Measure() {
  return (
    <Svg>
      <path className={a.draw} pathLength={1} d="M24 12v92h168" style={w(0, 0.14)} />
      {[36, 60, 84].map((y, i) => (
        <path key={y} className={a.faintLine} d={`M24 ${y}h168`} style={w(0.08 + i * 0.03, 0.16 + i * 0.03)} />
      ))}
      {BARS.map((b, i) => (
        <rect key={b.x} className={i === 3 ? a.barKey : a.bar} x={b.x - 8} y={104 - b.h} width="16" height={b.h} rx="2" style={w(0.14 + i * 0.07, 0.3 + i * 0.07)} />
      ))}
      <path className={a.draw} pathLength={1} d={BARS.map((b, i) => `${i ? "L" : "M"}${b.x} ${96 - b.h}`).join("")} style={w(0.46, 0.66)} />
      {BARS.map((b, i) => (
        <circle key={b.x} className={a.pop} cx={b.x} cy={96 - b.h} r="2.4" style={w(0.48 + i * 0.04, 0.54 + i * 0.04)} />
      ))}
      <g className={a.move} style={mv(0.62, 0.9, 40, 70, 136, 32)}>
        <g className={a.fade} style={w(0.6, 0.66)}>
          <circle className={a.lens} cx="0" cy="0" r="13" />
          <path className={a.stroke} d="M9.5 9.5 19 19" strokeWidth="3" />
        </g>
      </g>
      <circle className={a.ring} cx="136" cy="32" r="18" style={w(0.9, 1)} />
    </Svg>
  );
}

/* 03 · Definir responsáveis: o organograma se monta uma pessoa por vez. */
function Person({ x, y, from, to, lead = false }: { x: number; y: number; from: number; to: number; lead?: boolean }) {
  return (
    <g className={a.pop} style={w(from, to)}>
      <circle className={lead ? a.personLead : a.person} cx={x} cy={y - 5} r="5" />
      <path className={lead ? a.personLead : a.person} d={`M${x - 9} ${y + 9}a9 8 0 0 1 18 0`} />
    </g>
  );
}

function Organize() {
  return (
    <Svg>
      <Person x={100} y={16} from={0} to={0.1} lead />
      <path className={a.draw} pathLength={1} d="M100 30v10" style={w(0.1, 0.16)} />
      <path className={a.draw} pathLength={1} d="M40 40h120" style={w(0.16, 0.28)} />
      <path className={a.draw} pathLength={1} d="M40 40v8" style={w(0.24, 0.28)} />
      <Person x={40} y={56} from={0.28} to={0.38} />
      <path className={a.draw} pathLength={1} d="M100 40v8" style={w(0.36, 0.4)} />
      <Person x={100} y={56} from={0.4} to={0.5} />
      <path className={a.draw} pathLength={1} d="M160 40v8" style={w(0.48, 0.52)} />
      <Person x={160} y={56} from={0.52} to={0.62} />
      <path className={a.draw} pathLength={1} d="M40 70v10H22v8M40 80h18v8" style={w(0.62, 0.72)} />
      <Person x={22} y={96} from={0.7} to={0.78} />
      <Person x={58} y={96} from={0.76} to={0.84} />
      <path className={a.draw} pathLength={1} d="M160 70v10H142v8M160 80h18v8" style={w(0.8, 0.88)} />
      <Person x={142} y={96} from={0.86} to={0.93} />
      <Person x={178} y={96} from={0.92} to={1} />
    </Svg>
  );
}

/* 04 · Corrigir a rota: a bússola se forma e a agulha volta a apontar para o norte. */
function Correct() {
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <Svg>
      <circle className={a.draw} pathLength={1} cx="100" cy="62" r="48" style={w(0, 0.2)} />
      <circle className={a.faintLine} cx="100" cy="62" r="40" style={w(0.12, 0.24)} />
      {ticks.map((deg, i) => (
        <path key={deg} className={a.tick} d={`M100 ${deg % 90 ? 20 : 17}v${deg % 90 ? 5 : 8}`} transform={`rotate(${deg} 100 62)`} style={w(0.14 + i * 0.012, 0.2 + i * 0.012)} />
      ))}
      <text className={a.north} x="100" y="11" textAnchor="middle" style={w(0.86, 1)}>N</text>
      <g className={a.fade} style={w(0.26, 0.34)}>
        <g className={a.needle} style={w(0.34, 0.9)}>
          <path className={a.needleN} d="M100 28 107 62H93Z" />
          <path className={a.needleS} d="M100 96 107 62H93Z" />
        </g>
        <circle className={a.hub} cx="100" cy="62" r="3.2" />
      </g>
    </Svg>
  );
}

export const markArts = [Prioritize, Measure, Organize, Correct];
