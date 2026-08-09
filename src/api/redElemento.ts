import { apiFetch } from '@/api/client';
import type { ApiElementoRedDetalle, ApiMaterial } from '@/api/types';
import type { ElementoRedTipo } from '@/components/map/mapLayers';

export function getElementoRed(tipo: ElementoRedTipo, id: number): Promise<ApiElementoRedDetalle> {
  return apiFetch<ApiElementoRedDetalle>(`/red/elemento/${tipo}/${id}`);
}

export type ElementoRedPatch = { diametroPulgadas?: number; materialId?: number };

/** Edición inline (estilo Jira) de diámetro/material — solo tuberia/tramo,
 * ver API.md § 7. */
export function patchElementoRed(
  tipo: ElementoRedTipo,
  id: number,
  patch: ElementoRedPatch
): Promise<void> {
  return apiFetch<void>(`/red/elemento/${tipo}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** Catálogo de materiales (sig.materiales por grupo) para el selector del PATCH
 * de arriba — `tipo` es 'tuberia' o 'tramo', igual que el resto de este módulo. */
export function getMaterialesRed(tipo: ElementoRedTipo): Promise<ApiMaterial[]> {
  return apiFetch<ApiMaterial[]>(`/red/materiales/${tipo}`);
}
