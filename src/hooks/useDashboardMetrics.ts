import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import type { ApiDashboardResumen } from '@/api/types';
import { KPI_CARDS_MOCK, type SectorPrioridad } from '@/mocks/dashboardMock';

function toSectorPrioridad(p: ApiDashboardResumen['prioridadPorSector'][number]): SectorPrioridad {
  const dias = p.antiguedadPromedioDias;
  const color: SectorPrioridad['color'] = dias <= 11 ? 'verde' : dias <= 22 ? 'amarillo' : 'rojo';
  return { sector: p.nombre, antiguedadPromedio: Math.round(dias * 10) / 10, color };
}

/**
 * Métricas del Dashboard (Spec 09). `GET /dashboard/resumen` (docs/API.md § 8).
 * Los KPIs (`KPI_CARDS_MOCK`) se mantienen mock a propósito — decisión de Edgar
 * (2026-07-21, "en espera"), no un gap técnico a cerrar: ver comentario en
 * `src/mocks/dashboardMock.ts`.
 */
export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard-resumen'],
    queryFn: async () => {
      const resumen = await apiFetch<ApiDashboardResumen>('/dashboard/resumen');

      const agua = resumen.porCategoria.agua ?? 0;
      const desague = resumen.porCategoria.desague ?? 0;
      const total = agua + desague;
      const aguaPct = total > 0 ? Math.round((agua / total) * 100) : 0;

      return {
        kpis: KPI_CARDS_MOCK,
        categoriaSplit: { agua: aguaPct, desague: 100 - aguaPct },
        serieTickets: resumen.serieTickets,
        topTipos: resumen.topTiposAtencion,
        prioridadPorSector: resumen.prioridadPorSector.map(toSectorPrioridad),
      };
    },
  });
}
