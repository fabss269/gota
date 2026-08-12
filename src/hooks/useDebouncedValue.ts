import { useEffect, useState } from 'react';

/**
 * Devuelve `value` con un retraso: solo se actualiza después de `delayMs` sin
 * que `value` vuelva a cambiar (reinicia el timer en cada cambio intermedio).
 *
 * Usado para el árbol de UBICACIÓN (LocationTree.tsx) — togglear varios
 * ójitos rápido antes disparaba un fetch a /incidencias + un repintado
 * completo del mapa POR CADA click (bug real 2026-08-12, auditado en vivo:
 * se sentía "congelado" al togglear sector por sector). Los íconos del
 * árbol siguen leyendo el store SIN debounce (feedback instantáneo); solo
 * el fetch (useIncidentsToday) y el repintado (MapView.web.tsx/MapView.tsx)
 * usan el valor debounced acá.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
