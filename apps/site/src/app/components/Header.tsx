"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import DesktopNav from "./DesktopNav";
import MobileMenu from "./MobileMenu";
import styles from "../motion.module.css";

type NavLink = {
  href: string;
  label: string;
  interno?: boolean;
};

type Props = {
  links: NavLink[];
};

/**
 * Header Inteligente:
 * - 100% limpo (sem gradiente) no topo da página.
 * - Revela gradiente sutil e suave apenas quando o usuário começa a rolar.
 * - Esconde no scroll para baixo e reaparece no scroll para cima.
 */
export default function Header({ links }: Props) {
  const [hidden, setHidden] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Detecta se saiu do topo
      setIsScrolled(currentScrollY > 20);

      // Se estiver no topo (< 20px), sempre visível
      if (currentScrollY <= 20) {
        setHidden(false);
        lastScrollY.current = currentScrollY;
        return;
      }

      // Se rolar para baixo com velocidade
      if (currentScrollY > lastScrollY.current + 6 && currentScrollY > 80) {
        setHidden(true);
      }
      // Se rolar para cima
      else if (currentScrollY < lastScrollY.current - 4) {
        setHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`${styles.header} ${hidden ? styles.headerHidden : ""} ${
        isScrolled ? styles.headerScrolled : ""
      }`}
    >
      <Link href="/" className={styles.logo} aria-label="Kalidash — início">
        <Image
          src="/kalidash-logo-branca.webp"
          alt="Kalidash"
          width={158}
          height={30}
          priority
        />
      </Link>
      <DesktopNav links={links} />
      <MobileMenu />
    </header>
  );
}
