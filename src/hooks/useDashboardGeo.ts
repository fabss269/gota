import { useQuery } from '@tanstack/react-query';

import { dashboardGeoApi, type Grupo } from '@/api/dashboardGeo';
import { useDashboardFilters } from '@/state/dashboardFilters';

// Todos los hooks leen del store global, así se re-fetchean automáticamente
// cuando cambian los filtros (periodo, grupo, sector).

const STALE = 60_000;
const grupoParam = (g: Grupo) => (g === 'todos' ? undefined : g);

export function useIncidenciaPopup(codigo: string | null) {
  return useQuery({
    queryKey: ['dashboard-geo', 'popup', codigo],
    queryFn: () => dashboardGeoApi.popup(codigo!),
    enabled: !!codigo,
    staleTime: STALE,
  });
}

export function useKpis() {
  const { periodo, grupo, sectorid, anio, mes } = useDashboardFilters();
  const m = periodo === 'mensual' ? mes : undefined;
  return useQuery({
    queryKey: ['dashboard-geo', 'kpis', periodo, grupo, sectorid, anio, m],
    queryFn: () => dashboardGeoApi.kpis({ periodo, grupo, sectorid, anio, mes: m }),
    staleTime: STALE,
  });
}

export function useStorytelling() {
  const { periodo, grupo, sectorid, anio, mes } = useDashboardFilters();
  const m = periodo === 'mensual' ? mes : undefined;
  return useQuery({
    queryKey: ['dashboard-geo', 'story', periodo, grupo, sectorid, anio, m],
    queryFn: () => dashboardGeoApi.storytelling({ periodo, grupo, sectorid, anio, mes: m }),
    staleTime: STALE,
  });
}

export function useTopSectores(limite = 10) {
  const { grupo } = useDashboardFilters();
  return useQuery({
    queryKey: ['dashboard-geo', 'sectores', grupo, limite],
    queryFn: () => dashboardGeoApi.sectores({ grupo: grupoParam(grupo), limite }),
    staleTime: STALE,
  });
}

export function useHeatmapSectores() {
  const { grupo } = useDashboardFilters();
  return useQuery({
    queryKey: ['dashboard-geo', 'heatmap', grupo],
    queryFn: () => dashboardGeoApi.heatmapSectores({ grupo: grupoParam(grupo) }),
    staleTime: STALE,
  });
}

export function useTopCalles(limite = 10) {
  const { grupo, sectorid } = useDashboardFilters();
  return useQuery({
    queryKey: ['dashboard-geo', 'calles', grupo, sectorid, limite],
    queryFn: () => dashboardGeoApi.topCalles({ grupo: grupoParam(grupo), sectorid, limite }),
    staleTime: STALE,
  });
}

export function useSerieMensual() {
  const { grupo, sectorid } = useDashboardFilters();
  return useQuery({
    queryKey: ['dashboard-geo', 'serie-mensual', grupo, sectorid],
    queryFn: () => dashboardGeoApi.serieMensual({ grupo: grupoParam(grupo), sectorid }),
    staleTime: STALE,
  });
}

export function useTiempoResolucionMensual() {
  const { grupo, sectorid } = useDashboardFilters();
  return useQuery({
    queryKey: ['dashboard-geo', 'tiempo-res', grupo, sectorid],
    queryFn: () =>
      dashboardGeoApi.tiempoResolucionMensual({ grupo: grupoParam(grupo), sectorid }),
    staleTime: STALE,
  });
}

export function useRobosMensual() {
  const { anio } = useDashboardFilters();
  return useQuery({
    queryKey: ['dashboard-geo', 'robos-mensual', anio],
    queryFn: () => dashboardGeoApi.robosMensual({ anio }),
    staleTime: STALE,
  });
}

export function useTipoAtencionMensual() {
  const { grupo, sectorid } = useDashboardFilters();
  return useQuery({
    queryKey: ['dashboard-geo', 'tipo-atencion', grupo, sectorid],
    queryFn: () =>
      dashboardGeoApi.tipoAtencionMensual({ grupo: grupoParam(grupo), sectorid }),
    staleTime: STALE,
  });
}

export function useReincidentes() {
  const { reincMeses, reincMinimo } = useDashboardFilters();
  return useQuery({
    queryKey: ['dashboard-geo', 'reinc', reincMeses, reincMinimo],
    queryFn: () =>
      dashboardGeoApi.reincidentes({ meses: reincMeses, minimo: reincMinimo, solo_robo: false }),
    staleTime: STALE,
  });
}

export function useReincidentesRobo() {
  const { reincRoboMeses, reincRoboMinimo } = useDashboardFilters();
  return useQuery({
    queryKey: ['dashboard-geo', 'reinc-robo', reincRoboMeses, reincRoboMinimo],
    queryFn: () =>
      dashboardGeoApi.reincidentes({
        meses: reincRoboMeses,
        minimo: reincRoboMinimo,
        solo_robo: true,
      }),
    staleTime: STALE,
  });
}

export function useSinSolucion(limite = 20) {
  const { grupo, sectorid } = useDashboardFilters();
  return useQuery({
    queryKey: ['dashboard-geo', 'sin-sol', grupo, sectorid, limite],
    queryFn: () =>
      dashboardGeoApi.sinSolucion({ grupo: grupoParam(grupo), sectorid, limite }),
    staleTime: STALE,
  });
}

export function useMultiReclamos(minimo = 2, limite = 20) {
  const { grupo, sectorid } = useDashboardFilters();
  return useQuery({
    queryKey: ['dashboard-geo', 'multi', grupo, sectorid, minimo, limite],
    queryFn: () =>
      dashboardGeoApi.multiReclamos({ grupo: grupoParam(grupo), sectorid, minimo, limite }),
    staleTime: STALE,
  });
}

export function useParentesco() {
  const { grupo, sectorid } = useDashboardFilters();
  return useQuery({
    queryKey: ['dashboard-geo', 'parentesco', grupo, sectorid],
    queryFn: () => dashboardGeoApi.parentesco({ grupo: grupoParam(grupo), sectorid }),
    staleTime: STALE,
  });
}

export function useAlertas() {
  return useQuery({
    queryKey: ['dashboard-geo', 'alertas'],
    queryFn: () => dashboardGeoApi.alertas(),
    staleTime: STALE,
  });
}
