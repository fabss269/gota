import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import type { TransicionEstado } from '@/mocks/estadoWorkflowMock';
import type { EstadoIncidencia } from '@/mocks/incidentsMock';

type ApiTransicionValida = { hacia: EstadoIncidencia; requiereFormulario: boolean };

/**
 * Transiciones de estado válidas para una incidencia — `GET
 * /incidencias/{codigo}/transiciones-validas` (existe en el backend desde antes,
 * pero el frontend nunca lo llamaba: usaba en su lugar el catálogo hardcodeado
 * `TRANSICIONES_ESTADO` de `estadoWorkflowMock.ts`, que podía desincronizarse del
 * flujo real del backend — bug de arquitectura detectado en la auditoría de
 * "gestión completa del ticket" 2026-08-12. El backend no manda un `label` de UI
 * (ni falta hace: `RegistrarAvanceSheet` ya arma el suyo con `ESTADO_LABEL[hacia]`
 * local, `requiereFormulario` no se usa acá — solo lo consume `CambiarEstadoSheet`
 * para decidir si abrir el formulario o confirmar directo), así que se deriva un
 * `label` equivalente al que ya mostraba el catálogo viejo para no romper el
 * contrato de `TransicionEstado` que el resto de la UI espera.
 */
export function useTransicionesValidas(codigo: string | undefined, estadoActual: EstadoIncidencia | undefined) {
  return useQuery({
    queryKey: ['transiciones-validas', codigo],
    queryFn: async (): Promise<TransicionEstado[]> => {
      if (!codigo || !estadoActual) return [];
      const data = await apiFetch<ApiTransicionValida[]>(`/incidencias/${codigo}/transiciones-validas`);
      return data.map((t) => ({
        desde: estadoActual,
        hacia: t.hacia,
        label: t.requiereFormulario ? 'Registrar avance' : 'Marcar como atendido',
        requiereFormulario: t.requiereFormulario,
      }));
    },
    enabled: !!codigo && !!estadoActual,
  });
}
