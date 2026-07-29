import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import { toIncidencia } from '@/api/mappers';
import type { ApiIncidenciaListResponse } from '@/api/types';
import { useFiltersStore } from '@/state/filtersStore';

/**
 * Trae las incidencias de hoy (Spec 03, RF-03.4) aplicando los filtros del Bottom
 * Sheet (Spec 04). `GET /incidencias?fecha=hoy&categoria=...&prioridad=...` (API.md § 3).
 */
export function useIncidentsToday() {
  const categorias = useFiltersStore((s) => s.categorias);
  const prioridades = useFiltersStore((s) => s.prioridades);
  const tipoAtencion = useFiltersStore((s) => s.tipoAtencion);
  const estado = useFiltersStore((s) => s.estado);

  return useQuery({
    queryKey: ['incidencias-hoy', categorias, prioridades, tipoAtencion, estado],
    queryFn: async () => {
      const params = new URLSearchParams({
        fecha: 'hoy',
        categoria: categorias.join(','),
        prioridad: prioridades.join(','),
        pageSize: '100',
      });
      if (tipoAtencion) params.set('tipoAtencionId', tipoAtencion);
      if (estado) params.set('estado', estado);

      const response = await apiFetch<ApiIncidenciaListResponse>(`/incidencias?${params.toString()}`);
      // El mapa necesita coordenadas reales para agrupar/plotear — descartar las que
      // el catastro no pudo resolver (suministro_codigo sin match en `sig`, ver
      // memoria del backend) en vez de plotearlas en (0,0).
      return response.items.filter((i) => i.lat !== null && i.lon !== null).map(toIncidencia);
    },
  });
}
