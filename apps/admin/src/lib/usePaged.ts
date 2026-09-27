import { useMemo, useState } from 'react';

/** Paginação no cliente. Volta para a página 1 quando a lista muda de tamanho (filtro, busca). */
export function usePaged<T>(items: T[], initialSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const total = items.length;

  // Ajuste durante a renderização (padrão do React): sem efeito e sem render extra visível.
  const key = `${total}|${pageSize}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setPage(1);
  }

  const rows = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);
  return { rows, page, pageSize, total, setPage, setPageSize };
}
