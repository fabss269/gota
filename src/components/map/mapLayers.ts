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
  red_potable: ['agua-red', 'agua-red-diametro-label'],
  conexion_agua: ['cajaaguaconexion-line'],
  caja_agua: ['cajaagua-circle'],
  accesorios: ['accesorios-circle'],
  red_primaria_desague: ['alcantarillado-primaria'],
  red_secundaria_desague: ['alcantarillado-secundaria'],
  conexion_desague: ['cajadesagueconexion-line'],
  caja_desague: ['cajadesague-circle'],
  buzones: ['buzones-circle'],
  flujo_desague: ['alcantarillado-flujo-flecha'],
  reservorios: ['reservorios-icon'],
  // resaltar_sector no tiene layers propios: lo maneja aparte el resaltado de sector
  // (necesita togglear el filtro, no solo la visibilidad).
  resaltar_sector: [],
};

// Mapa inverso layer id -> CapaKey — usado por el click handler de modo simulación
// (MapView.web.tsx) para verificar que la capa del elemento clickeado esté
// realmente visible (no solo que exista en el style), y por el efecto de modo
// vista para restaurar la visibilidad correcta de layers que se ocultan sin
// distinción propia (ver SIMULACION_OCULTAR_EN_VISTA).
export const CAPA_KEY_POR_LAYER_ID: Partial<Record<string, CapaKey>> = Object.fromEntries(
  Object.entries(CAPA_LAYER_IDS).flatMap(([capa, layers]) => layers.map((l) => [l, capa as CapaKey]))
);

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
  // Bug real 2026-08-11: esta capa quedó afuera de la lista, así que nunca se
  // filtraba por sector — se veían diámetros de tramos fuera del sector activo
  // aunque la línea (agua-red) sí estuviera correctamente oculta.
  { id: 'agua-red-diametro-label' },
  { id: 'cajaaguaconexion-line' },
  { id: 'cajaagua-circle' },
  { id: 'accesorios-circle' },
  { id: 'alcantarillado-primaria', baseFilter: ['==', ['get', 'primaria'], true] },
  { id: 'alcantarillado-secundaria', baseFilter: ['==', ['get', 'primaria'], false] },
  { id: 'alcantarillado-flujo-flecha' },
  { id: 'cajadesagueconexion-line' },
  { id: 'cajadesague-circle' },
  { id: 'buzones-circle' },
];

// Capas con paint sensible a feature-state 'hover' en map-style.json (case sobre
// ["feature-state","hover"]) y `promoteId` configurado en su source — subconjunto
// de CATASTRO_SECTOR_FILTER_LAYERS que excluye:
//   - alcantarillado-flujo-flecha: flecha decorativa, sin promoteId, no es "un
//     elemento" clickeable.
//   - cajaaguaconexion-line / cajadesagueconexion-line: las conexiones no tienen
//     tabla de detalles (sig.cajaaguaconexion/cajadesagueconexion no exponen data
//     visible al usuario todavía), así que no son clickeables ni deberían dar
//     feedback visual de "puedo interactuar".
const NO_HOVEREABLES = new Set([
  'alcantarillado-flujo-flecha',
  'cajaaguaconexion-line',
  'cajadesagueconexion-line',
]);
export const HOVER_INTERACTIVE_LAYERS: string[] = CATASTRO_SECTOR_FILTER_LAYERS.map((l) => l.id).filter(
  (id) => !NO_HOVEREABLES.has(id)
);

// Mismo vocabulario que `ELEMENTO_TIPOS_VALIDOS` en gota-backend
// (app/modules/red/service.py) — identifica de qué tabla de `sig` viene el elemento.
export type ElementoRedTipo =
  | 'tuberia'
  | 'tramo'
  | 'buzon'
  | 'accesorio'
  | 'cajaagua'
  | 'cajadesague'
  | 'manzana'
  | 'lote';

