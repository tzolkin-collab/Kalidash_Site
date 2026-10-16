import type { Metadata } from "next";
import DiagnosticoClient from "./DiagnosticoClient";

export const metadata: Metadata = {
  title: "Sessão de Diagnóstico Estratégico",
  description:
    "Descubra o potencial de eficiência da sua operação. Agende uma sessão individual com os especialistas da Kalidash para mapear gargalos e estruturar agentes de IA.",
  openGraph: {
    title: "Diagnóstico Estratégico | Kalidash",
    description:
      "Descubra o potencial de eficiência da sua operação com especialistas em agentes de IA.",
  },
};

export default function DiagnosticoPage() {
  return <DiagnosticoClient />;
}
