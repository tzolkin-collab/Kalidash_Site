"use client";

import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import styles from "./build-story.module.css";

/* Telas ilustrativas (sem dado real) das cinco frentes da Execução: um notebook e um celular por frente, em HTML/CSS, sem imagem.
 * Cada tela é uma função do progresso `--s` (0..1): no desktop ele vem da rolagem (BuildStory, só o item ativo); no celular e
 * em tela baixa, cada tela toca uma vez ao entrar na vista (InlineScene). Sem JS ou com movimento reduzido, `--s` não existe e
 * vale 1 (estado final, tudo visível). Cada peça declara quando começa (`--a`) e quanto dura (`--d`); só transform e opacity.
 * Tudo em `em`, e o palco define o `em` pela sua largura. */

/* Peça com início e duração dentro do progresso. */
const at = (a: number, d = 0.2): CSSProperties => ({ ["--a" as string]: a, ["--d" as string]: d });

/* Molduras dos aparelhos: MacBook Pro, iPhone 14 Pro e iPad Pro portados do devices.css (MIT, ver build-story.module.css).
 * O mesmo conteúdo de "notebook" vai no MacBook (desktop) e no iPad (tablet): só a moldura muda, por CSS. */
function Mac({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.mac}>
      <div className={styles.macLid}>
        <i className={styles.macNotch} />
        <div className={styles.macScreen}>
          <div className={styles.macBar}><span>{title}</span></div>
          <div className={styles.macBody}>{children}</div>
        </div>
      </div>
      <div className={styles.macBase} />
    </div>
  );
}

function Phone({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.phone}>
      <div className={styles.phoneFrame}>
        <div className={styles.phoneScreen}>
          <div className={styles.phoneTop}><span>9:41</span><b>{title}</b></div>
          <div className={styles.phoneBody}>{children}</div>
        </div>
      </div>
      <i className={styles.island} />
      <i className={styles.phoneBtns} />
      <i className={styles.phonePower} />
    </div>
  );
}

const Ok = ({ a }: { a: number }) => <b className={`${styles.ok} ${styles.pop}`} style={at(a, 0.1)}>✓</b>;

/* Linha curta da tela do celular: marca, texto e um detalhe à direita. */
function PRow({ a, label, meta }: { a: number; label: string; meta?: string }) {
  return (
    <div className={`${styles.prow} ${styles.rise}`} style={at(a, 0.14)}>
      <Ok a={a + 0.04} />
      <span className={styles.grow}>{label}</span>
      {meta && <span className={styles.muted}>{meta}</span>}
    </div>
  );
}

function Agentes() {
  const rows: Array<[string, string, string, string]> = [
    ["Financeiro", "Pedido de reembolso", "Encaminhado", "done"],
    ["Jurídico", "Segunda via de contrato", "Aguardando aprovação", "wait"],
    ["Operação", "Ajuste de escala", "Em análise", "run"],
    ["Compras", "Cotação de insumo", "Encaminhado", "done"],
  ];
  return (
    <>
      <Mac title="Triagem de solicitações">
        <p className={styles.h}>Solicitações recebidas</p>
        {rows.map(([area, what, status, tone], i) => (
          <div key={what} className={`${styles.row} ${styles.rise}`} style={at(0.04 + i * 0.1, 0.16)}>
            <span className={`${styles.tag} ${styles.pop}`} style={at(0.36 + i * 0.08, 0.12)}>{area}</span>
            <span className={styles.grow}>{what}</span>
            <span className={`${styles.pill} ${styles.pop}`} data-tone={tone} style={at(0.56 + i * 0.07, 0.12)}>{status}</span>
            {tone === "wait" && <i className={`${styles.flag} ${styles.pop}`} style={at(0.78, 0.12)} />}
          </div>
        ))}
        <div className={`${styles.band} ${styles.rise}`} style={at(0.7, 0.2)}>
          <p><b>Resumo do agente.</b> Classificou, priorizou e roteou. O que exige decisão sobe para uma pessoa.</p>
          <span className={styles.pill} data-tone="wait">Supervisão humana</span>
        </div>
      </Mac>
      <Phone title="Assistente">
        <p className={`${styles.bubble} ${styles.rise}`} style={at(0.06, 0.18)}>Preciso da segunda via do contrato.</p>
        <p className={`${styles.bubble} ${styles.rise}`} data-me="true" style={at(0.3, 0.18)}>Encontrei o contrato e encaminhei ao Jurídico.</p>
        <p className={`${styles.note} ${styles.rise}`} style={at(0.5, 0.16)}>Aguardando aprovação de uma pessoa</p>
        <div>
          <PRow a={0.62} label="Reembolso" meta="Financeiro" />
          <PRow a={0.72} label="Cotação" meta="Compras" />
          <PRow a={0.82} label="Escala" meta="Operação" />
        </div>
      </Phone>
    </>
  );
}

