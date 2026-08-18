import { create } from 'zustand';

import { Colors, ColorsDark } from '@/constants/theme';

export type ThemeMode = 'light' | 'dark';

type ThemeState = {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
};

/**
 * Modo oscuro (alcance: pantallas de Mapa — mapa, sidebar/panel de capas, detalle
 * de incidencia, bottom sheet, pedido de Edgar 2026-08-05). Toggle manual, no
 * persistido entre sesiones (no hay AsyncStorage en el proyecto todavía) — arranca
 * siempre en 'light'.
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  toggle: () => set({ mode: get().mode === 'light' ? 'dark' : 'light' }),
  setMode: (mode) => set({ mode }),
}));

/** Objeto de colores activo según el modo actual — usar dentro de componentes (no
 * en el scope de módulo: StyleSheet.create de RN se evalúa una sola vez, así que
 * los colores deben leerse dentro de la función del componente para reaccionar al
 * toggle). */
export function useThemeColors() {
  return useThemeStore((s) => (s.mode === 'dark' ? ColorsDark : Colors));
}
