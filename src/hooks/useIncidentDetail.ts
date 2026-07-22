import { useQuery } from '@tanstack/react-query';

import { getIncidentDetail } from '@/mocks/incidentDetailMock';

/**
 * Detalle de una incidencia (Spec 06). Contra un backend real serían dos llamadas
 * (`GET /incidencias/{id}` + `GET /incidencias/{id}/trazabilidad`, docs/API.md § 4);
 * como todo corre sobre mock local, se resuelven juntas aquí.
 */
export function useIncidentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['incidencia-detalle', id],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const detalle = id ? getIncidentDetail(id) : undefined;
      if (!detalle) throw new Error('NO_ENCONTRADO');
      return detalle;
    },
    enabled: !!id,
  });
}
