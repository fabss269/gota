import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { INCIDENCIAS_ALL } from '@/mocks/incidentsMock';
import { TODOS_SECTOR, useIncidentsListFiltersStore } from '@/state/incidentsListFiltersStore';

const PAGE_SIZE = 10;

/**
 * Lista de incidencias (Spec 05). A diferencia de `useIncidentsToday` (Spec 03), no
 * filtra por fecha por defecto (RF-05.7): usa `INCIDENCIAS_ALL` (hoy + historial).
 * Contra un backend real: `GET /incidencias?q=&prioridad=&estado=&page=` (docs/API.md
 * § 3) — el `queryFn` es el único punto a cambiar.
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
      await new Promise((resolve) => setTimeout(resolve, 300));

      const query = q.trim().toLowerCase();
      const filtered = INCIDENCIAS_ALL.filter((i) => {
        if (query && !i.tipo.toLowerCase().includes(query) && !i.direccion.toLowerCase().includes(query)) {
          return false;
        }
        if (!prioridades.includes(i.prioridad)) return false;
        if (!estados.includes(i.estado)) return false;
        if (!categorias.includes(i.categoria)) return false;
        if (sectorId !== TODOS_SECTOR && !i.sector.includes(sectorId)) return false;
        // RF-05.4: "sin asignar" ~ estado CREADO (mismo criterio que el punto gris).
        if (asignado === 'sin_asignar' && i.estado !== 'CREADO') return false;
        return true;
      });

      const total = filtered.length;
      const start = (page - 1) * PAGE_SIZE;
      const items = filtered.slice(start, start + PAGE_SIZE);

      return { items, page, pageSize: PAGE_SIZE, total };
    },
    placeholderData: keepPreviousData,
  });
}
