"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { config } from "../home/content";
import { getAttribution, newEventId, trackSignup } from "@/lib/tracking";
import styles from "./newsletter.module.css";

/* CTA "receber os conteúdos por e-mail" (jornada J3 do mapa de CTAs). Pede só nome e e-mail e grava como lead no
 * CRM pela mesma captura do site (POST /api/leads -> /api/public/leads), com a origem "blog-newsletter": a API
 * aceita sem WhatsApp e não conta como conversão Lead da mídia paga. A inscrição tem conversão própria (trackSignup):
 * CompleteRegistration na Meta e sign_up no GA4, com content_category "material" no bloco de material gratuito e
 * "newsletter" nos demais, e o mesmo event_id da API de Conversões. */

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

type Status = "idle" | "sending" | "sent" | "error";

/* Variantes: "band" (faixa Limestone no fim do /blog e do artigo), "compact" (quadro no topo do artigo, sobre o Imperial,
 * como o CTA ao lado do título nos blogs de referência) e "material" (dentro do bloco "Material gratuito" dos artigos longos,
 * no lugar do formulário original, que o filtro de HTML descarta). O texto pode ser trocado por props. */
type Props = {
  placement: "blog" | "artigo" | "topo" | "material";
  variant?: "band" | "compact" | "material";
  /* sufixo da origem no CRM, ex.: o slug do artigo do material */
  origem?: string;
  titulo?: string;
  botao?: string;
  feito?: string;
};

export default function NewsletterSignup({ placement, variant = "band", origem, titulo, botao, feito }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const eventIdRef = useRef<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const next: typeof errors = {};
    if (name.split(/\s+/).filter(Boolean).length < 2) next.name = "Informe nome e sobrenome.";
    if (!emailOk(email)) next.email = "Informe um e-mail válido.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setStatus("sending");
    const eventId = (eventIdRef.current ??= newEventId());
    try {
      const source = `blog-newsletter-${placement}${origem ? `-${origem}` : ""}`;
      const res = await fetch(config.leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          source,
          website: String(form.get("website") ?? ""),
          event_id: eventId,
          attribution: getAttribution(),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const out = await res.json().catch(() => ({}));
      eventIdRef.current = null;
      setStatus("sent");
      trackSignup(eventId, placement === "material" ? "material" : "newsletter", source, out, { placement });
    } catch {
      setStatus("error");
    }
  }

  const form =
    status === "sent" ? (
      <p className={styles.done} role="status">
        {feito ?? "Inscrição feita. Os próximos conteúdos chegam no seu e-mail."}
      </p>
    ) : (
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <label className={styles.field}>
          <span>Nome e sobrenome</span>
          <input name="name" autoComplete="name" placeholder="Nome e sobrenome" aria-invalid={!!errors.name} />
          {errors.name && <small role="alert">{errors.name}</small>}
        </label>
        <label className={styles.field}>
          <span>E-mail corporativo</span>
          <input name="email" type="email" inputMode="email" autoComplete="email" placeholder="voce@empresa.com.br" aria-invalid={!!errors.email} />
          {errors.email && <small role="alert">{errors.email}</small>}
        </label>
        {/* honeypot: fica fora da tela, só robô preenche */}
        <input className={styles.trap} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button type="submit" className={styles.submit} disabled={status === "sending"}>
          {status === "sending" ? "Enviando…" : (botao ?? "Quero receber")}
        </button>
        <p className={styles.note}>
          {status === "error" ? (
            <span role="alert">Não deu para concluir agora. Tente de novo em instantes.</span>
          ) : (
            <>
              Sem spam; você sai quando quiser. Veja a <Link href="/privacidade">Política de Privacidade</Link>.
            </>
          )}
        </p>
      </form>
    );

  if (variant === "material") return <div className={styles.material} data-block="newsletter" data-placement={placement}>{form}</div>;

  if (variant === "compact")
    return (
      <aside className={styles.compact} data-block="newsletter" data-placement={placement} aria-labelledby={`news-${placement}`}>
        <p id={`news-${placement}`} className={styles.compactTitle}>
          {titulo ?? "Receba os próximos artigos no seu e-mail"}
          <small>Um e-mail a cada quinze dias, sobre IA aplicada à operação.</small>
        </p>
        {form}
      </aside>
    );

  return (
    <section className={styles.band} data-block="newsletter" data-placement={placement} aria-labelledby={`news-${placement}`}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>Newsletter</p>
        <h2 id={`news-${placement}`} className={styles.title}>
          {titulo ?? "Receba os próximos conteúdos por e-mail."}
        </h2>
        <p className={styles.lead}>
          Um e-mail a cada quinze dias com os novos artigos, cases e materiais sobre IA aplicada à operação.
        </p>
      </div>
      {form}
    </section>
  );
}
