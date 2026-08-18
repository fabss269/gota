import { apiFetch } from '@/api/client';
import type {
  ApiAccesorioClasificacion,
  ApiAccesorioTipo,
  ApiElementoRedDetalle,
  ApiMaterial,
} from '@/api/types';
import type { ElementoRedTipo } from '@/components/map/mapLayers';

export function getElementoRed(tipo: ElementoRedTipo, id: number): Promise<ApiElementoRedDetalle> {
  return apiFetch<ApiElementoRedDetalle>(`/red/elemento/${tipo}/${id}`);
}

/** Todos los campos son opcionales — el backend valida qué aplican por tipo con una
 * whitelist. Enviar solo el/los campos que efectivamente cambiaron. */
export type ElementoRedPatch = {
  // Alcantarillado
  primaria?: boolean;
  pendiente?: number;
  // Alcantarillado + Agua
  distancia?: number;
  materialId?: number;
  // Agua + Accesorios
  diametroPulgadas?: number;
  // Accesorios
  profundidad?: number;
  accesorioTipoId?: number;
  accesorioClasificacionId?: number;
  // Cajas
  cota?: number;
  // Buzones
  tapa?: number;
  fondo?: number;
};

export function patchElementoRed(
  tipo: ElementoRedTipo,
  id: number,
  patch: ElementoRedPatch,
): Promise<void> {
  return apiFetch<void>(`/red/elemento/${tipo}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

// ── Catálogos para poblar combos editables ────────────────────────────────────

/** Materiales filtrados por grupo (`AGUA POTABLE` o `ALCANTARILLADO`). */
export function getMateriales(grupo?: 'AGUA POTABLE' | 'ALCANTARILLADO'): Promise<ApiMaterial[]> {
  const qs = grupo ? `?grupo=${encodeURIComponent(grupo)}` : '';
  return apiFetch<ApiMaterial[]>(`/red/materiales${qs}`);
}

/** Compat con el endpoint viejo por tipo — el service ya resuelve el grupo. */
export function getMaterialesRed(tipo: ElementoRedTipo): Promise<ApiMaterial[]> {
  return apiFetch<ApiMaterial[]>(`/red/materiales/${tipo}`);
}

/** Catálogo de tipos de accesorio (codo, tapón, T, cruz, válvula, etc.). */
export function getAccesorioTipos(grupo?: string): Promise<ApiAccesorioTipo[]> {
  const qs = grupo ? `?grupo=${encodeURIComponent(grupo)}` : '';
  return apiFetch<ApiAccesorioTipo[]>(`/red/accesorio-tipos${qs}`);
}

/** Catálogo de clasificaciones de accesorio. */
export function getAccesorioClasificaciones(): Promise<ApiAccesorioClasificacion[]> {
  return apiFetch<ApiAccesorioClasificacion[]>(`/red/accesorio-clasificaciones`);
}
