import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import { toIncidencia } from '@/api/mappers';
import type { ApiIncidenciaListResponse } from '@/api/types';
import type { RangoFechas } from '@/state/filtersStore';
import { useFiltersStore } from '@/state/filtersStore';
import { useUbicacionStore } from '@/state/ubicacionStore';

/** `rangoFechas` (preset del filtro) -> parámetros de fecha que espera el backend
 * (API.md § 3: fecha=hoy es un atajo especial; fechaDesde/fechaHasta son fechas
 * ISO sueltas). 'todo' no manda ningún parámetro de fecha. Si el usuario eligió un
 * rango explícito (dos <input type="date">, FiltersSidebar web) con AMBOS extremos
 * seteados, ese manda sobre el preset — mismos nombres de query param, el backend
 * ya los soporta (app/shared/deps.py). */
function paramsDeFecha(rango: RangoFechas, fechaDesde: string | null, fechaHasta: string | null): Record<string, string> {
  if (fechaDesde && fechaHasta) return { fechaDesde, fechaHasta };
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
  const fechaDesde = useFiltersStore((s) => s.fechaDesde);
  const fechaHasta = useFiltersStore((s) => s.fechaHasta);
  const soloNoResueltas = useFiltersStore((s) => s.soloNoResueltas);
  const distritoActivo = useUbicacionStore((s) => s.distritoActivo);
  const sectorActivo = useUbicacionStore((s) => s.sectorActivo);

  return useQuery({
    queryKey: [
      'incidencias-hoy',
      categorias,
      prioridades,
      tipoAtencion,
      estado,
      rangoFechas,
      fechaDesde,
      fechaHasta,
      soloNoResueltas,
      distritoActivo,
      sectorActivo,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        categoria: categorias.join(','),
        prioridad: prioridades.join(','),
        pageSize: '100',
        ...paramsDeFecha(rangoFechas, fechaDesde, fechaHasta),
      });
      if (tipoAtencion) params.set('tipoAtencionId', tipoAtencion);
      if (estado) params.set('estado', estado);
      if (soloNoResueltas) params.set('resuelto', 'false');
      // Sector manda sobre distrito si hay ambos (más específico) — mismo criterio
      // que ya usa MapView.web.tsx para centrar la cámara. Ambos son selección
      // única ahora (rediseño 2026-08-11, ver ubicacionStore.ts) — ya no hace
      // falta desambiguar un Set a un solo valor.
      if (sectorActivo) {
        params.set('sectorId', sectorActivo);
      } else if (distritoActivo) {
        params.set('distritoId', distritoActivo);
      }

      const response = await apiFetch<ApiIncidenciaListResponse>(`/incidencias?${params.toString()}`);
      // El mapa necesita coordenadas reales para agrupar/plotear — descartar las que
      // el catastro no pudo resolver (suministro_codigo sin match en `sig`, ver
      // memoria del backend) en vez de plotearlas en (0,0).
      return response.items.filter((i) => i.lat !== null && i.lon !== null).map(toIncidencia);
    },
  });
}
