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
    const goals = form.getAll("goals").map(String);
    const company = String(form.get("company") ?? "").trim();
    const role = String(form.get("role") ?? "").trim();
    const teamSize = String(form.get("teamSize") ?? "").trim();
    const details = String(form.get("challenge") ?? "").trim();
    const data = {
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      challenge: [
        `Empresa: ${company}`,
        `Cargo: ${role}`,
        `Colaboradores na operação: ${teamSize}`,
        `Objetivos:\n- ${goals.join("\n- ")}`,
        details ? `Desafio informado:\n${details}` : "",
      ].filter(Boolean).join("\n\n"),
      source: "site-home-diagnostico",
      website: String(form.get("website") ?? ""),
    };
    const next: Record<string, string> = {};
    if (data.name.split(/\s+/).filter(Boolean).length < 2) next.name = "Informe nome e sobrenome.";
    if (!company) next.company = "Informe a empresa.";
    if (!role) next.role = "Informe o cargo.";
    if (!emailOk(data.email)) next.email = "Informe um email válido.";
    if (data.phone.replace(/\D/g, "").length < 10) next.phone = "Informe o WhatsApp com DDD.";
    if (!teamSize) next.teamSize = "Informe o tamanho da operação.";
    if (!goals.length) next.goals = "Selecione pelo menos uma opção.";
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
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.srOnly}>{f.name}</span>
          <input name="name" placeholder={f.name} autoComplete="name" aria-invalid={!!errors.name} />
          {errors.name && <small role="alert">{errors.name}</small>}
        </label>
        <label className={styles.field}>
          <span className={styles.srOnly}>{f.company}</span>
          <input name="company" placeholder={f.company} autoComplete="organization" aria-invalid={!!errors.company} />
          {errors.company && <small role="alert">{errors.company}</small>}
        </label>
        <label className={styles.field}>
          <span className={styles.srOnly}>{f.role}</span>
          <input name="role" placeholder={f.role} autoComplete="organization-title" aria-invalid={!!errors.role} />
          {errors.role && <small role="alert">{errors.role}</small>}
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
          <span className={styles.srOnly}>{f.teamSize}</span>
          <input name="teamSize" placeholder={f.teamSize} inputMode="numeric" aria-invalid={!!errors.teamSize} />
          {errors.teamSize && <small role="alert">{errors.teamSize}</small>}
        </label>
      </div>
      <fieldset className={styles.choiceGroup} aria-invalid={!!errors.goals}>
        <legend>{f.goal}</legend>
        {diagnostico.goals.map((goal) => (
          <label key={goal} className={styles.choice}>
            <input type="checkbox" name="goals" value={goal} />
            <span aria-hidden />
            {goal}
          </label>
        ))}
        {errors.goals && <small role="alert">{errors.goals}</small>}
      </fieldset>
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
          O envio do formulário ainda não está conectado. Tente novamente mais tarde.
        </p>
      )}
    </form>
  );
}
