import { create } from 'zustand';

export type CapaKey =
  | 'manzanas'
  | 'lotes'
  | 'red_potable'
  | 'conexion_agua'
  | 'caja_agua'
  | 'accesorios'
  | 'red_primaria_desague'
  | 'red_secundaria_desague'
  | 'conexion_desague'
  | 'caja_desague'
  | 'buzones'
  | 'resaltar_sector'
  | 'flujo_desague'
  | 'reservorios';

type CapasState = {
  capasVisibles: Set<CapaKey>;
  aplicarCapas: (capas: Set<CapaKey>) => void;
};

const DEFAULT_CAPAS: Set<CapaKey> = new Set([
  'lotes',
  'red_potable',
  'red_primaria_desague',
  'red_secundaria_desague',
  'resaltar_sector',
  // Resto OFF por defecto (buzones, cajas, accesorios, conexiones, flujo, reservorios,
  // manzanas) — el usuario los activa desde el panel "Capas" según necesite. Las
  // conexiones además NO tienen tabla de detalles todavía (ver NO_HOVEREABLES en
  // mapLayers.ts).
]);

export const useCapasStore = create<CapasState>((set) => ({
  capasVisibles: DEFAULT_CAPAS,
  aplicarCapas: (capas) => set({ capasVisibles: capas }),
}));
