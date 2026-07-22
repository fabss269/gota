import { useMutation, useQueryClient } from '@tanstack/react-query';

import { setTecnicoOverride } from '@/mocks/incidentOverridesStore';
import type { Usuario } from '@/mocks/usuariosMock';

type Params = { id: string; usuario: Usuario };

/**
 * Reasignar responsable (Spec 07, RF-07.8 a RF-07.10). Equivalente real:
 * `PATCH /incidencias/{id}/responsable` (docs/API.md § 5).
 */
export function useReasignarResponsable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, usuario }: Params) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setTecnicoOverride(id, usuario);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidencia-detalle', variables.id] });
    },
  });
}
