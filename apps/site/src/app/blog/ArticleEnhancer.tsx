"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import NewsletterSignup from "./NewsletterSignup";

/* Os guias longos do blog foram escritos como páginas prontas (HTML com o próprio script). O filtro de HTML tira os scripts
 * e o formulário; aqui o site devolve o que era interativo, sem rodar nada que veio do banco:
 *   - checklist (ul.checklist + p.check-result): conta o que foi marcado;
 *   - calculadora de ROI (section.calc, campos c-a..c-e): recalcula ao digitar;
 *   - exemplos de prompt (.prompt pre): botão Copiar;
 *   - bloco "Material gratuito" (section.gate): o formulário do site entra no lugar do original.
 * Só olha dentro do corpo do artigo ([data-block="article-body"]). */

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (v: number, d = 0) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });

function checklist(body: HTMLElement) {
  const list = body.querySelector<HTMLElement>("ul.checklist");
  const out = body.querySelector<HTMLElement>(".check-result");
  if (!list || !out) return () => {};
  const boxes = [...list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  const update = () => {
    const n = boxes.filter((b) => b.checked).length;
    const t = boxes.length;
    out.dataset.state = n === t ? "ok" : n ? "parcial" : "";
    out.textContent =
      n === 0 ? "Marque o que você já tem." : n === t ? `Os ${t} itens de pé: dá para começar pelo primeiro caso de uso.` : `${n} de ${t}. Faltam ${t - n} antes de começar com segurança.`;
  };
  boxes.forEach((b) => b.addEventListener("change", update));
  update();
  return () => boxes.forEach((b) => b.removeEventListener("change", update));
}

function calculadora(body: HTMLElement) {
  const calc = body.querySelector<HTMLElement>("section.calc");
  if (!calc) return () => {};
  const val = (id: string) => Number(calc.querySelector<HTMLInputElement>(`#${id}`)?.value || 0);
  const put = (id: string, text: string) => {
    const el = calc.querySelector<HTMLElement>(`#${id}`);
    if (el) el.textContent = text;
  };
  /* Mesma conta do texto do guia: horas = A × B ÷ 60 × D; economia = horas × C; ROI = (ganho − custo) ÷ custo. */
  const update = () => {
    const horas = ((val("c-a") * val("c-b")) / 60) * (val("c-d") / 100);
    const mes = horas * val("c-c");
    const ano = mes * 12;
    const custo = val("c-e");
    const liquido = ano - custo;
    const payback = mes > 0 ? custo / mes : Infinity;
    put("r-horas", `${num(horas)} h`);
    put("r-ano", brl(ano));
    put("r-liquido", brl(liquido));
    put("r-payback", Number.isFinite(payback) ? `${num(payback, 1)} meses` : "não se paga");
    put("r-roi", custo > 0 ? `${num((liquido / custo) * 100)}%` : "—");
    put(
      "r-verdict",
      !Number.isFinite(payback)
        ? "Com esses números o projeto não se paga. Revise a fração que a IA resolve ou o custo."
        : payback <= 6
          ? "Se paga em até 6 meses: candidato forte para o primeiro caso de uso."
          : payback <= 12
            ? "Se paga dentro do primeiro ano: vale levar para a diretoria."
            : "Passa de um ano para se pagar: procure um processo com mais volume ou menos custo.",
    );
  };
  calc.addEventListener("input", update);
  update();
  return () => calc.removeEventListener("input", update);
}

function copiar(body: HTMLElement) {
  const made: HTMLButtonElement[] = [];
  body.querySelectorAll<HTMLElement>(".prompt").forEach((box) => {
    const pre = box.querySelector("pre");
    if (!pre || box.querySelector("[data-copiar]")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "copy";
    b.dataset.copiar = "";
    b.textContent = "Copiar";
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pre.textContent ?? "");
        b.textContent = "Copiado";
        setTimeout(() => (b.textContent = "Copiar"), 1600);
      } catch {
        b.textContent = "Não deu para copiar";
      }
    });
    box.appendChild(b);
    made.push(b);
  });
  return () => made.forEach((b) => b.remove());
}

export default function ArticleEnhancer({ slug, watch }: { slug: string; watch: string }) {
  const [gate, setGate] = useState<{ el: HTMLElement; titulo: string } | null>(null);

  useEffect(() => {
    const body = document.querySelector<HTMLElement>('[data-block="article-body"]');
    if (!body) return;
    const undo = [checklist(body), calculadora(body), copiar(body)];
    let raf = 0;
    undo.push(() => cancelAnimationFrame(raf));

    /* Material gratuito: a 2ª coluna do bloco ficou vazia (o formulário original saiu no filtro); o do site entra nela. */
    const section = body.querySelector<HTMLElement>("section.gate");
    const grid = section?.querySelector<HTMLElement>(".gate-grid") ?? section;
    if (grid) {
      let slot = grid.querySelector<HTMLElement>(":scope > [data-gate-form]");
      if (!slot) {
        slot = [...grid.children].find((c) => c.tagName === "DIV" && !c.textContent?.trim()) as HTMLElement | undefined ?? null;
        if (!slot) {
          slot = document.createElement("div");
          grid.appendChild(slot);
        }
        slot.dataset.gateForm = "";
      }
      const titulo = section?.querySelector("h2")?.textContent?.trim() ?? "o material";
      const el = slot;
      /* o portal precisa do nó do HTML do artigo, que só existe depois de montar: entra no quadro seguinte */
      raf = requestAnimationFrame(() => setGate({ el, titulo }));
    }
    return () => undo.forEach((f) => f());
  }, [watch]);

  return gate
    ? createPortal(
        <NewsletterSignup
          placement="material"
          variant="material"
          origem={slug}
          botao="Quero receber o material"
          feito={`Pronto. A equipe da Kalidash vai mandar "${gate.titulo}" para o seu e-mail.`}
        />,
        gate.el,
      )
    : null;
}
