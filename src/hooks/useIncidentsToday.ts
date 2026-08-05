import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import { toIncidencia } from '@/api/mappers';
import type { ApiIncidenciaListResponse } from '@/api/types';
import type { RangoFechas } from '@/state/filtersStore';
import { useFiltersStore } from '@/state/filtersStore';
import { useUbicacionStore } from '@/state/ubicacionStore';

/** `rangoFechas` (preset del filtro) -> parámetros de fecha que espera el backend
 * (API.md § 3: fecha=hoy es un atajo especial; fechaDesde/fechaHasta son fechas
 * ISO sueltas). 'todo' no manda ningún parámetro de fecha. */
function paramsDeFecha(rango: RangoFechas): Record<string, string> {
  if (rango === 'hoy') return { fecha: 'hoy' };
  if (rango === 'todo') return {};

  const hoy = new Date();
  const hastaISO = hoy.toISOString().slice(0, 10);
  let desde: Date;
  if (rango === '7d') {
    desde = new Date(hoy);
    desde.setDate(desde.getDate() - 7);
  } else if (rango === '30d') {
    desde = new Date(hoy);
    desde.setDate(desde.getDate() - 30);
  } else {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }
  return { fechaDesde: desde.toISOString().slice(0, 10), fechaHasta: hastaISO };
}

/**
 * Trae las incidencias (Spec 03, RF-03.4) aplicando los filtros del Bottom Sheet
 * (Spec 04) — incluye Ubicación (mismo `useUbicacionStore` que ya usa la cámara del
 * mapa y la pestaña Capas, así que seleccionar un distrito/sector ahí también filtra
 * acá) y Rango de fechas. `GET /incidencias?...` (API.md § 3).
 */
export function useIncidentsToday() {
  const categorias = useFiltersStore((s) => s.categorias);
  const prioridades = useFiltersStore((s) => s.prioridades);
  const tipoAtencion = useFiltersStore((s) => s.tipoAtencion);
  const estado = useFiltersStore((s) => s.estado);
  const rangoFechas = useFiltersStore((s) => s.rangoFechas);
  const distritosActivos = useUbicacionStore((s) => s.distritosActivos);
  const sectoresActivos = useUbicacionStore((s) => s.sectoresActivos);

  return useQuery({
    queryKey: [
      'incidencias-hoy',
      categorias,
      prioridades,
      tipoAtencion,
      estado,
      rangoFechas,
      [...distritosActivos],
      [...sectoresActivos],
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        categoria: categorias.join(','),
        prioridad: prioridades.join(','),
        pageSize: '100',
        ...paramsDeFecha(rangoFechas),
      });
      if (tipoAtencion) params.set('tipoAtencionId', tipoAtencion);
      if (estado) params.set('estado', estado);
      // Sector manda sobre distrito si hay ambos (más específico) — mismo criterio
      // que ya usa MapView.web.tsx para centrar la cámara. distritoId es un solo
      // valor en el backend (IncidenciaService.listar lo pasa directo a
      // listar_sectores, no lo separa por coma como sectorId) — tomar el primero
      // alcanza porque UbicacionPicker (la UI que llena este store acá) es de
      // selección única para distrito.
      if (sectoresActivos.size > 0) {
        params.set('sectorId', [...sectoresActivos].join(','));
      } else if (distritosActivos.size > 0) {
        params.set('distritoId', [...distritosActivos][0]);
      }

      const response = await apiFetch<ApiIncidenciaListResponse>(`/incidencias?${params.toString()}`);
      // El mapa necesita coordenadas reales para agrupar/plotear — descartar las que
      // el catastro no pudo resolver (suministro_codigo sin match en `sig`, ver
      // memoria del backend) en vez de plotearlas en (0,0).
      return response.items.filter((i) => i.lat !== null && i.lon !== null).map(toIncidencia);
    },
  });
}
