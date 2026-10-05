"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import styles from "./home.module.css";
import { config, diagnostico } from "./content";

type Status = "idle" | "sending" | "sent" | "error" | "unconfigured";

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* Formulário do Diagnóstico. O visual é o do design; o envio vai para config.leadEndpoint
 * (POST /api/public/leads da API Go: cria contato + oportunidade INBOUND + nota). Sem endpoint, ele
 * valida e avisa honestamente que o envio não está conectado — nunca finge que enviou.
 * O campo "website" é um honeypot: invisível para pessoas, robôs preenchem e a API descarta. */
export default function DiagnosticoForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const f = diagnostico.fields;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      challenge: String(form.get("challenge") ?? "").trim(),
      source: "site-home-diagnostico",
      website: String(form.get("website") ?? ""),
    };
    const next: Record<string, string> = {};
    if (data.name.split(/\s+/).filter(Boolean).length < 2) next.name = "Informe nome e sobrenome.";
    if (!emailOk(data.email)) next.email = "Informe um email válido.";
    if (data.phone.replace(/\D/g, "").length < 10) next.phone = "Informe o WhatsApp com DDD.";
    setErrors(next);
    if (Object.keys(next).length) return;

    if (!config.leadEndpoint) {
      setStatus("unconfigured");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch(config.leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("sent");
      (e.target as HTMLFormElement).reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate data-block="diagnostico-form">
      <label className={styles.field}>
        <span className={styles.srOnly}>{f.name}</span>
        <input name="name" placeholder={f.name} autoComplete="name" aria-invalid={!!errors.name} />
        {errors.name && <small role="alert">{errors.name}</small>}
      </label>
      <label className={styles.field}>
        <span className={styles.srOnly}>{f.email}</span>
        <input name="email" type="email" placeholder={f.email} autoComplete="email" aria-invalid={!!errors.email} />
        {errors.email && <small role="alert">{errors.email}</small>}
      </label>
      <label className={styles.field}>
        <span className={styles.srOnly}>{f.phone}</span>
        <input name="phone" type="tel" placeholder={f.phone} autoComplete="tel" aria-invalid={!!errors.phone} />
        {errors.phone && <small role="alert">{errors.phone}</small>}
      </label>
      <label className={styles.field}>
        <span className={styles.srOnly}>{f.challenge}</span>
        <textarea name="challenge" placeholder={f.challenge} rows={4} />
      </label>
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Não preencha este campo
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Enviando…" : f.submit}
      </button>
      {status === "sent" && <p role="status" className={styles.formNote}>Recebemos seus dados. Nossa equipe entra em contato em até 24h.</p>}
      {status === "error" && <p role="alert" className={styles.formNote} data-tone="error">Não foi possível enviar agora. Tente de novo em instantes.</p>}
      {status === "unconfigured" && (
        <p role="status" className={styles.formNote} data-tone="error">
          O envio do formulário ainda não está conectado. Fale com a gente pelo WhatsApp.
        </p>
      )}
    </form>
  );
}
