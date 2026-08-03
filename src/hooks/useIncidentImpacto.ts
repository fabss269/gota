import { useQuery } from '@tanstack/react-query';

import { getImpactoIncidencia } from '@/api/grafo';

/** Impacto de una incidencia (qué afecta aguas abajo/arriba) — Spec del grafo
 * hidráulico. Consulta propia (no viene en `/incidencias/{id}`), se pide solo cuando
 * el tab "Impacto" está activo (`enabled`), no bloquea el detalle principal. */
export function useIncidentImpacto(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['incidencia-impacto', id],
    queryFn: () => getImpactoIncidencia(id as string),
    enabled: !!id && enabled,
  });
}
