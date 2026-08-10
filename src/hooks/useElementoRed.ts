import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getAccesorioClasificaciones,
  getAccesorioTipos,
  getElementoRed,
  getMateriales,
  getMaterialesRed,
  patchElementoRed,
  type ElementoRedPatch,
} from '@/api/redElemento';
import type { ElementoRedTipo } from '@/components/map/mapLayers';

/** Detalle de un elemento de catastro (click en el mapa fuera de modo simulación). */
export function useElementoRed(elemento: { tipo: ElementoRedTipo; id: number } | null) {
  return useQuery({
    queryKey: ['red-elemento', elemento?.tipo, elemento?.id],
    queryFn: () => getElementoRed(elemento!.tipo, elemento!.id),
    enabled: elemento !== null,
  });
}

/** Catálogo de materiales por grupo. `enabled` controla cuándo se dispara la carga
 * (típicamente al abrir el combo de material). Cachea largo (rara vez cambia). */
export function useMateriales(grupo: 'AGUA POTABLE' | 'ALCANTARILLADO' | null) {
  return useQuery({
    queryKey: ['red-materiales', grupo],
    queryFn: () => getMateriales(grupo!),
    enabled: grupo !== null,
    staleTime: 5 * 60 * 1000,
  });
}

/** Compat con el endpoint viejo /materiales/{tipo}. Reservado para el caso en que
 * un consumer se referencie por tipo de elemento (tuberia/tramo) sin conocer el
 * `grupo` de materiales — internamente el backend hace el mapeo. */
export function useMaterialesRed(tipo: ElementoRedTipo | null) {
  return useQuery({
    queryKey: ['red-materiales-por-tipo', tipo],
    queryFn: () => getMaterialesRed(tipo!),
    enabled: tipo !== null,
    staleTime: 5 * 60 * 1000,
  });
}

/** Catálogo de tipos de accesorio (codo, tapón, T, etc.). */
export function useAccesorioTipos(enabled: boolean, grupo?: string) {
  return useQuery({
    queryKey: ['accesorio-tipos', grupo ?? 'todos'],
    queryFn: () => getAccesorioTipos(grupo),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Catálogo de clasificaciones de accesorio. */
export function useAccesorioClasificaciones(enabled: boolean) {
  return useQuery({
    queryKey: ['accesorio-clasificaciones'],
    queryFn: getAccesorioClasificaciones,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Edición inline: PATCH y luego invalida la query del detalle para refetchear el
 * elemento actualizado. El caller se encarga del ConfirmDialog + toast. */
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
