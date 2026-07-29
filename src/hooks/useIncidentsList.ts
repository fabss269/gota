import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import { toIncidencia } from '@/api/mappers';
import type { ApiIncidenciaListResponse } from '@/api/types';
import { TODOS_SECTOR, useIncidentsListFiltersStore } from '@/state/incidentsListFiltersStore';

const PAGE_SIZE = 10;

/**
 * Lista de incidencias (Spec 05). A diferencia de `useIncidentsToday` (Spec 03), no
 * filtra por fecha por defecto (RF-05.7). `GET /incidencias` (docs/API.md § 3).
 */
export function useIncidentsList() {
  const q = useIncidentsListFiltersStore((s) => s.q);
  const prioridades = useIncidentsListFiltersStore((s) => s.prioridades);
  const estados = useIncidentsListFiltersStore((s) => s.estados);
  const categorias = useIncidentsListFiltersStore((s) => s.categorias);
  const sectorId = useIncidentsListFiltersStore((s) => s.sectorId);
  const asignado = useIncidentsListFiltersStore((s) => s.asignado);
  const page = useIncidentsListFiltersStore((s) => s.page);

  return useQuery({
    queryKey: ['incidencias-lista', q, prioridades, estados, categorias, sectorId, asignado, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        prioridad: prioridades.join(','),
        estado: estados.join(','),
        categoria: categorias.join(','),
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (q.trim()) params.set('q', q.trim());
      if (sectorId !== TODOS_SECTOR) params.set('sectorId', sectorId);

      const response = await apiFetch<ApiIncidenciaListResponse>(`/incidencias?${params.toString()}`);
      let items = response.items.map(toIncidencia);
      // El backend no tiene filtro `asignado` — se mantiene client-side sobre la
      // página ya traída, mismo criterio que el mock (RF-05.4: "sin asignar" ~ CREADO).
      if (asignado === 'sin_asignar') items = items.filter((i) => i.estado === 'CREADO');

      return { items, page: response.page, pageSize: response.pageSize, total: response.total };
    },
    placeholderData: keepPreviousData,
  });
}
