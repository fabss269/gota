import type { Incidencia, Prioridad } from '@/mocks/incidentsMock';

export type IncidentCluster = {
  id: string;
  lat: number;
  lon: number;
  count: number;
  prioridadMaxima: Prioridad;
  categoriaDominante: 'agua' | 'desague' | 'mixta';
  incidencias: Incidencia[];
};

const PRIORIDAD_RANK: Record<Prioridad, number> = { a_tiempo: 0, alerta: 1, critica: 2 };

// Radio de agrupación aproximado (grados). Suficiente para agrupar incidencias de una
// misma cuadra/zona sin necesitar un endpoint de clustering en el backend todavía
// (ver docs/API.md § 3, nota de implementación).
const CLUSTER_RADIUS_DEG = 0.003;

export function clusterIncidents(incidencias: Incidencia[]): IncidentCluster[] {
  const clusters: IncidentCluster[] = [];

  for (const incidencia of incidencias) {
    const existing = clusters.find(
      (c) =>
        Math.abs(c.lat - incidencia.lat) < CLUSTER_RADIUS_DEG &&
        Math.abs(c.lon - incidencia.lon) < CLUSTER_RADIUS_DEG,
    );

    if (existing) {
      existing.incidencias.push(incidencia);
      existing.count += 1;
      if (PRIORIDAD_RANK[incidencia.prioridad] > PRIORIDAD_RANK[existing.prioridadMaxima]) {
        existing.prioridadMaxima = incidencia.prioridad;
      }
      if (existing.categoriaDominante !== 'mixta' && existing.categoriaDominante !== incidencia.categoria) {
        existing.categoriaDominante = 'mixta';
      }
    } else {
      clusters.push({
        id: `cluster-${incidencia.id}`,
        lat: incidencia.lat,
        lon: incidencia.lon,
        count: 1,
        prioridadMaxima: incidencia.prioridad,
        categoriaDominante: incidencia.categoria,
        incidencias: [incidencia],
      });
    }
  }

  return clusters;
}
