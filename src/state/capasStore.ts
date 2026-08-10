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
  'manzanas',
  'red_potable',
  'red_primaria_desague',
  'red_secundaria_desague',
  'buzones',
  'resaltar_sector',
  // conexion_agua, conexion_desague y flujo_desague: OFF por defecto (muy densas /
  // capa especializada que no todos necesitan ver siempre)
]);

export const useCapasStore = create<CapasState>((set) => ({
  capasVisibles: DEFAULT_CAPAS,
  aplicarCapas: (capas) => set({ capasVisibles: capas }),
}));