// Capas clickeables (fuera de modo simulación) para abrir el panel de info de
// GET /red/elemento/{tipo}/{id} — la property de la que se lee el id es la misma que
// usa `promoteId` en map-style.json para cada source, así que feature-state y el id
// enviado al backend siempre coinciden.
export const ELEMENTO_INFO_LAYERS: { id: string; tipo: ElementoRedTipo; idProperty: string }[] = [
  { id: 'agua-red', tipo: 'tuberia', idProperty: 'aguaid' },
  { id: 'alcantarillado-primaria', tipo: 'tramo', idProperty: 'alcantarilladoid' },
  { id: 'alcantarillado-secundaria', tipo: 'tramo', idProperty: 'alcantarilladoid' },
  { id: 'buzones-circle', tipo: 'buzon', idProperty: 'buzonid' },
  { id: 'accesorios-circle', tipo: 'accesorio', idProperty: 'accesorioid' },
  { id: 'cajaagua-circle', tipo: 'cajaagua', idProperty: 'cajaaguaid' },
  { id: 'cajadesague-circle', tipo: 'cajadesague', idProperty: 'cajadesagueid' },
  { id: 'manzanas-fill', tipo: 'manzana', idProperty: 'manzanaid' },
  { id: 'lotes-fill', tipo: 'lote', idProperty: 'loteid' },
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

// ── Modo simulación: aislar + pintar de rojo la red afectada (modo vista) ──
//
// Mismo idioma que CATASTRO_SECTOR_FILTER_LAYERS/applySectorHighlight
// (MapView.web.tsx): filtrar por ['in', ['get', idProperty], ['literal', ids]]
// combinando con el baseFilter existente vía ['all', ...] cuando corresponde,
// solo que acá los ids vienen de ApiSimulacion.redAfectada (agrupados por
// elementoTipo) en vez de un sectorid activo.

export type IsolateLayerConfig = {
  id: string;
  idProperty: string;
  /** Coincide con ApiElementoRed.elementoTipo, o 'suministro' para las cajas
   * (que se identifican por inscripcion vía ApiAfectado, no por redAfectada). */
  elementoTipo: string;
  paintProp: 'line-color' | 'circle-color';
  baseFilter?: MapExpression;
};

export const SIMULACION_ISOLATE_LAYERS: IsolateLayerConfig[] = [
  { id: 'agua-red', idProperty: 'aguaid', elementoTipo: 'tuberia', paintProp: 'line-color' },
  {
    id: 'alcantarillado-primaria',
    idProperty: 'alcantarilladoid',
    elementoTipo: 'tramo',
    paintProp: 'line-color',
    baseFilter: ['==', ['get', 'primaria'], true],
  },
  {
    id: 'alcantarillado-secundaria',
    idProperty: 'alcantarilladoid',
    elementoTipo: 'tramo',
    paintProp: 'line-color',
    baseFilter: ['==', ['get', 'primaria'], false],
  },
  { id: 'buzones-circle', idProperty: 'buzonid', elementoTipo: 'buzon', paintProp: 'circle-color' },
  { id: 'accesorios-circle', idProperty: 'accesorioid', elementoTipo: 'accesorio', paintProp: 'circle-color' },
  { id: 'cajaagua-circle', idProperty: 'inscripcion', elementoTipo: 'suministro', paintProp: 'circle-color' },
  { id: 'cajadesague-circle', idProperty: 'inscripcion', elementoTipo: 'suministro', paintProp: 'circle-color' },
];

export const SIMULACION_AFECTADO_COLOR = '#FF3B30';

// Colores base (copiados de public/map-style.json), para restaurar al salir de
// modo vista sin depender de leer el style original de vuelta.
export const SIMULACION_COLOR_ORIGINAL: Record<string, string> = {
  'agua-red': '#29B6F6',
  'alcantarillado-primaria': '#5D4037',
  'alcantarillado-secundaria': '#A1887F',
  'buzones-circle': '#757575',
  'accesorios-circle': '#9C27B0',
  'cajaagua-circle': '#06B6D4',
  'cajadesague-circle': '#795548',
};

// Layers sin distinción afectado/no-afectado del backend (no aparecen en
// redAfectada) -> se ocultan por completo en modo vista, no tiene sentido
// aislarlas por id.
export const SIMULACION_OCULTAR_EN_VISTA = [
  'cajaaguaconexion-line',
  'cajadesagueconexion-line',
  'alcantarillado-flujo-flecha',
];
