import type { Incidencia, Prioridad } from '@/mocks/incidentsMock';

export type IncidentCluster = {
  id: string;
  lat: number;
  lon: number;
  count: number;
  prioridadMaxima: Prioridad;
  categoriaDominante: 'agua' | 'desague';
  incidencias: Incidencia[];
};

/**
 * Mapea 1:1 cada Incidencia consolidada del backend a un marker del mapa.
 *
 * El backend YA agrupa por (suministro + tipo_atencion + ventana de 72h), por lo
 * que cada `Incidencia` que llega acá es una entidad de negocio única — el
 * frontend NO hace un segundo agrupamiento geográfico (eso mezclaba incidencias
 * de suministros/tipos distintos que solo estaban cerca en el mapa, y forzaba
 * una pseudo-categoría "mixta" que no existe en el dominio).
 *
 * `count` refleja cuántos reclamos originales el backend consolidó en esa
 * incidencia (campo `quejasAgrupadas`). Hoy el endpoint del listado
 * (`ApiIncidencia`) no lo expone, así que arranca en 1; cuando el backend lo
 * agregue, este mapper lo consume sin cambios adicionales.
 *
 * TODO (foco por calle): cuando varias incidencias distintas caen sobre la
 * misma vía, mostrar una mancha/heat sobre esa calle en vez de N markers
 * separados. Requiere geometría de la calle y agregación server-side.
 */
export function clusterIncidents(incidencias: Incidencia[]): IncidentCluster[] {
  return incidencias.map((incidencia) => ({
    id: `cluster-${incidencia.id}`,
    lat: incidencia.lat,
    lon: incidencia.lon,
    count: (incidencia as Incidencia & { quejasAgrupadas?: number }).quejasAgrupadas ?? 1,
    prioridadMaxima: incidencia.prioridad,
    categoriaDominante: incidencia.categoria,
    incidencias: [incidencia],
  }));
}
