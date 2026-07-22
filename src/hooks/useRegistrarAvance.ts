import { useMutation, useQueryClient } from '@tanstack/react-query';

import { MOTIVOS_AVANCE, type MotivoAvance } from '@/mocks/estadoWorkflowMock';
import { appendAvanceOverride, setEstadoOverride } from '@/mocks/incidentOverridesStore';
import type { EstadoIncidencia } from '@/mocks/incidentsMock';

type Params = { id: string; motivo: MotivoAvance; nota: string; siguienteEstado: EstadoIncidencia };

/**
 * Registrar avance (Spec 07, RF-07.3 a RF-07.6). Equivalente real:
 * `POST /incidencias/{id}/avances` (docs/API.md § 5) — el `motivo` ahí es solo una
 * nota categorizada, no lleva estado; el cambio de estado que muestra el overlay
 * "Cambiar estado" (`docs/API.md` § 5 `PATCH /incidencias/{id}/estado`) se aplica acá
 * como el mismo paso, ya que en la UI ambas acciones ocurren juntas (RF-07.1/07.2).
 */
export function useRegistrarAvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, motivo, nota, siguienteEstado }: Params) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setEstadoOverride(id, siguienteEstado);
      appendAvanceOverride(id, {
        estado: siguienteEstado,
        fecha: new Date().toISOString(),
        motivo: MOTIVOS_AVANCE.find((m) => m.value === motivo)?.label,
        nota: nota.trim() || undefined,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidencia-detalle', variables.id] });
    },
  });
}
