import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import { toIncidencia } from '@/api/mappers';
import type { ApiIncidenciaListResponse } from '@/api/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { RangoFechas } from '@/state/filtersStore';
import { useFiltersStore } from '@/state/filtersStore';
import { useUbicacionStore } from '@/state/ubicacionStore';

// Togglear varios ójitos rápido en el árbol de UBICACIÓN (LocationTree.tsx)
// antes disparaba un fetch por cada click — bug real 2026-08-12, auditado en
// vivo (se sentía "congelado"). 300ms de pausa entre el último click y el
// fetch real es imperceptible para un click normal pero absorbe una racha de
// varios clicks seguidos en uno solo.
const DEBOUNCE_UBICACION_MS = 300;

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
  const sectoresVisiblesRaw = useUbicacionStore((s) => s.sectoresVisibles);
  const distritosSinSectorVisiblesRaw = useUbicacionStore((s) => s.distritosSinSectorVisibles);
  const sectoresVisibles = useDebouncedValue(sectoresVisiblesRaw, DEBOUNCE_UBICACION_MS);
  const distritosSinSectorVisibles = useDebouncedValue(distritosSinSectorVisiblesRaw, DEBOUNCE_UBICACION_MS);

  // Nada visible en UBICACIÓN = no mostrar nada (pedido de Edgar 2026-08-12,
  // consistente con la metáfora de capas: apagar todas las capas deja el
  // canvas vacío, no vuelve a mostrar todo sin filtrar). Antes esto mandaba
  // la request sin sectorId/distritoId, que el backend interpreta como "sin
  // acotar" — se salta el fetch entero en vez de pedir de más y descartar.
  const hayAlgoVisible = sectoresVisibles.size > 0 || distritosSinSectorVisibles.size > 0;

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
      [...sectoresVisibles],
      [...distritosSinSectorVisibles],
    ],
    enabled: hayAlgoVisible,
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
      // El ojito de cada fila de UBICACIÓN (LocationTree.tsx) YA cascadeó al
      // togglear — sectoresVisibles viene resuelto, se manda tal cual. Fallback a
      // distritoId solo para distritos sin sectores propios (no se pueden
      // representar como sectorId); si hay más de uno visible a la vez, el
      // backend solo acepta un distritoId, se toma el primero (limitación ya
      // existente, no es una regresión de este cambio).
      if (sectoresVisibles.size > 0) {
        params.set('sectorId', [...sectoresVisibles].join(','));
      } else if (distritosSinSectorVisibles.size > 0) {
        params.set('distritoId', [...distritosSinSectorVisibles][0]);
      }

      const response = await apiFetch<ApiIncidenciaListResponse>(`/incidencias?${params.toString()}`);
      // El mapa necesita coordenadas reales para agrupar/plotear — descartar las que
      // el catastro no pudo resolver (suministro_codigo sin match en `sig`, ver
      // memoria del backend) en vez de plotearlas en (0,0).
      return response.items.filter((i) => i.lat !== null && i.lon !== null).map(toIncidencia);
    },
  });
}
