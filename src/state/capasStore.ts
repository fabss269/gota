import { create } from 'zustand';

export type CapaKey =
  | 'manzanas'
  | 'lotes'
  | 'red_potable'
  | 'conexion_agua'
  | 'caja_agua'
  | 'red_primaria_desague'
  | 'red_secundaria_desague'
  | 'conexion_desague'
  | 'caja_desague'
  | 'buzones'
  | 'resaltar_sector'
  | 'flujo_desague';

type CapasState = {
  capasVisibles: Set<CapaKey>;
  isApplying: boolean;
  aplicarCapas: (capas: Set<CapaKey>) => void;
  setApplying: (value: boolean) => void;
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
  isApplying: false,
  aplicarCapas: (capas) => set({ capasVisibles: capas }),
  setApplying: (isApplying) => set({ isApplying }),
}));
