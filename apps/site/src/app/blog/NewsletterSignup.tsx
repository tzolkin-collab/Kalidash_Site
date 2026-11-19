"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { config } from "../home/content";
import { getAttribution, newEventId } from "@/lib/tracking";
import styles from "./newsletter.module.css";

/* CTA "receber os conteúdos por e-mail" (jornada J3 do mapa de CTAs). Pede só nome e e-mail e grava como lead no
 * CRM pela mesma captura do site (POST /api/leads -> /api/public/leads), com a origem "blog-newsletter": a API
 * aceita sem WhatsApp e não conta como conversão Lead da mídia paga. Aqui só vai o evento sign_up para o GA4. */

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

type Status = "idle" | "sending" | "sent" | "error";

export default function NewsletterSignup({ placement }: { placement: "blog" | "artigo" }) {
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
      const res = await fetch(config.leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          source: `blog-newsletter-${placement}`,
          website: String(form.get("website") ?? ""),
          event_id: eventId,
          attribution: getAttribution(),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      eventIdRef.current = null;
      setStatus("sent");
      try {
        const w = window as unknown as { gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] };
        w.gtag?.("event", "sign_up", { method: "newsletter_blog", placement });
        (w.dataLayer ??= []).push({ event: "newsletter_signup", placement, event_id: eventId });
      } catch {
        /* rastreamento bloqueado */
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className={styles.band} data-block="newsletter" data-placement={placement} aria-labelledby={`news-${placement}`}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>Newsletter</p>
        <h2 id={`news-${placement}`} className={styles.title}>
          Receba os próximos conteúdos por e-mail.
        </h2>
        <p className={styles.lead}>
          Um e-mail a cada quinze dias com os novos artigos, cases e materiais sobre IA aplicada à operação.
        </p>
      </div>

      {status === "sent" ? (
        <p className={styles.done} role="status">
          Inscrição feita. Os próximos conteúdos chegam no seu e-mail.
        </p>
      ) : (
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <label className={styles.field}>
            <span>Nome e sobrenome</span>
            <input name="name" autoComplete="name" aria-invalid={!!errors.name} />
            {errors.name && <small role="alert">{errors.name}</small>}
          </label>
          <label className={styles.field}>
            <span>E-mail corporativo</span>
            <input name="email" type="email" inputMode="email" autoComplete="email" aria-invalid={!!errors.email} />
            {errors.email && <small role="alert">{errors.email}</small>}
          </label>
          {/* honeypot: fica fora da tela, só robô preenche */}
          <input className={styles.trap} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <button type="submit" className={styles.submit} disabled={status === "sending"}>
            {status === "sending" ? "Enviando…" : "Quero receber"}
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
      )}
    </section>
  );
}
