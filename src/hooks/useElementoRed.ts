import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getAccesorioClasificaciones,
  getAccesorioTipos,
  getElementoRed,
  getMaterialesRed,
  patchElementoRed,
  type ElementoRedPatch,
} from '@/api/redElemento';
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

/** Catálogo de materiales para el selector de edición inline, filtrado por `grupo`
 * ('AGUA POTABLE' | 'ALCANTARILLADO'). Casi no cambia, cachea largo. `enabled`
 * controla el fetch (ej. solo mientras el campo está en modo edición). */
export function useMaterialesRed(grupo: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['red-materiales', grupo],
    queryFn: () => getMaterialesRed(grupo ?? undefined),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Catálogo de tipos de accesorio (sig.accesoriotipos), filtrado por `grupo`. */
export function useAccesorioTipos(grupo: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['red-accesorio-tipos', grupo],
    queryFn: () => getAccesorioTipos(grupo ?? undefined),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Catálogo de clasificaciones de accesorio (sig.accesorioclasificacion) — sin
 * filtro por grupo, el backend expone una sola lista. */
export function useAccesorioClasificaciones(enabled: boolean) {
  return useQuery({
    queryKey: ['red-accesorio-clasificaciones'],
    queryFn: getAccesorioClasificaciones,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Edición inline de los campos editables del panel de elemento — ver EditableField.web.tsx. */
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
