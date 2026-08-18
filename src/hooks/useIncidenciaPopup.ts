import { useQuery } from '@tanstack/react-query';

import { dashboardGeoApi } from '@/api/dashboardGeo';

/** Detalle de una incidencia para mostrar en el popup del mapa. */
export function useIncidenciaPopup(codigo: string | null) {
  return useQuery({
    queryKey: ['dashboard-geo', 'popup', codigo],
    queryFn: () => dashboardGeoApi.popup(codigo!),
    enabled: !!codigo,
    staleTime: 60_000,
  });
}
