import type { ApiBbox } from '@/api/types';
import type { CapaKey } from '@/state/capasStore';

/** Expresión de filtro/paint de MapLibre — mismo shape en maplibre-gl-js (web) y
 * @maplibre/maplibre-react-native (nativo), evitar importar el tipo de una sola
 * plataforma acá para que este módulo siga siendo compartido. */
export type MapExpression = unknown[];

// Une cada toggle de CapasTab/FiltersSidebar con los layers reales del style.json
// (Martin → sig). Compartido entre MapView.tsx (nativo) y MapView.web.tsx.
export const CAPA_LAYER_IDS: Record<CapaKey, string[]> = {
  manzanas: ['manzanas-fill', 'manzanas-outline'],
  lotes: ['lotes-fill', 'lotes-outline'],
  red_potable: ['agua-red'],
  conexion_agua: ['cajaaguaconexion-line'],
  caja_agua: ['cajaagua-circle'],
  red_primaria_desague: ['alcantarillado-primaria'],
  red_secundaria_desague: ['alcantarillado-secundaria'],
  conexion_desague: ['cajadesagueconexion-line'],
  caja_desague: ['cajadesague-circle'],
  buzones: ['buzones-circle'],
  flujo_desague: ['alcantarillado-flujo-flecha'],
  // resaltar_sector no tiene layers propios: lo maneja aparte el resaltado de sector
  // (necesita togglear el filtro, no solo la visibilidad).
  resaltar_sector: [],
};

// Capas de catastro filtrables por sectorid cuando hay un sector activo en UBICACIÓN
// (ver ubicacionStore.sectoresActivos). alcantarillado-primaria/secundaria ya traen su
// propio filtro base (primaria true/false) que hay que preservar combinándolo con el
// de sector.
export const CATASTRO_SECTOR_FILTER_LAYERS: { id: string; baseFilter?: MapExpression }[] = [
  { id: 'manzanas-fill' },
  { id: 'manzanas-outline' },
  { id: 'lotes-fill' },
  { id: 'lotes-outline' },
  { id: 'agua-red' },
  { id: 'cajaaguaconexion-line' },
  { id: 'cajaagua-circle' },
  { id: 'alcantarillado-primaria', baseFilter: ['==', ['get', 'primaria'], true] },
  { id: 'alcantarillado-secundaria', baseFilter: ['==', ['get', 'primaria'], false] },
  { id: 'alcantarillado-flujo-flecha' },
  { id: 'cajadesagueconexion-line' },
  { id: 'cajadesague-circle' },
  { id: 'buzones-circle' },
];

// Tres capas por el mismo source "sectores" (ver map-style.json): relleno traslúcido,
// halo blanco, y la línea de color encima. El halo es blanco fijo — solo fill y line
// necesitan el match de color por sectorid.
export const SECTOR_LAYER_IDS = ['sectores-resaltado-fill', 'sectores-resaltado-halo', 'sectores-resaltado'];
export const SECTOR_COLOR_LAYER_IDS: [string, 'fill-color' | 'line-color'][] = [
  ['sectores-resaltado-fill', 'fill-color'],
  ['sectores-resaltado', 'line-color'],
];

// Ángulo dorado (137.508°) para repartir tonos lo más separados posible entre sí,
// aunque los sectorid no sean consecutivos.
export function colorForSectorId(sectorId: string): string {
  const hue = (Number(sectorId) * 137.508) % 360;
  return `hsl(${hue.toFixed(0)}, 75%, 45%)`;
}

export function unionBbox(boxes: ApiBbox[]): ApiBbox {
  return boxes.reduce((acc, b) => ({
    minLon: Math.min(acc.minLon, b.minLon),
    minLat: Math.min(acc.minLat, b.minLat),
    maxLon: Math.max(acc.maxLon, b.maxLon),
    maxLat: Math.max(acc.maxLat, b.maxLat),
  }));
}
