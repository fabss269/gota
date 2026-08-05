import { create } from 'zustand';

import type { Categoria, EstadoIncidencia, Prioridad } from '@/mocks/incidentsMock';

export type MapMode = 'normal' | 'calor' | 'foco';

// Presets simples en vez de un date-picker completo (no hay ninguno en el proyecto
// todavía) — cubre los casos de uso reales de una vista operativa sin la complejidad
// de un calendario. `useIncidentsToday` traduce esto a fecha/fechaDesde/fechaHasta.
export type RangoFechas = 'hoy' | '7d' | '30d' | 'mes' | 'todo';

type FiltersState = {
  categorias: Categoria[];
  prioridades: Prioridad[];
  // `null` = "Todos" (sin filtrar por esta dimensión) — selector de un solo valor,
  // a diferencia de Categoría/Prioridad que son multi-select (ver RF-04.3).
  tipoAtencion: string | null;
  estado: EstadoIncidencia | null;
  rangoFechas: RangoFechas;
  mapMode: MapMode;
  toggleCategoria: (categoria: Categoria) => void;
  togglePrioridad: (prioridad: Prioridad) => void;
  setPrioridades: (prioridades: Prioridad[]) => void;
  setTipoAtencion: (tipoAtencion: string | null) => void;
  setEstado: (estado: EstadoIncidencia | null) => void;
  setRangoFechas: (rango: RangoFechas) => void;
  setMapMode: (mode: MapMode) => void;
  reset: () => void;
};

const DEFAULTS: Pick<
  FiltersState,
  'categorias' | 'prioridades' | 'tipoAtencion' | 'estado' | 'rangoFechas' | 'mapMode'
> = {
  categorias: ['agua', 'desague'],
  prioridades: ['a_tiempo', 'alerta', 'critica'],
  tipoAtencion: null,
  estado: null,
  // Default 'hoy' -> '7d' (pedido de Edgar 2026-08-05): el mapa arranca mostrando
  // la última semana, no solo el día actual — 'hoy' sigue disponible como preset
  // en el selector, solo cambió cuál es el punto de partida.
  rangoFechas: '7d',
  mapMode: 'normal',
};

/**
 * Estado de Filtros/Capas del Bottom Sheet (Spec 04). Vive en memoria mientras la app
 * está abierta (no se persiste entre sesiones, ver Spec 04 § "Reglas de negocio").
 */
export const useFiltersStore = create<FiltersState>((set) => ({
  ...DEFAULTS,
  toggleCategoria: (categoria) =>
    set((state) => {
      const has = state.categorias.includes(categoria);
      const next = has ? state.categorias.filter((c) => c !== categoria) : [...state.categorias, categoria];
      // RF-04.2: siempre debe quedar al menos una categoría activa.
      return next.length > 0 ? { categorias: next } : state;
    }),
  togglePrioridad: (prioridad) =>
    set((state) => {
      const has = state.prioridades.includes(prioridad);
      const next = has ? state.prioridades.filter((p) => p !== prioridad) : [...state.prioridades, prioridad];
      return next.length > 0 ? { prioridades: next } : state;
    }),
  setPrioridades: (prioridades) => set({ prioridades }),
  setTipoAtencion: (tipoAtencion) => set({ tipoAtencion }),
  setEstado: (estado) => set({ estado }),
  setRangoFechas: (rangoFechas) => set({ rangoFechas }),
  setMapMode: (mapMode) => set({ mapMode }),
  reset: () => set({ ...DEFAULTS }),
}));
