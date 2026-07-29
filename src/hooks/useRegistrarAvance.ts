import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import type { MotivoAvance } from '@/mocks/estadoWorkflowMock';
import type { EstadoIncidencia } from '@/mocks/incidentsMock';

type Params = { id: string; motivo: MotivoAvance; nota: string; siguienteEstado: EstadoIncidencia };

/**
 * Registrar avance (Spec 07, RF-07.3 a RF-07.6). El backend expone dos endpoints
 * separados (docs/API.md § 5): `POST /incidencias/{id}/avances` (la nota categorizada)
 * y `PATCH /incidencias/{id}/estado` (el cambio de estado) — la UI los presenta como
 * una sola acción (RF-07.1/07.2), así que se encadenan aquí.
 */
export function useRegistrarAvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, motivo, nota, siguienteEstado }: Params) => {
      await apiFetch(`/incidencias/${id}/avances`, {
        method: 'POST',
        body: JSON.stringify({ motivo, nota: nota.trim() || undefined }),
      });
      await apiFetch(`/incidencias/${id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: siguienteEstado }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidencia-detalle', variables.id] });
    },
  });
}
