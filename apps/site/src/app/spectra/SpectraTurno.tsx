"use client";

import { useEffect, useRef, useState } from "react";
import s from "./turno.module.css";

/* "Um turno visto pelo Spectra", no material da página: Imperial profundo, linhas em ouro, retratos como medalhas e a ficha como
 * a placa de uma peça de museu. A seção fica presa na tela e a rolagem conta a história:
 *   0    → 0.34  a pena de ouro traça as linhas da esquerda para a direita (um recorte que cresce);
 *   0.34 → 0.44  as medalhas aparecem nas pontas, ainda em mármore (cinza);
 *   0.44 → 1     uma pessoa por vez: a medalha ganha cor, a linha acende e a placa troca; as outras ficam apagadas.
 * Sem JS (e no primeiro HTML) aparece tudo com a placa da Ana. Pessoas e números são ilustrativos.
 * O turno é o da plataforma: 06:00 → 15:48, com o almoço das 11:30 às 12:30 (tela "Turnos de gravação"). */

type Pessoa = {
  id: string;
  nome: string;
  posto: string;
  foto: string;
  v: number[];
  evento: number;
  escada?: boolean;
  prod: string;
  prodSub: string;
  ret: string;
  casa: string;
  casaSub: string;
  nota: string;
};

const T = [0, 45, 90, 135, 180, 225, 270, 330, 390, 440, 490, 540, 588]; // minutos desde 06:00
const PESSOAS: Pessoa[] = [
  {
    id: "ana", nome: "Ana Ribeiro", posto: "Torneamento, turno 1", foto: "/spectra/pessoas/ana.webp",
    v: [70, 71, 69, 72, 73, 74, 81, 85, 88, 90, 91, 93, 94], evento: 6,
    prod: "94%", prodSub: "+14 pts sobre o padrão", ret: "R$ 3,8 mil", casa: "6 anos", casaSub: "desde 2020",
    nota: "Às 10h15 o Spectra viu a Ana trocar a ferramenta em 4 minutos, não em 11. Virou o padrão do posto.",
  },
  {
    id: "marcos", nome: "Marcos Teixeira", posto: "Montagem, turno 1", foto: "/spectra/pessoas/marcos.webp",
    v: [80, 83, 79, 84, 80, 83, 81, 84, 79, 83, 81, 84, 82], evento: 9,
    prod: "82%", prodSub: "+2 pts sobre o padrão", ret: "R$ 1,2 mil", casa: "22 anos", casaSub: "desde 2003",
    nota: "A linha dele anda colada na tracejada porque o padrão da montagem foi aprendido com o jeito dele.",
  },
  {
    id: "lucas", nome: "Lucas Prado", posto: "Inspeção, turno 1", foto: "/spectra/pessoas/lucas.webp", escada: true,
    v: [55, 55, 57, 57, 60, 60, 62, 63, 63, 66, 66, 69, 71], evento: 9,
    prod: "71%", prodSub: "+16 pts no mês", ret: "R$ 2,1 mil", casa: "8 meses", casaSub: "desde março",
    nota: "Cada degrau é um comportamento validado. Ele aprende pelo padrão do Marcos, sem esperar o Marcos ensinar.",
  },
];
const PADRAO = 80;
const ROMANOS = ["I", "II", "III"];

/* Geometria do SVG (unidades do viewBox). As pontas param em X1; a sobra à direita é das medalhas e do rótulo do padrão. */
const W = 900, H = 600, X0 = 8, X1 = 700, Y_TOP = 64, Y_BOT = 548, R = 46;
const X = (m: number) => X0 + (m / 588) * (X1 - X0);
const Y = (p: number) => Y_BOT - ((p - 50) / 50) * (Y_BOT - Y_TOP);
const HORAS: [number, string][] = [[0, "06h"], [120, "08h"], [240, "10h"], [360, "12h"], [480, "14h"], [588, "15h48"]];

