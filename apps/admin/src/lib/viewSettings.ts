import { useCallback, useState } from 'react';

// Configuração de visualização do CRM, guardada no navegador de cada pessoa.

export type OpenMode = 'side' | 'center';
export type FontSize = 'sm' | 'md' | 'lg';

export type ViewSettings = {
  openMode: OpenMode;
  fontSize: FontSize;
  /** Colunas visíveis na Lista, além de "Oportunidade" (que é sempre a primeira). */
  columns: string[];
};

export const DEFAULT_COLUMNS = ['client', 'stage', 'tags', 'value'];

export const DEFAULT_SETTINGS: ViewSettings = {
  openMode: 'side',
  fontSize: 'md',
  columns: DEFAULT_COLUMNS,
};

const STORAGE_KEY = 'kalidash.crm.view.v1';

function load(): ViewSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const data = JSON.parse(raw) as Partial<ViewSettings>;
    return {
      openMode: data.openMode === 'center' ? 'center' : 'side',
      fontSize: data.fontSize === 'sm' || data.fontSize === 'lg' ? data.fontSize : 'md',
      columns: Array.isArray(data.columns) && data.columns.every((c) => typeof c === 'string')
        ? data.columns
        : DEFAULT_COLUMNS,
    };
  } catch {
    return DEFAULT_SETTINGS; // sem storage (aba privada, bloqueio): funciona só nesta sessão
  }
}

function save(settings: ViewSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* sem storage: a escolha vale só até recarregar */
  }
}

export function useViewSettings() {
  const [settings, setSettings] = useState<ViewSettings>(load);

  const update = useCallback((patch: Partial<ViewSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    save(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, update, reset };
}
