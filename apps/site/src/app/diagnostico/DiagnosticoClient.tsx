"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./diagnostico.module.css";
import BrandLogo from "../components/BrandLogo";
import { config, diagnostico } from "../home/content";
import { ArrowLeft, ArrowRight, WhatsApp } from "../home/icons";

type Status = "idle" | "sending" | "sent" | "error" | "unconfigured";

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

interface FormDataState {
  goals: string[];
  challenge: string;
  company: string;
  role: string;
  teamSize: string;
  name: string;
  email: string;
  phone: string;
  website: string;
}

const TOTAL_STEPS = 3;

export default function DiagnosticoClient() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<FormDataState>({
    goals: [],
    challenge: "",
    company: "",
    role: "",
    teamSize: "",
    name: "",
    email: "",
    phone: "",
    website: "",
  });

  function handleBackNav(e: React.MouseEvent) {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  function handleGoalToggle(goal: string) {
    setFormData((prev) => {
      const exists = prev.goals.includes(goal);
      const nextGoals = exists
        ? prev.goals.filter((g) => g !== goal)
        : [...prev.goals, goal];
      return { ...prev, goals: nextGoals };
    });
    if (errors.goals) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.goals;
        return copy;
      });
    }
  }

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  }

  function validateStep(currentStep: number): boolean {
    const nextErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (formData.name.trim().split(/\s+/).filter(Boolean).length < 2) {
        nextErrors.name = "Informe seu nome e sobrenome.";
      }
      if (!emailOk(formData.email.trim())) {
        nextErrors.email = "Informe um e-mail corporativo válido.";
      }
      if (formData.phone.replace(/\D/g, "").length < 10) {
        nextErrors.phone = "Informe o WhatsApp com DDD (mínimo 10 dígitos).";
      }
    } else if (currentStep === 2) {
      if (!formData.company.trim()) {
        nextErrors.company = "Informe o nome da empresa.";
      }
      if (!formData.role.trim()) {
        nextErrors.role = "Informe o seu cargo.";
      }
      if (!formData.teamSize.trim()) {
        nextErrors.teamSize = "Informe o tamanho da equipe/operação.";
      }
    } else if (currentStep === 3) {
      if (!formData.goals.length) {
        nextErrors.goals = "Selecione pelo menos um objetivo.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleNext() {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    }
  }

  function handlePrev() {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateStep(3)) return;

    if (!config.leadEndpoint) {
      setStatus("unconfigured");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      challenge: [
        `Empresa: ${formData.company.trim()}`,
        `Cargo: ${formData.role.trim()}`,
        `Colaboradores na operação: ${formData.teamSize.trim()}`,
        `Objetivos:\n- ${formData.goals.join("\n- ")}`,
        formData.challenge.trim()
          ? `Desafio informado:\n${formData.challenge.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      source: "site-pagina-diagnostico",
      website: formData.website,
    };

    setStatus("sending");
    try {
      const res = await fetch(config.leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <div className={styles.splitLayout}>
      {/* ========================================================
          LADO ESQUERDO: Painel Editorial Institucional (Oculto no Mobile)
          ======================================================== */}
      <aside className={styles.editorialPane}>
        <div className={styles.editorialContent}>
          <div className={styles.brandRow}>
            <Link href="/" className={styles.editorialLogoLink} aria-label="Kalidash — Início">
              <BrandLogo tone="light" />
            </Link>
          </div>

          <div className={styles.editorialBody}>
            <span className={styles.eyebrow}>Diagnóstico Operacional</span>
            <h1 className={styles.editorialTitle}>
              Existe uma oportunidade de eficiência na sua operação.
            </h1>
            <p className={styles.editorialLead}>
              Conte um pouco sobre o momento da sua empresa e vamos entender o desafio antes de propor qualquer solução.
            </p>

            <div className={styles.quoteCard}>
              <strong className={styles.quoteText}>
                “Primeiro entendemos. Depois construímos juntos.”
              </strong>
              <p className={styles.quoteSub}>
                Mapeamos fluxos, rotinas e dores reais antes de qualquer automação ou agente de IA.
              </p>
            </div>
          </div>

          <div className={styles.editorialFooter}>
            <div className={styles.proofColumns}>
              <div>
                <span className={styles.proofLabel}>Onde aplicamos</span>
                <p className={styles.proofNames}>ArcelorMittal · CBA · Sicoob · Cooxupé</p>
              </div>
              <div>
                <span className={styles.proofLabel}>Onde ensinamos</span>
                <p className={styles.proofNames}>Conquer · Xperiun · Rocketseat · Hashtag · Tera</p>
              </div>
            </div>

            {config.whatsappUrl && (
              <a
                href={config.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.whatsappDirect}
              >
                <WhatsApp />
                <span>Prefere falar direto? Iniciar WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================
          LADO DIREITO: Formulário Direto por Etapas (Foco Total)
          ======================================================== */}
      <main className={styles.formPane}>
        {/* Barra superior de navegação da etapa */}
        <header className={styles.stepHeader}>
          <div className={styles.headerLeft}>
            {/* Logo compacta visível apenas no mobile */}
            <Link href="/" className={styles.mobileLogo} aria-label="Kalidash — Início">
              <BrandLogo tone="dark" markOnly />
            </Link>
            <span className={styles.stepBadge}>
              Etapa {step} de {TOTAL_STEPS}
            </span>
          </div>

          <button
            type="button"
            onClick={handleBackNav}
            className={styles.exitButton}
            aria-label="Voltar para a página anterior"
          >
            <ArrowLeft />
            <span>Voltar <span className={styles.exitSiteWord}>ao site</span></span>
          </button>
        </header>

        {/* Linha de progresso no topo */}
        <div
          className={styles.progressBarTrack}
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={styles.progressBarFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Container do Formulário */}
        <div className={styles.formScrollArea}>
          <div className={styles.formContainer}>
            {status === "sent" ? (
              <div className={styles.successScreen}>
                <div className={styles.successIconBadge} aria-hidden="true">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className={styles.successHeading}>Solicitação enviada com sucesso!</h2>
                <p className={styles.successBody}>
                  Nossa equipe de consultoria entrará em contato em até <strong>24 horas úteis</strong> para confirmar os detalhes e agendar a sessão de diagnóstico.
                </p>
                <div className={styles.successActions}>
                  <Link href="/" className={styles.successHomeButton}>
                    Voltar para o início
                  </Link>
                  {config.whatsappUrl && (
                    <a
                      href={config.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.successWhatsAppButton}
                    >
                      <WhatsApp />
                      <span>Falar agora no WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={step === TOTAL_STEPS ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }} noValidate>
                {/* Honeypot anti-spam */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
                  <label>
                    Não preencha este campo
                    <input
                      name="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </label>
                </div>

                {/* ---------------- ETAPA 1: DADOS DE CONTATO ---------------- */}
                {step === 1 && (
                  <div className={styles.stepBlock}>
                    <div className={styles.stepTitleArea}>
                      <span className={styles.stepSubtitle}>Passo 1 de 3</span>
                      <h2 className={styles.stepHeading}>Seus dados de contato</h2>
                      <p className={styles.stepDesc}>
                        Informe onde podemos enviar o diagnóstico e alinhar os próximos passos da sua operação.
                      </p>
                    </div>

                    <div className={styles.fieldsStack}>
                      <div className={styles.fieldWrap}>
                        <label htmlFor="name" className={styles.fieldLabel}>
                          Nome e sobrenome <span className={styles.requiredMark}>*</span>
                        </label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Seu nome completo"
                          autoComplete="name"
                          aria-invalid={Boolean(errors.name)}
                          aria-describedby={errors.name ? "name-error" : undefined}
                          className={`${styles.textInput} ${errors.name ? styles.inputError : ""}`}
                        />
                        {errors.name && <p id="name-error" className={styles.fieldError}>{errors.name}</p>}
                      </div>

                      <div className={styles.fieldWrap}>
                        <label htmlFor="email" className={styles.fieldLabel}>
                          E-mail corporativo <span className={styles.requiredMark}>*</span>
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="voce@suaempresa.com.br"
                          autoComplete="email"
                          aria-invalid={Boolean(errors.email)}
                          aria-describedby={errors.email ? "email-error" : undefined}
                          className={`${styles.textInput} ${errors.email ? styles.inputError : ""}`}
                        />
                        {errors.email && <p id="email-error" className={styles.fieldError}>{errors.email}</p>}
                      </div>

                      <div className={styles.fieldWrap}>
                        <label htmlFor="phone" className={styles.fieldLabel}>
                          WhatsApp com DDD <span className={styles.requiredMark}>*</span>
                        </label>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="(11) 99999-9999"
                          autoComplete="tel"
                          aria-invalid={Boolean(errors.phone)}
                          aria-describedby={errors.phone ? "phone-error" : undefined}
                          className={`${styles.textInput} ${errors.phone ? styles.inputError : ""}`}
                        />
                        {errors.phone && <p id="phone-error" className={styles.fieldError}>{errors.phone}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------- ETAPA 2: DADOS DA EMPRESA ---------------- */}
                {step === 2 && (
                  <div className={styles.stepBlock}>
                    <div className={styles.stepTitleArea}>
                      <span className={styles.stepSubtitle}>Passo 2 de 3</span>
                      <h2 className={styles.stepHeading}>Sobre a sua operação</h2>
                      <p className={styles.stepDesc}>
                        Entendemos o porte e o contexto da sua empresa antes de qualquer conversa.
                      </p>
                    </div>

                    <div className={styles.fieldsStack}>
                      <div className={styles.fieldWrap}>
                        <label htmlFor="company" className={styles.fieldLabel}>
                          Nome da empresa <span className={styles.requiredMark}>*</span>
                        </label>
                        <input
                          id="company"
                          name="company"
                          type="text"
                          value={formData.company}
                          onChange={handleInputChange}
                          placeholder="Ex: Kalidash Tecnologia"
                          autoComplete="organization"
                          aria-invalid={Boolean(errors.company)}
                          aria-describedby={errors.company ? "company-error" : undefined}
                          className={`${styles.textInput} ${errors.company ? styles.inputError : ""}`}
                        />
                        {errors.company && <p id="company-error" className={styles.fieldError}>{errors.company}</p>}
                      </div>

                      <div className={styles.fieldWrap}>
                        <label htmlFor="role" className={styles.fieldLabel}>
                          Seu cargo <span className={styles.requiredMark}>*</span>
                        </label>
                        <input
                          id="role"
                          name="role"
                          type="text"
                          value={formData.role}
                          onChange={handleInputChange}
                          placeholder="Ex: Diretor de Operações / Head de TI"
                          autoComplete="organization-title"
                          aria-invalid={Boolean(errors.role)}
                          aria-describedby={errors.role ? "role-error" : undefined}
                          className={`${styles.textInput} ${errors.role ? styles.inputError : ""}`}
                        />
                        {errors.role && <p id="role-error" className={styles.fieldError}>{errors.role}</p>}
                      </div>

                      <div className={styles.fieldWrap}>
                        <label htmlFor="teamSize" className={styles.fieldLabel}>
                          Nº de pessoas na equipe ou operação <span className={styles.requiredMark}>*</span>
                        </label>
                        <input
                          id="teamSize"
                          name="teamSize"
                          type="text"
                          value={formData.teamSize}
                          onChange={handleInputChange}
                          placeholder="Ex: 15 pessoas (ou 50 a 100)"
                          aria-invalid={Boolean(errors.teamSize)}
                          aria-describedby={errors.teamSize ? "teamSize-error" : undefined}
                          className={`${styles.textInput} ${errors.teamSize ? styles.inputError : ""}`}
                        />
                        {errors.teamSize && <p id="teamSize-error" className={styles.fieldError}>{errors.teamSize}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------- ETAPA 3: OBJETIVOS & DESAFIO ---------------- */}
                {step === 3 && (
                  <div className={styles.stepBlock}>
                    <div className={styles.stepTitleArea}>
                      <span className={styles.stepSubtitle}>Passo 3 de 3</span>
                      <h2 className={styles.stepHeading}>O que sua empresa busca hoje?</h2>
                      <p className={styles.stepDesc}>
                        Selecione as frentes de inteligência e processos prioritárias para o seu momento.
                      </p>
                    </div>

                    <div className={styles.pillGroup} role="group" aria-label="Objetivos">
                      {diagnostico.goals.map((goal) => {
                        const isSelected = formData.goals.includes(goal);
                        return (
                          <button
                            key={goal}
                            type="button"
                            onClick={() => handleGoalToggle(goal)}
                            className={`${styles.pillItem} ${isSelected ? styles.pillSelected : ""}`}
                            aria-pressed={isSelected}
                          >
                            <span className={styles.pillCheck} aria-hidden="true">
                              {isSelected ? "✓" : "+"}
                            </span>
                            <span>{goal}</span>
                          </button>
                        );
                      })}
                    </div>
                    {errors.goals && <p className={styles.fieldError}>{errors.goals}</p>}

                    <div className={styles.fieldWrap} style={{ marginTop: 28 }}>
                      <label htmlFor="challenge" className={styles.fieldLabel}>
                        Conte um pouco sobre o momento ou principal desafio <span className={styles.optionalTag}>(opcional)</span>
                      </label>
                      <textarea
                        id="challenge"
                        name="challenge"
                        rows={3}
                        value={formData.challenge}
                        onChange={handleInputChange}
                        placeholder="Ex: Queremos reduzir gargalos de atendimento e automatizar relatórios manuais..."
                        className={styles.textareaInput}
                      />
                    </div>
                  </div>
                )}

                {/* Feedback de envio / erro de API */}
                {status === "error" && (
                  <div className={styles.alertMessage} role="alert">
                    Não foi possível enviar sua solicitação no momento. Por favor, tente novamente ou fale pelo WhatsApp.
                  </div>
                )}
                {status === "unconfigured" && (
                  <div className={styles.alertMessage} role="status">
                    O formulário está operando em modo de demonstração técnica.
                  </div>
                )}

                {/* ---------------- BOTÕES DE AÇÃO E NAVEGAÇÃO ---------------- */}
                <div className={styles.actionRow}>
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={handlePrev}
                      className={styles.prevButton}
                      disabled={status === "sending"}
                    >
                      <ArrowLeft />
                      <span>Voltar</span>
                    </button>
                  ) : <div />}

                  {step < TOTAL_STEPS ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className={styles.nextButton}
                    >
                      <span>Continuar</span>
                      <ArrowRight />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className={styles.submitButton}
                    >
                      <span>{status === "sending" ? "Enviando solicitação…" : "Solicitar diagnóstico"}</span>
                      {status !== "sending" && <ArrowRight />}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
