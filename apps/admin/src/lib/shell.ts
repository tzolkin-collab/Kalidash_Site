import { createContext, useContext } from 'react';

// O que a casca do app (barra lateral, tema, rota) oferece às páginas.

export type Shell = {
  dark: boolean;
  openMenu: () => void;
  navigate: (to: string) => void;
};

export const ShellContext = createContext<Shell>({ dark: false, openMenu: () => {}, navigate: () => {} });

export const useShell = () => useContext(ShellContext);
