import { useQuery } from '@tanstack/react-query';

import { INCIDENCIAS_HOY } from '@/mocks/incidentsMock';
import { useFiltersStore } from '@/state/filtersStore';

/**
 * Trae las incidencias de hoy (Spec 03, RF-03.4) aplicando los filtros del Bottom
 * Sheet (Spec 04). Contra un backend real esto sería:
 *   GET /incidencias?fecha=hoy&categoria=...&prioridad=...  (ver docs/API.md § 3)
 * Hoy filtra el mock local — cambiar `queryFn` es el único punto de contacto para
 * conectar la API real.
 */
export function useIncidentsToday() {
  const categorias = useFiltersStore((s) => s.categorias);
  const prioridades = useFiltersStore((s) => s.prioridades);

  return useQuery({
    queryKey: ['incidencias-hoy', categorias, prioridades],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return INCIDENCIAS_HOY.filter(
        (i) => categorias.includes(i.categoria) && prioridades.includes(i.prioridad),
      );
    },
  });
}
