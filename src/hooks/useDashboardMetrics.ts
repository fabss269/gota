import { useQuery } from '@tanstack/react-query';

import {
  getCategoriaSplit,
  getPrioridadPorSector,
  getTopTipos,
  KPI_CARDS_MOCK,
  SERIE_TICKETS,
} from '@/mocks/dashboardMock';

/**
 * Métricas del Dashboard (Spec 09). Equivalente real: `GET /dashboard/resumen`
 * (docs/API.md § 8). Los KPIs (`KPI_CARDS_MOCK`) son mock estático a propósito — ver
 * comentario en `src/mocks/dashboardMock.ts`.
 */
export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard-resumen'],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        kpis: KPI_CARDS_MOCK,
        categoriaSplit: getCategoriaSplit(),
        serieTickets: SERIE_TICKETS,
        topTipos: getTopTipos(5),
        prioridadPorSector: getPrioridadPorSector(),
      };
    },
  });
}
