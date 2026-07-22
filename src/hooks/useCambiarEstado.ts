import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { EstadoIncidencia } from '@/mocks/incidentsMock';
import { appendAvanceOverride, setEstadoOverride } from '@/mocks/incidentOverridesStore';

type Params = { id: string; estado: EstadoIncidencia };

/**
 * "Marcar como atendido" (Spec 07, RF-07.2) — transición sin formulario. Equivalente
 * real: `PATCH /incidencias/{id}/estado` (docs/API.md § 5).
 */
export function useCambiarEstado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, estado }: Params) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setEstadoOverride(id, estado);
      appendAvanceOverride(id, { estado, fecha: new Date().toISOString() });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidencia-detalle', variables.id] });
    },
  });
}
