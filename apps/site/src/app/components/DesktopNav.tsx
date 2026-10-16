"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import styles from "../motion.module.css";

type NavLink = {
  href: string;
  label: string;
  interno?: boolean;
};

type Props = {
  links: NavLink[];
};

export default function DesktopNav({ links }: Props) {
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
    opacity: number;
  }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const navRef = useRef<HTMLElement>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget;
    if (!navRef.current) return;

    const navRect = navRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const left = elRect.left - navRect.left;
    const width = elRect.width;

    setIndicator({
      left,
      width,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    setIndicator((prev) => ({
      ...prev,
      opacity: 0,
    }));
  };

  return (
    <nav
      ref={navRef}
      className={styles.nav}
      onMouseLeave={handleMouseLeave}
      aria-label="Navegação principal"
    >
      {/* Pílula líquida magnética que desliza suavemente entre os itens */}
      <div
        className={styles.liquidIndicator}
        style={{
          transform: `translateX(${indicator.left}px)`,
          width: `${indicator.width}px`,
          opacity: indicator.opacity,
        }}
        aria-hidden="true"
      />

      {links.map((link) =>
        link.interno ? (
          <Link
            key={link.href}
            href={link.href}
            className={styles.navLink}
            onMouseEnter={handleMouseEnter}
          >
            {link.label}
          </Link>
        ) : (
          <a
            key={link.href}
            href={link.href}
            className={styles.navLink}
            onMouseEnter={handleMouseEnter}
          >
            {link.label}
          </a>
        )
      )}

      <a
        className={`${styles.navLink} ${styles.navCta}`}
        href="#diagnostico"
        onMouseEnter={handleMouseEnter}
      >
        Diagnóstico <span>↗︎</span>
      </a>
    </nav>
  );
}
