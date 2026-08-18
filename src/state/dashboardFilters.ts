import { create } from 'zustand';

import type { Grupo, Periodo } from '@/api/dashboardGeo';

// Referencia de "período actual" — coincide con la fecha ancla de la MV.
// Se actualiza cuando se agregue data más reciente. Usado para saber si el
// período seleccionado es el "actual" (para KPIs como Sin resolver que solo
// tienen sentido en tiempo presente).
export const PERIODO_ACTUAL = { anio: 2026, mes: 8 } as const;

// Años disponibles en la data. Se ajusta si se agregan más años.
export const ANIOS_DISPONIBLES = [2025, 2026] as const;

type Estado = {
  periodo: Periodo;
  grupo: Grupo;
  anio: number;
  mes: number;      // 1..12, usado solo cuando periodo=mensual
  sectorid: number | null;
  sectorNombre: string | null;

  reincMeses: number;
  reincMinimo: number;
  reincRoboMeses: number;
  reincRoboMinimo: number;

  setPeriodo: (p: Periodo) => void;
  setGrupo: (g: Grupo) => void;
  setAnio: (a: number) => void;
  setMes: (m: number) => void;
  seleccionarSector: (sectorid: number, nombre: string) => void;
  limpiarSector: () => void;
  setReincParams: (meses: number, minimo: number) => void;
  setReincRoboParams: (meses: number, minimo: number) => void;
};

export const useDashboardFilters = create<Estado>((set) => ({
  periodo: 'anual',
  grupo: 'todos',
  anio: PERIODO_ACTUAL.anio,
  mes: PERIODO_ACTUAL.mes,
  sectorid: null,
  sectorNombre: null,
  reincMeses: 12,
  reincMinimo: 3,
  reincRoboMeses: 6,
  reincRoboMinimo: 2,

  setPeriodo: (periodo) => set({ periodo }),
  setGrupo: (grupo) => set({ grupo }),
  setAnio: (anio) => set({ anio }),
  setMes: (mes) => set({ mes }),
  seleccionarSector: (sectorid, sectorNombre) => set({ sectorid, sectorNombre }),
  limpiarSector: () => set({ sectorid: null, sectorNombre: null }),
  setReincParams: (reincMeses, reincMinimo) => set({ reincMeses, reincMinimo }),
  setReincRoboParams: (reincRoboMeses, reincRoboMinimo) =>
    set({ reincRoboMeses, reincRoboMinimo }),
}));
