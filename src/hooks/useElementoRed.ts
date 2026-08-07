import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getElementoRed, getMaterialesRed, patchElementoRed, type ElementoRedPatch } from '@/api/redElemento';
import type { ElementoRedTipo } from '@/components/map/mapLayers';

/** Detalle de un elemento de catastro (click en el mapa fuera de modo simulación),
 * ver ElementoInfoPanel.web.tsx. */
export function useElementoRed(elemento: { tipo: ElementoRedTipo; id: number } | null) {
  return useQuery({
    queryKey: ['red-elemento', elemento?.tipo, elemento?.id],
    queryFn: () => getElementoRed(elemento!.tipo, elemento!.id),
    enabled: elemento !== null,
  });
}

/** Catálogo de materiales para el selector de edición inline — uno por `tipo`
 * (agua/alcantarillado), casi no cambia, cachea largo (react-query default). */
export function useMaterialesRed(tipo: ElementoRedTipo | null) {
  return useQuery({
    queryKey: ['red-materiales', tipo],
    queryFn: () => getMaterialesRed(tipo!),
    enabled: tipo !== null,
    staleTime: 5 * 60 * 1000,
  });
}

/** Edición inline (estilo Jira) de diámetro/material — ver ElementoInfoPanel.web.tsx. */
export function useActualizarElementoRed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tipo, id, patch }: { tipo: ElementoRedTipo; id: number; patch: ElementoRedPatch }) =>
      patchElementoRed(tipo, id, patch),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['red-elemento', variables.tipo, variables.id] });
    },
  });
}
