import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import type { EstadoIncidencia } from '@/mocks/incidentsMock';

type Params = { id: string; estado: EstadoIncidencia };

/**
 * "Marcar como atendido" (Spec 07, RF-07.2) — transición sin formulario.
 * `PATCH /incidencias/{id}/estado` (docs/API.md § 5).
 */
export function useCambiarEstado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, estado }: Params) => {
      await apiFetch(`/incidencias/${id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidencia-detalle', variables.id] });
    },
  });
}