function Automacoes() {
  const steps = ["Coleta dos dados", "Consolidação", "Relatório gerado", "Enviado à diretoria"];
  return (
    <>
      <Mac title="Relatório semanal">
        <div className={styles.split}>
          <div>
            <p className={styles.h}>Rotina de segunda, 08:00</p>
            {steps.map((s, i) => (
              <div key={s} className={styles.row}>
                <Ok a={0.1 + i * 0.16} />
                <span className={styles.grow}><span className={styles.struck} style={at(0.1 + i * 0.16, 0.12)}>{s}</span></span>
                <span className={`${styles.muted} ${styles.rise}`} style={at(0.14 + i * 0.16, 0.12)}>automático</span>
              </div>
            ))}
            <p className={`${styles.foot} ${styles.rise}`} style={at(0.84, 0.14)}>Próxima execução: segunda, 08:00</p>
          </div>
          <div className={styles.side}>
            <p className={styles.h}>Pré-visualização</p>
            <div className={styles.doc}>
              <i className={`${styles.sheet} ${styles.rise}`} style={at(0.2, 0.18)} />
              <i className={`${styles.sheet} ${styles.rise}`} style={at(0.4, 0.18)} />
              <i className={`${styles.sheet} ${styles.rise}`} style={at(0.58, 0.18)} />
              <i className={`${styles.sheet} ${styles.rise}`} style={at(0.74, 0.18)} />
              <i className={`${styles.docBar} ${styles.grow2}`} style={at(0.7, 0.2)} />
            </div>
          </div>
        </div>
      </Mac>
      <Phone title="Relatórios">
        <div>
          {steps.map((s, i) => <PRow key={s} a={0.1 + i * 0.16} label={s} />)}
        </div>
        <div className={`${styles.card} ${styles.rise}`} style={at(0.78, 0.2)}>
          <p className={styles.h}>Relatório semanal pronto</p>
          <p className={styles.muted}>14 páginas · enviado às 08:00</p>
        </div>
        <p className={`${styles.note} ${styles.rise}`} style={at(0.9, 0.1)}>Ninguém precisou montar</p>
      </Phone>
    </>
  );
}

function Integracoes() {
  const recs = ["Cliente", "Pedido", "Status de entrega", "Nota fiscal"];
  return (
    <>
      <Mac title="Integrações ativas">
        <div className={styles.link}>
          <div className={styles.node}><b>ERP</b><span>Pedidos · Estoque</span></div>
          <div className={styles.wire}>
            <i className={styles.pulse} style={at(0.1, 0.4)} />
            <i className={styles.pulse} style={at(0.45, 0.4)} />
          </div>
          <div className={`${styles.node} ${styles.pop}`} style={at(0.45, 0.1)}><b>CRM</b><span>Clientes · Funil</span></div>
        </div>
        {recs.map((r, i) => (
          <div key={r} className={styles.row}>
            <Ok a={0.5 + i * 0.1} />
            <span className={styles.grow}>{r}</span>
            <span className={`${styles.muted} ${styles.rise}`} style={at(0.52 + i * 0.1, 0.14)}>{i === 2 ? "há 2 min" : "sincronizado"}</span>
          </div>
        ))}
      </Mac>
      <Phone title="Sincronização">
        <div className={styles.plink}>
          <div className={`${styles.node} ${styles.rise}`} style={at(0.06, 0.16)}><b>ERP</b><span>Pedidos · Estoque</span></div>
          <i className={`${styles.pwire} ${styles.grow2}`} style={at(0.2, 0.2)} />
          <div className={`${styles.node} ${styles.pop}`} style={at(0.4, 0.12)}><b>CRM</b><span>Clientes · Funil</span></div>
        </div>
        <div>
          {recs.slice(0, 3).map((r, i) => <PRow key={r} a={0.52 + i * 0.1} label={r} />)}
        </div>
        <p className={`${styles.note} ${styles.rise}`} style={at(0.86, 0.12)}>Sem retrabalho entre áreas</p>
      </Phone>
    </>
  );
}

/* Número que conta: com @property o contador vem de `--num` (CSS); sem ele o texto final já está no DOM. */
function Count({ to, prefix = "", unit = "", a }: { to: number; prefix?: string; unit?: string; a: number }) {
  return (
    <b className={`${styles.count} ${styles.rise}`} style={{ ...at(a, 0.4), ["--to" as string]: to, ["--pre" as string]: `"${prefix}"`, ["--unit" as string]: `"${unit}"` }}>
      <span className={styles.real}>{prefix}{to}{unit}</span>
    </b>
  );
}