function caminho(p: Pessoa) {
  const pts = p.v.map((v, i) => [X(T[i]), Y(v)] as const);
  let d = `M0 ${pts[0][1].toFixed(1)} L${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (const [x, y] of pts.slice(1)) d += p.escada ? ` H${x.toFixed(1)} V${y.toFixed(1)}` : ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  return { d, pts };
}
const LINHAS = PESSOAS.map((p) => ({ ...p, ...caminho(p) }));

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const DESENHO = 0.34, MEDALHAS = 0.44;

export default function SpectraTurno() {
  const sec = useRef<HTMLElement>(null);
  const corte = useRef<SVGRectElement>(null);
  const pena = useRef<SVGLineElement>(null);
  const [fase, setFase] = useState(1); /* 0 = traçando, 1..3 = placa de cada pessoa */
  const [medalhas, setMedalhas] = useState(true);

  useEffect(() => {
    const el = sec.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = total > 0 ? clamp(-r.top / total) : 1;
      const d = clamp(p / DESENHO);
      const x = String(W * d);
      corte.current?.setAttribute("width", x);
      /* a pena: um fio vertical de luz que corre junto com o traço e some no fim */
      pena.current?.setAttribute("x1", x);
      pena.current?.setAttribute("x2", x);
      pena.current?.setAttribute("opacity", d > 0.01 && d < 0.99 ? "1" : "0");
      setMedalhas(p >= DESENHO);
      setFase(p < MEDALHAS ? 0 : Math.min(3, 1 + Math.floor(((p - MEDALHAS) / (1 - MEDALHAS)) * 3)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const ativo = fase > 0 ? PESSOAS[fase - 1].id : null;

  return (
    <section ref={sec} className={s.turno} data-tone="dark" data-live aria-labelledby="spectra-turno">
      {/* data-state num filho: tira a seção da entrada por rolagem da /solucoes, que forçaria opacidade 1 em tudo. */}
      <div className={s.pin} data-state={ativo ?? "tracando"}>
        <div className={s.wrap}>
          <div className={s.texto}>
            <p className={s.label}>Um turno visto pelo Spectra</p>
            <h2 id="spectra-turno">
              <span>Cada linha é uma pessoa.</span>
              <span className={s.ouro}>A tracejada é o padrão.</span>
            </h2>

            {/* Placas: todas na mesma célula, só a ativa aparece (a altura não muda entre as fases) */}
            <div className={s.placas}>
              <div className={s.legenda} data-on={fase === 0}>
                <p><i className={s.legTracejado} /> o padrão do posto, que o Spectra aprendeu</p>
                <p><i className={s.legLinha} /> uma pessoa, do início ao fim do turno</p>
                <p><i className={s.legAnel} /> o momento em que um jeito melhor foi validado</p>
              </div>
              {PESSOAS.map((p, i) => (
                <article key={p.id} className={s.placa} data-on={fase === i + 1} aria-hidden={fase !== i + 1}>
                  <header>
                    <span className={s.romano}>{ROMANOS[i]}</span>
                    <div>
                      <h3>{p.nome}</h3>
                      <p className={s.posto}>{p.posto}</p>
                    </div>
                  </header>
                  <dl className={s.metrics}>
                    <div><dt>Produtividade</dt><dd><strong>{p.prod}</strong><small>{p.prodSub}</small></dd></div>
                    <div><dt>Retorno</dt><dd><strong>{p.ret}</strong><small>recuperados no mês</small></dd></div>
                    <div><dt>Tempo de casa</dt><dd><strong>{p.casa}</strong><small>{p.casaSub}</small></dd></div>
                  </dl>
                  <p className={s.nota}><i aria-hidden="true" />{p.nota}</p>
                </article>
              ))}
            </div>
            <p className={s.aviso}>Exemplo ilustrativo</p>
          </div>

          <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Produtividade de três pessoas ao longo de um turno, comparada com o padrão do posto">
            <defs>
              <clipPath id="turno-corte">
                <rect ref={corte} x="0" y="0" width={W} height={H} />
              </clipPath>
              <linearGradient id="turno-pena" gradientUnits="userSpaceOnUse" x1="0" y1={Y_TOP - 24} x2="0" y2={Y_BOT}>
                <stop offset="0" stopColor="#e7d3a6" stopOpacity="0" />
                <stop offset=".5" stopColor="#e7d3a6" stopOpacity=".9" />
                <stop offset="1" stopColor="#e7d3a6" stopOpacity="0" />
              </linearGradient>
              {LINHAS.map((p) => {
                const [tx, ty] = p.pts[p.pts.length - 1];
                return (
                  <clipPath key={p.id} id={`turno-foto-${p.id}`}>
                    <circle cx={tx} cy={ty} r={R} />
                  </clipPath>
                );
              })}
            </defs>

            {/* grade, almoço e horas: fixos */}
            <g className={s.grid}>
              {[50, 60, 70, 80, 90, 100].map((v) => <line key={v} x1="0" x2={W} y1={Y(v)} y2={Y(v)} />)}
            </g>
            <rect className={s.almoco} x={X(330)} y={Y_TOP - 24} width={X(390) - X(330)} height={Y_BOT - Y_TOP + 24} />
            <g className={s.horas}>
              {HORAS.map(([m, h]) => <text key={m} x={X(m)} y={H - 14} textAnchor={m === 588 ? "middle" : m === 0 ? "start" : "middle"}>{h}</text>)}
              <text x={(X(330) + X(390)) / 2} y={Y_TOP - 34} textAnchor="middle">almoço</text>
            </g>

            {/* o que a pena traça */}
            <g clipPath="url(#turno-corte)">
              <line className={s.padrao} x1="0" x2={W - 84} y1={Y(PADRAO)} y2={Y(PADRAO)} />
              <text className={s.padraoRotulo} x={W} y={Y(PADRAO) + 4} textAnchor="end">padrão</text>
              {LINHAS.map((p) => (
                <g key={p.id} className={s.pessoa} data-dim={ativo !== null && ativo !== p.id} data-ativo={ativo === p.id}>
                  <path d={p.d} />
                  {p.pts.slice(0, -1).map(([x, y], i) =>
                    i === p.evento ? <circle key={i} className={s.evento} cx={x} cy={y} r="8" /> : <circle key={i} cx={x} cy={y} r="3.2" />,
                  )}
                </g>
              ))}
            </g>
            <line ref={pena} className={s.pena} x1={W} x2={W} y1={Y_TOP - 24} y2={Y_BOT} stroke="url(#turno-pena)" opacity="0" />

            {/* medalhas nas pontas: mármore (cinza) até a pessoa entrar em foco */}
            {LINHAS.map((p) => {
              const [tx, ty] = p.pts[p.pts.length - 1];
              return (
                <g key={p.id} className={s.medalha} data-on={medalhas} data-ativo={ativo === p.id} data-dim={ativo !== null && ativo !== p.id} style={{ transformOrigin: `${tx}px ${ty}px` }}>
                  <circle className={s.aroFora} cx={tx} cy={ty} r={R + 9} />
                  <circle className={s.aroDentro} cx={tx} cy={ty} r={R + 3} />
                  <image href={p.foto} x={tx - R} y={ty - R} width={R * 2} height={R * 2} clipPath={`url(#turno-foto-${p.id})`} preserveAspectRatio="xMidYMid slice" />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}
