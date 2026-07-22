import { INCIDENCIAS_ALL } from '@/mocks/incidentsMock';

export type KpiCard = { label: string; value: string };

/**
 * KPIs del Dashboard (Spec 09, RF-09.2): **en espera, decisión de Edgar** — no se
 * confirmaron los 4 KPIs propuestos en `specs/09-dashboard.md` § 2 ni se definieron
 * otros. Estos valores son mock estático (no calculados de `INCIDENCIAS_ALL`),
 * únicamente para no dejar el layout con el texto de plantilla en inglés del diseño
 * original (Views/Visits/New Users/Active Users). No conectar a datos reales sin
 * antes validar con negocio qué métricas debe mostrar esta fila.
 */
export const KPI_CARDS_MOCK: KpiCard[] = [
  { label: 'Incidencias abiertas hoy', value: '12' },
  { label: 'Incidencias críticas', value: '3' },
  { label: 'Tiempo prom. atención', value: '18.4 h' },
  { label: 'Cuadrillas activas', value: '5' },
];

/** RF-09.3: split real Agua/Desagüe, calculado de `INCIDENCIAS_ALL`. */
export function getCategoriaSplit(): { agua: number; desague: number } {
  const total = INCIDENCIAS_ALL.length;
  const agua = INCIDENCIAS_ALL.filter((i) => i.categoria === 'agua').length;
  const aguaPct = Math.round((agua / total) * 100);
  return { agua: aguaPct, desague: 100 - aguaPct };
}

/** RF-09.5: top tipos de atención por volumen, calculado de `INCIDENCIAS_ALL`. */
export function getTopTipos(limit = 5): { tipo: string; cantidad: number }[] {
  const counts = new Map<string, number>();
  for (const i of INCIDENCIAS_ALL) counts.set(i.tipo, (counts.get(i.tipo) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tipo, cantidad]) => ({ tipo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, limit);
}

export type SectorPrioridad = { sector: string; antiguedadPromedio: number; color: 'verde' | 'amarillo' | 'rojo' };

/**
 * RF-09.6: antigüedad promedio de incidencias abiertas (estado ≠ ATENDIDO) por
 * sector, calculado de `INCIDENCIAS_ALL`. Umbrales del diseño (se respetan tal cual):
 * verde ≤11d, amarillo 11-22d, rojo >22d.
 *
 * El diseño muestra una grilla de 27 celdas ilustrativa; el mock solo tiene 4 sectores
 * reales (Sector 1, 3, 4, 5), así que la grilla se dibuja con esas 4 celdas reales en
 * vez de inventar sub-sectores para llenar el espacio.
 */
export function getPrioridadPorSector(): SectorPrioridad[] {
  const abiertas = INCIDENCIAS_ALL.filter((i) => i.estado !== 'ATENDIDO');
  const bySector = new Map<string, number[]>();
  for (const i of abiertas) {
    const key = i.sector;
    if (!bySector.has(key)) bySector.set(key, []);
    bySector.get(key)!.push(i.antiguedadDias);
  }
  return [...bySector.entries()]
    .map(([sector, dias]) => {
      const antiguedadPromedio = dias.reduce((a, b) => a + b, 0) / dias.length;
      const color: SectorPrioridad['color'] =
        antiguedadPromedio <= 11 ? 'verde' : antiguedadPromedio <= 22 ? 'amarillo' : 'rojo';
      return { sector, antiguedadPromedio: Math.round(antiguedadPromedio * 10) / 10, color };
    })
    .sort((a, b) => a.sector.localeCompare(b.sector));
}

export type SerieTicketsPunto = { mes: string; agua: number; desague: number };

/**
 * RF-09.4: serie mensual "Tickets" — ilustrativa (no derivada de `INCIDENCIAS_ALL`,
 * que solo cubre ~40 días): mismo criterio que `docs/API.md` § 8 (`serieTickets`),
 * cuya muestra ya era ilustrativa antes de esta sesión.
 */
export const SERIE_TICKETS: SerieTicketsPunto[] = [
  { mes: 'Ene', agua: 1180, desague: 1350 },
  { mes: 'Feb', agua: 1210, desague: 1300 },
  { mes: 'Mar', agua: 1340, desague: 1260 },
  { mes: 'Abr', agua: 1290, desague: 1400 },
  { mes: 'May', agua: 1360, desague: 1420 },
  { mes: 'Jun', agua: 1420, desague: 1480 },
  { mes: 'Jul', agua: 1500, desague: 1450 },
  { mes: 'Ago', agua: 1470, desague: 1380 },
  { mes: 'Sep', agua: 1380, desague: 1310 },
  { mes: 'Oct', agua: 1300, desague: 1260 },
  { mes: 'Nov', agua: 1230, desague: 1200 },
  { mes: 'Dic', agua: 1190, desague: 1150 },
];
