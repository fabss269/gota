import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import type { Usuario } from '@/mocks/usuariosMock';

type Params = { id: string; usuario: Usuario };

/**
 * Reasignar responsable (Spec 07, RF-07.8 a RF-07.10).
 * `PATCH /incidencias/{id}/responsable` (docs/API.md § 5) — restringido a rol
 * `supervisor` en el backend (403 `PERMISOS_INSUFICIENTES` si el usuario logueado es
 * técnico, ver app/modules/incidencias/router.py).
 */
export function useReasignarResponsable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, usuario }: Params) => {
      await apiFetch(`/incidencias/${id}/responsable`, {
        method: 'PATCH',
        body: JSON.stringify({ tecnicoId: usuario.id }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidencia-detalle', variables.id] });
    },
  });
}
