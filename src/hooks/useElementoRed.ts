import { useQuery } from '@tanstack/react-query';

import { getElementoRed } from '@/api/redElemento';
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
