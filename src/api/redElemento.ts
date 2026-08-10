import { apiFetch } from '@/api/client';
import type { ApiAccesorioClasificacion, ApiAccesorioTipo, ApiElementoRedDetalle, ApiMaterial } from '@/api/types';
import type { ElementoRedTipo } from '@/components/map/mapLayers';

export function getElementoRed(tipo: ElementoRedTipo, id: number): Promise<ApiElementoRedDetalle> {
  return apiFetch<ApiElementoRedDetalle>(`/red/elemento/${tipo}/${id}`);
}

/** Body de PATCH /red/elemento/{tipo}/{id} — el backend valida con whitelist por
 * tipo (ver CAMPOS_EDITABLES_POR_TIPO en app/modules/red/service.py), acá solo se
 * declaran todos los campos posibles; cada tipo usa el subconjunto que le aplica. */
export type ElementoRedPatch = {
  primaria?: boolean;
  pendiente?: number;
  distancia?: number;
  materialId?: number;
  diametroPulgadas?: number;
  profundidad?: number;
  accesorioTipoId?: number;
  accesorioClasificacionId?: number;
  cota?: number;
  tapa?: number;
  fondo?: number;
};

/** Edición inline del panel de elemento — el campo enviado depende del tipo
 * (ver ElementoInfoPanel.web.tsx), ver API.md § 7. */
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

/** Catálogo de materiales (sig.materiales), opcionalmente filtrado por `grupo`
 * ('AGUA POTABLE' | 'ALCANTARILLADO'). Sin `grupo` trae todos. */
export function getMaterialesRed(grupo?: string): Promise<ApiMaterial[]> {
  const query = grupo ? `?${new URLSearchParams({ grupo })}` : '';
  return apiFetch<ApiMaterial[]>(`/red/materiales${query}`);
}

/** Catálogo de tipos de accesorio (sig.accesoriotipos), opcionalmente por `grupo`. */
export function getAccesorioTipos(grupo?: string): Promise<ApiAccesorioTipo[]> {
  const query = grupo ? `?${new URLSearchParams({ grupo })}` : '';
  return apiFetch<ApiAccesorioTipo[]>(`/red/accesorio-tipos${query}`);
}

/** Catálogo de clasificaciones de accesorio (sig.accesorioclasificacion) — sin filtro
 * por grupo, el backend no lo expone (una sola lista para todos los accesorios). */
export function getAccesorioClasificaciones(): Promise<ApiAccesorioClasificacion[]> {
  return apiFetch<ApiAccesorioClasificacion[]>('/red/accesorio-clasificaciones');
}