function Dados() {
  const bars = [46, 62, 54, 78, 70, 92, 84];
  return (
    <>
      <Mac title="Indicadores da produção">
        <div className={styles.kpis}>
          <div><span>Processos automatizados</span><Count to={100} prefix="+" a={0.04} /></div>
          <div><span>Operações atendidas</span><Count to={170} a={0.1} /></div>
          <div><span>Economizadas por semana</span><Count to={12} unit=" horas" a={0.16} /></div>
        </div>
        <div className={styles.chart}>
          {bars.map((h, i) => (
            <i key={i} className={styles.grow2} style={{ ...at(0.12 + i * 0.07, 0.3), height: `${h}%` }} />
          ))}
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={styles.trend} aria-hidden="true">
            <polyline pathLength="1" className={styles.draw} style={at(0.5, 0.4)} points="4,34 20,28 36,31 52,19 68,22 84,11 98,6" />
          </svg>
        </div>
      </Mac>
      <Phone title="Produção">
        <div className={styles.card}><p className={styles.muted}>Processos automatizados</p><p className={styles.big}><Count to={100} prefix="+" a={0.1} /></p></div>
        <svg viewBox="0 0 100 40" className={styles.spark} aria-hidden="true"><polyline pathLength="1" className={styles.draw} style={at(0.3, 0.5)} points="0,32 16,26 32,29 48,18 64,21 80,10 100,6" /></svg>
        <div className={styles.card}><p className={styles.muted}>Operações atendidas</p><p className={styles.big}><Count to={170} a={0.5} /></p></div>
      </Phone>
    </>
  );
}

function SobMedida() {
  const wave = [8, 16, 11, 22, 14, 26, 12, 18, 9, 20, 13];
  const fields = ["Problema", "Solução", "Criticidade", "Prazo"];
  return (
    <>
      <Mac title="Captura de conhecimento">
        <div className={styles.capture}>
          <div className={styles.cap}>
            <p className={styles.h}>Reunião diária</p>
            <div className={`${styles.waveBig} ${styles.fadeOut}`} style={at(0.32, 0.2)}>
              {wave.map((h, i) => <i key={i} className={styles.bar} style={{ ...at(0.02 + i * 0.015, 0.2), height: `${h * 0.12}em` }} />)}
            </div>
            <div className={styles.lines}>
              {[100, 84, 92, 66, 78, 88, 58].map((w, i) => <i key={i} className={styles.rise} style={{ ...at(0.3 + i * 0.05, 0.14), width: `${w}%` }} />)}
            </div>
          </div>
          <div className={styles.cap}>
            <p className={styles.h}>Registro estruturado</p>
            {fields.map((f, i) => (
              <div key={f} className={`${styles.field} ${styles.rise}`} style={at(0.58 + i * 0.1, 0.16)}>
                <span>{f}</span>
                <i className={styles.fill} style={at(0.62 + i * 0.1, 0.16)} />
              </div>
            ))}
          </div>
        </div>
      </Mac>
      <Phone title="Gravação">
        <div className={styles.wave} aria-hidden="true">{wave.slice(0, 9).map((h, i) => <i key={i} className={styles.bar} style={{ ...at(i * 0.02, 0.2), height: `${h * 0.09}em` }} />)}</div>
        <p className={`${styles.note} ${styles.rise}`} style={at(0.1, 0.2)}>Gravando · 02:14</p>
        <div>
          {fields.slice(0, 3).map((f, i) => <PRow key={f} a={0.4 + i * 0.1} label={f} meta="registrado" />)}
        </div>
        <div className={`${styles.card} ${styles.rise}`} style={at(0.76, 0.2)}><p className={styles.h}>1.681 problemas registrados</p></div>
      </Phone>
    </>
  );
}

const SCENES = [Agentes, Automacoes, Integracoes, Dados, SobMedida];

const noop = () => () => {};
const supportsCount = () => typeof CSS !== "undefined" && "registerProperty" in CSS;
function useCount() {
  return useSyncExternalStore(noop, supportsCount, () => false) ? "" : undefined;
}

/* Desktop: todas as cenas ficam no DOM, empilhadas na mesma célula; só a ativa aparece. A anterior sai para cima e a nova sobe. */
export default function BuildMocks({ active }: { active: number }) {
  const count = useCount();
  return (
    <div className={styles.stage} aria-hidden="true" data-count={count}>
      {SCENES.map((Scene, i) => (
        <div key={i} className={styles.scene} data-state={i === active ? "on" : i < active ? "before" : "after"}>
          <Scene />
        </div>
      ))}
      <p className={styles.caption}>Telas ilustrativas, com dados fictícios.</p>
    </div>
  );
}

/* Fora do palco preso (celular, tablet, tela baixa, movimento reduzido): a tela fica dentro do próprio item. No celular, o iPhone; a partir de 640px, o iPad com a tela larga. Toca uma vez ao entrar na vista. */
export function InlineScene({ index }: { index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const count = useCount();
  const Scene = SCENES[index];
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.style.setProperty("--s", "0");
    let frame = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const run = (t: number) => {
          const s = Math.min(1, (t - t0) / 3600);
          el.style.setProperty("--s", s.toFixed(3));
          if (s < 1) frame = requestAnimationFrame(run);
        };
        frame = requestAnimationFrame(run);
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div ref={ref} className={`${styles.stage} ${styles.inline}`} aria-hidden="true" data-count={count}>
      <div className={styles.scene} data-state="on"><Scene /></div>
      <p className={styles.caption}>Telas ilustrativas, com dados fictícios.</p>
    </div>
  );
}
