"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inter, Source_Sans_3 } from "next/font/google";
import styles from "./diagnostico.module.css";
import BrandLogo from "../components/BrandLogo";
import { config, diagnostico } from "../home/content";
import { ArrowLeft, ArrowRight, WhatsApp } from "../home/icons";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap" });

type Status = "idle" | "sending" | "sent" | "error" | "unconfigured";

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function DiagnosticoClient() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);

  function handleBack(e: React.MouseEvent) {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

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
      ]
        .filter(Boolean)
        .join("\n\n"),
      source: "site-pagina-diagnostico",
      website: String(form.get("website") ?? ""),
    };

    const next: Record<string, string> = {};
    if (data.name.split(/\s+/).filter(Boolean).length < 2) next.name = "Informe nome e sobrenome.";
    if (!company) next.company = "Informe a empresa.";
    if (!role) next.role = "Informe o cargo.";
    if (!emailOk(data.email)) next.email = "Informe um e-mail válido.";
    if (data.phone.replace(/\D/g, "").length < 10) next.phone = "Informe o WhatsApp com DDD.";
    if (!teamSize) next.teamSize = "Informe o número de pessoas.";
    if (!goals.length) next.goals = "Selecione pelo menos um objetivo.";
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
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className={`${inter.variable} ${sourceSans.variable} ${styles.pageWrapper}`}>
      {/* Topo com Navegação, Botão de Voltar e Logo Kalidash */}
      <header className={styles.topNav}>
        <div className={styles.topNavInner}>
          <div className={styles.navLeft}>
            <button
              type="button"
              onClick={handleBack}
              className={styles.backButton}
              aria-label="Voltar para a página anterior"
            >
              <ArrowLeft />
              <span>Voltar</span>
            </button>

            <Link href="/" className={styles.logoWrapper} aria-label="Kalidash — Início">
              <BrandLogo tone="dark" />
            </Link>
          </div>
        </div>
      </header>

      {/* Área de Conteúdo Principal */}
      <main className={styles.mainContent}>
        <div className={styles.contentContainer}>
          {/* Coluna da Esquerda: Contexto Editorial Kalidash */}
          <section className={styles.contextCard} aria-labelledby="context-heading">
            <div className={styles.contextHeader}>
              <span className={styles.contextEyebrow}>Diagnóstico operacional</span>

              <h1 id="context-heading" className={styles.contextTitle}>
                {diagnostico.title}
              </h1>

              <p className={styles.contextDescription}>
                {diagnostico.text}
              </p>

              <div className={styles.contextHighlight}>
                <strong className={styles.highlightQuote}>
                  “{diagnostico.microcopy}”
                </strong>
                <p className={styles.highlightSub}>
                  Entendemos o contexto, processos e rotinas da sua empresa antes de qualquer proposta de solução tecnológica.
                </p>
              </div>
            </div>

            <div className={styles.contextFooter}>
              <span className={styles.proofLabel}>Empresas com quem aplicamos e ensinamos</span>
              <div className={styles.proofRoster}>
                {["ArcelorMittal", "Sicoob", "CBA", "Neon", "Fermec", "Bázico", "Cooxupé"].map((company) => (
                  <span key={company} className={styles.proofCompany}>
                    {company}
                  </span>
                ))}
              </div>

              {config.whatsappUrl && (
                <a
                  href={config.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.whatsappAlternative}
                >
                  <WhatsApp />
                  <span>Prefere falar direto pelo WhatsApp? Iniciar conversa</span>
                </a>
              )}
            </div>
          </section>

          {/* Coluna da Direita: Formulário */}
          <section className={styles.formCard} aria-labelledby="form-heading">
            {status === "sent" ? (
              <div className={styles.successPane}>
                <div className={styles.successIcon} aria-hidden="true">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className={styles.successTitle}>Solicitação enviada</h2>
                <p className={styles.successText}>
                  Recebemos suas informações. Nossa equipe entrará em contato para agendar uma conversa e entender o momento da sua empresa.
                </p>
                <Link href="/" className={styles.successCloseBtn}>
                  <ArrowLeft />
                  <span>Voltar para o início</span>
                </Link>
              </div>
            ) : (
              <div>
                <div className={styles.formHeader}>
                  <h2 id="form-heading" className={styles.formTitle}>
                    Conte sobre sua empresa
                  </h2>
                  <p className={styles.formSubtitle}>
                    Preencha os campos abaixo para entendermos o desafio antes de qualquer conversa.
                  </p>
                </div>

                <form onSubmit={onSubmit} noValidate>
                  <div className={styles.formGrid}>
                    <label className={styles.field}>
                      <input
                        ref={firstInputRef}
                        name="name"
                        placeholder={diagnostico.fields.name}
                        autoComplete="name"
                        aria-invalid={!!errors.name}
                      />
                      {errors.name && <small role="alert">{errors.name}</small>}
                    </label>

                    <label className={styles.field}>
                      <input
                        name="company"
                        placeholder={diagnostico.fields.company}
                        autoComplete="organization"
                        aria-invalid={!!errors.company}
                      />
                      {errors.company && <small role="alert">{errors.company}</small>}
                    </label>

                    <label className={styles.field}>
                      <input
                        name="role"
                        placeholder={diagnostico.fields.role}
                        autoComplete="organization-title"
                        aria-invalid={!!errors.role}
                      />
                      {errors.role && <small role="alert">{errors.role}</small>}
                    </label>

                    <label className={styles.field}>
                      <input
                        name="email"
                        type="email"
                        placeholder={diagnostico.fields.email}
                        autoComplete="email"
                        aria-invalid={!!errors.email}
                      />
                      {errors.email && <small role="alert">{errors.email}</small>}
                    </label>

                    <label className={styles.field}>
                      <input
                        name="phone"
                        type="tel"
                        placeholder={diagnostico.fields.phone}
                        autoComplete="tel"
                        aria-invalid={!!errors.phone}
                      />
                      {errors.phone && <small role="alert">{errors.phone}</small>}
                    </label>

                    <label className={styles.field}>
                      <input
                        name="teamSize"
                        placeholder={diagnostico.fields.teamSize}
                        inputMode="numeric"
                        aria-invalid={!!errors.teamSize}
                      />
                      {errors.teamSize && <small role="alert">{errors.teamSize}</small>}
                    </label>
                  </div>

                  <div className={styles.goalsSection}>
                    <span className={styles.goalsLabel}>{diagnostico.fields.goal}</span>
                    <div className={styles.tagGroup} role="group" aria-label="Objetivos">
                      {diagnostico.goals.map((goal, idx) => (
                        <label key={goal} className={styles.tag}>
                          <input
                            type="checkbox"
                            name="goals"
                            value={goal}
                            defaultChecked={idx === 0 || idx === 1}
                          />
                          <span>{goal}</span>
                        </label>
                      ))}
                    </div>
                    {errors.goals && <small role="alert">{errors.goals}</small>}
                  </div>

                  <label className={styles.field} style={{ marginTop: 14 }}>
                    <textarea
                      name="challenge"
                      placeholder={diagnostico.fields.challenge}
                      rows={3}
                    />
                  </label>

                  {/* Honeypot invisível para anti-spam */}
                  <div
                    aria-hidden="true"
                    style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
                  >
                    <label>
                      Não preencha este campo
                      <input name="website" tabIndex={-1} autoComplete="off" />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={status === "sending"}
                  >
                    <span>
                      {status === "sending" ? "Enviando informações…" : diagnostico.fields.submit}
                    </span>
                    <ArrowRight />
                  </button>

                  {status === "error" && (
                    <p role="alert" className={`${styles.statusMessage} ${styles.statusError}`}>
                      Não foi possível enviar agora. Tente novamente em instantes ou utilize o WhatsApp.
                    </p>
                  )}

                  {status === "unconfigured" && (
                    <p role="status" className={`${styles.statusMessage} ${styles.statusError}`}>
                      O envio do formulário ainda não está conectado. Tente novamente mais tarde.
                    </p>
                  )}
                </form>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
