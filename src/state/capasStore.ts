import { create } from 'zustand';

export type CapaKey =
  | 'red_potable'
  | 'valvulas'
  | 'grifos_contra_incendio'
  | 'red_primaria_desague'
  | 'red_secundaria_desague'
  | 'buzones';

type CapasState = {
  capasVisibles: Set<CapaKey>;
  isApplying: boolean;
  aplicarCapas: (capas: Set<CapaKey>) => void;
  setApplying: (value: boolean) => void;
};

const DEFAULT_CAPAS: Set<CapaKey> = new Set(['red_potable', 'valvulas']);

/**
 * Estado de la pestaña "Capas" del Bottom Sheet (Spec 04, RF-04.7 a RF-04.10).
 * `capasVisibles` es lo último aplicado ("Ver en el mapa"), no el borrador de checkboxes
 * — eso vive como estado local en CapasTab hasta que se aplica.
 */
export const useCapasStore = create<CapasState>((set) => ({
  capasVisibles: DEFAULT_CAPAS,
  isApplying: false,
  aplicarCapas: (capas) => set({ capasVisibles: capas }),
  setApplying: (isApplying) => set({ isApplying }),
}));
