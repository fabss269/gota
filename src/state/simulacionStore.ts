import { create } from 'zustand';

import type { ApiAfectado, ApiElementoRed, TipoFalla } from '@/api/types';

type ElementoTipo = 'tramo' | 'tuberia' | 'buzon' | 'accesorio' | 'cajadesague';
type TipoFallaBuzon = Extract<TipoFalla, 'colapso_buzon' | 'tapa_faltante'>;

type SimulacionState = {
  activo: boolean;
  /** Modo vista: pantalla bloqueada (solo el botón ← interactúa) mostrando la
   * red completa afectada en rojo, tras un click exitoso en modo simulación. */
  modoVista: boolean;
  tipoFallaBuzon: TipoFallaBuzon;
  elementoSeleccionado: { tipo: ElementoTipo; id: number } | null;
  resultado: ApiAfectado[] | null;
  redAfectada: ApiElementoRed[] | null;
  cargando: boolean;
  toggleActivo: () => void;
  setTipoFallaBuzon: (tipo: TipoFallaBuzon) => void;
  setCargando: (cargando: boolean) => void;
  setResultado: (
    elemento: { tipo: ElementoTipo; id: number },
    resultado: ApiAfectado[],
    redAfectada: ApiElementoRed[]
  ) => void;
  salirModoVista: () => void;
  limpiar: () => void;
};

/** Modo simulación del mapa (grafo hidráulico): click en cualquier elemento de red
 * activo en Filtros/Capas -> POST /grafo/simulacion -> entra a modo vista (bloqueado,
 * solo ← sale) pintando en rojo toda la red afectada devuelta por el backend. Modo
 * nuevo dentro del mismo mapa (no una pantalla aparte), ver MapView.web.tsx +
 * SimulacionControl.web.tsx + mapa/index.web.tsx (bloqueo a nivel de pantalla). */
export const useSimulacionStore = create<SimulacionState>((set) => ({
  activo: false,
  modoVista: false,
  tipoFallaBuzon: 'colapso_buzon',
  elementoSeleccionado: null,
  resultado: null,
  redAfectada: null,
  cargando: false,
  toggleActivo: () =>
    set((state) => ({
      activo: !state.activo,
      modoVista: state.activo ? false : state.modoVista,
      resultado: state.activo ? state.resultado : null,
      redAfectada: state.activo ? state.redAfectada : null,
      elementoSeleccionado: state.activo ? state.elementoSeleccionado : null,
    })),
  setTipoFallaBuzon: (tipoFallaBuzon) => set({ tipoFallaBuzon }),
  setCargando: (cargando) => set({ cargando }),
  setResultado: (elementoSeleccionado, resultado, redAfectada) =>
    set({ elementoSeleccionado, resultado, redAfectada, cargando: false, modoVista: true }),
  salirModoVista: () => set({ modoVista: false, resultado: null, redAfectada: null, elementoSeleccionado: null }),
  limpiar: () => set({ resultado: null, redAfectada: null, elementoSeleccionado: null, modoVista: false }),
}));
