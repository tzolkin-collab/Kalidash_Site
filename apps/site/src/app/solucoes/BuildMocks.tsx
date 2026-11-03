import type { ReactNode } from "react";
import styles from "./build-story.module.css";

/* Telas ilustrativas (dados fictícios) das cinco frentes da Execução: um notebook e um celular por frente,
 * desenhados em HTML/CSS, sem imagem. Tudo em `em`, e o palco define o `em` pela sua largura, então escalam juntos. */

function Mac({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.mac}>
      <div className={styles.macBar}><i /><i /><i /><span>{title}</span></div>
      <div className={styles.macBody}>{children}</div>
    </div>
  );
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className={styles.phone}>
      <div className={styles.phoneTop}>9:41</div>
      <div className={styles.phoneBody}>{children}</div>
    </div>
  );
}

const Ok = () => <b className={styles.ok}>✓</b>;

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
        <div className={styles.split}>
          <div>
            <p className={styles.h}>12 abertas · 9 resolvidas hoje</p>
            {rows.map(([area, what, status, tone]) => (
              <div key={what} className={styles.row}>
                <span className={styles.tag}>{area}</span>
                <span className={styles.grow}>{what}</span>
                <span className={styles.pill} data-tone={tone}>{status}</span>
              </div>
            ))}
          </div>
          <div className={styles.side}>
            <p className={styles.h}>Resumo do agente</p>
            <p>Classificou, priorizou e roteou. O que exige decisão sobe para uma pessoa.</p>
            <span className={styles.pill} data-tone="wait">Supervisão humana</span>
          </div>
        </div>
      </Mac>
      <Phone>
        <p className={styles.bubble}>Preciso da segunda via do contrato.</p>
        <p className={styles.bubble} data-me="true">Encontrei o contrato e encaminhei ao Jurídico.</p>
        <p className={styles.note}>Aguardando aprovação de uma pessoa</p>
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
            {steps.map((s) => (
              <div key={s} className={styles.row}><Ok /><span className={styles.grow}>{s}</span><span className={styles.muted}>automático</span></div>
            ))}
          </div>
          <div className={styles.side}>
            <p className={styles.h}>Pré-visualização</p>
            <div className={styles.lines}><i /><i /><i /><i /></div>
          </div>
        </div>
      </Mac>
      <Phone>
        <div className={styles.card}>
          <p className={styles.h}>Relatório semanal pronto</p>
          <p className={styles.muted}>14 páginas · enviado às 08:00</p>
        </div>
        <p className={styles.note}>Ninguém precisou montar</p>
      </Phone>
    </>
  );
}

function Integracoes() {
  return (
    <>
      <Mac title="Integrações ativas">
        <div className={styles.link}>
          <div className={styles.node}><b>ERP</b><span>Pedidos · Estoque</span></div>
          <div className={styles.wire}><i /></div>
          <div className={styles.node}><b>CRM</b><span>Clientes · Funil</span></div>
        </div>
        <div className={styles.row}><Ok /><span className={styles.grow}>Cliente</span><span className={styles.muted}>sincronizado</span></div>
        <div className={styles.row}><Ok /><span className={styles.grow}>Pedido</span><span className={styles.muted}>sincronizado</span></div>
        <div className={styles.row}><Ok /><span className={styles.grow}>Status de entrega</span><span className={styles.muted}>há 2 min</span></div>
      </Mac>
      <Phone>
        <div className={styles.card}><p className={styles.h}>Sincronização</p><p className={styles.muted}>Sem retrabalho entre áreas</p></div>
        <div className={styles.card}><p className={styles.h}>3 de 3 campos</p><p className={styles.muted}>em dia</p></div>
      </Phone>
    </>
  );
}

function Dados() {
  const bars = [46, 62, 54, 78, 70, 92, 84];
  return (
    <>
      <Mac title="Indicadores da produção">
        <div className={styles.kpis}>
          <div><span>Produção hoje</span><b>1.240</b></div>
          <div><span>Retrabalho</span><b>2,1%</b></div>
          <div><span>Prazo cumprido</span><b>96%</b></div>
        </div>
        <div className={styles.chart}>{bars.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
      </Mac>
      <Phone>
        <div className={styles.card}><p className={styles.muted}>Produção</p><p className={styles.big}>1.240</p></div>
        <svg viewBox="0 0 100 40" className={styles.spark} aria-hidden="true"><polyline points="0,32 16,26 32,29 48,18 64,21 80,10 100,6" /></svg>
      </Phone>
    </>
  );
}

function SobMedida() {
  return (
    <>
      <Mac title="Captura de conhecimento">
        <div className={styles.split}>
          <div>
            <p className={styles.h}>Registros da semana</p>
            {["Procedimento de manutenção", "Critério de aprovação", "Atendimento a exceções"].map((t) => (
              <div key={t} className={styles.row}><Ok /><span className={styles.grow}>{t}</span><span className={styles.muted}>transcrito</span></div>
            ))}
          </div>
          <div className={styles.side}>
            <p className={styles.h}>Base de conhecimento</p>
            <p>A experiência da equipe vira consulta para o resto da operação.</p>
          </div>
        </div>
      </Mac>
      <Phone>
        <div className={styles.wave} aria-hidden="true">{[8, 16, 11, 22, 14, 26, 12, 18, 9].map((h, i) => <i key={i} style={{ height: `${h}px` }} />)}</div>
        <p className={styles.note}>Gravando · 02:14</p>
      </Phone>
    </>
  );
}

const SCENES = [Agentes, Automacoes, Integracoes, Dados, SobMedida];

/* Todas as cenas ficam no DOM, empilhadas; só a ativa aparece. Trocar de cena não mexe no layout. */
export default function BuildMocks({ active }: { active: number }) {
  return (
    <div className={styles.stage} aria-hidden="true">
      {SCENES.map((Scene, i) => (
        <div key={i} className={styles.scene} data-on={i === active ? "true" : "false"}>
          <Scene />
        </div>
      ))}
      <p className={styles.caption}>Telas ilustrativas, com dados fictícios.</p>
    </div>
  );
}
