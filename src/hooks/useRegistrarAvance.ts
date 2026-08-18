import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import type { MotivoAvance } from '@/mocks/estadoWorkflowMock';
import type { EstadoIncidencia } from '@/mocks/incidentsMock';

type Params = { id: string; motivo: MotivoAvance; nota: string; siguienteEstado: EstadoIncidencia };

/**
 * Registrar avance (Spec 07, RF-07.3 a RF-07.6). Un solo POST a
 * `/incidencias/{id}/avances` — el backend deriva el estado destino del
 * `motivo` (MOTIVO_ESTADO en app/modules/incidencias/transiciones.py) y ya
 * inserta el evento con el estado correcto. `siguienteEstado` sigue en Params
 * para que el caller pueda mostrarlo optimista en la UI, pero NO se manda al
 * backend: la segunda llamada a PATCH /estado que existía antes duplicaba
 * eventos (dos EN_PROGRESO por avance) y en "Culminar" (SE_RESOLVIO→ATENDIDO)
 * devolvía 409 porque el estado ya había cambiado a ATENDIDO en el primer
 * POST y ATENDIDO→ATENDIDO no es transición válida.
 */
export function useRegistrarAvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, motivo, nota }: Params) => {
      await apiFetch(`/incidencias/${id}/avances`, {
        method: 'POST',
        body: JSON.stringify({ motivo, nota: nota.trim() || undefined }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidencia-detalle', variables.id] });
    },
  });
}
