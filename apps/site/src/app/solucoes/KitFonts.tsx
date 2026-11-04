"use client";

import { useEffect } from "react";

/* Kit Adobe (Kepler + Acumin) da Advisory sem bloquear a primeira pintura. O <link rel="preload"> no KitPage começa o download cedo;
 * aqui o CSS do kit é aplicado depois da carga e só então o <main> recebe data-fonts="ready" (kit.module.css troca as fontes de reserva
 * com métrica ajustada pelas reais), sem texto invisível e sem salto de layout. Mesmo padrão da Home (HomePage.tsx). */
const KIT = "https://use.typekit.net/krs4uwp.css";
const FACES = ['400 1em "kepler-std-display"', 'italic 400 1em "kepler-std-display"', '400 1em "kepler-std-subhead"', 'italic 400 1em "kepler-std-subhead"', '400 1em "acumin-pro"', '700 1em "acumin-pro"'];

export default function KitFonts() {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = KIT;
    document.head.appendChild(link);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      main.setAttribute("data-fonts", "ready");
    };
    link.addEventListener("load", () => {
      Promise.all(FACES.map((f) => document.fonts.load(f))).then(finish, finish);
    });
    const timeout = window.setTimeout(finish, 5000);
    return () => window.clearTimeout(timeout);
  }, []);
  return null;
}
