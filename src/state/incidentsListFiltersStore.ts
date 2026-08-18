import { create } from 'zustand';

import type { Categoria, EstadoIncidencia, Prioridad } from '@/mocks/incidentsMock';

export type Asignado = 'todos' | 'sin_asignar';

type IncidentsListFiltersState = {
  q: string;
  prioridades: Prioridad[];
  estados: EstadoIncidencia[];
  categorias: Categoria[];
  sectorId: string;
  asignado: Asignado;
  page: number;
  setQ: (q: string) => void;
  togglePrioridad: (prioridad: Prioridad) => void;
  toggleEstado: (estado: EstadoIncidencia) => void;
  toggleCategoria: (categoria: Categoria) => void;
  setSector: (sectorId: string) => void;
  setAsignado: (asignado: Asignado) => void;
  setPage: (page: number) => void;
  reset: () => void;
};

export const TODOS_SECTOR = 'todos';

const DEFAULTS: Pick<
  IncidentsListFiltersState,
  'q' | 'prioridades' | 'estados' | 'categorias' | 'sectorId' | 'asignado' | 'page'
> = {
  q: '',
  prioridades: ['a_tiempo', 'alerta', 'critica'],
  estados: ['CREADO', 'PENDIENTE', 'EN_PROGRESO', 'ATENDIDO'],
  categorias: ['agua', 'desague'],
  sectorId: TODOS_SECTOR,
  asignado: 'todos',
  page: 1,
};

/**
 * Filtros de la Lista de Incidencias (Spec 05, RF-05.3), separado del store del Mapa
 * (`filtersStore.ts`) porque el overlay "Más filtros" de esta pantalla tiene secciones
 * propias (Estado, Red asociada, Asignado, Sector) que el Bottom Sheet del Mapa no
 * tiene (Spec 04).
 */
export const useIncidentsListFiltersStore = create<IncidentsListFiltersState>((set) => ({
  ...DEFAULTS,
  setQ: (q) => set({ q, page: 1 }),
  togglePrioridad: (prioridad) =>
    set((state) => {
      const has = state.prioridades.includes(prioridad);
      const next = has ? state.prioridades.filter((p) => p !== prioridad) : [...state.prioridades, prioridad];
      return { prioridades: next, page: 1 };
    }),
  toggleEstado: (estado) =>
    set((state) => {
      const has = state.estados.includes(estado);
      const next = has ? state.estados.filter((e) => e !== estado) : [...state.estados, estado];
      return { estados: next, page: 1 };
    }),
  toggleCategoria: (categoria) =>
    set((state) => {
      const has = state.categorias.includes(categoria);
      const next = has ? state.categorias.filter((c) => c !== categoria) : [...state.categorias, categoria];
      return { categorias: next, page: 1 };
    }),
  setSector: (sectorId) => set({ sectorId, page: 1 }),
  setAsignado: (asignado) => set({ asignado, page: 1 }),
  setPage: (page) => set({ page }),
  reset: () => set({ ...DEFAULTS }),
}));
