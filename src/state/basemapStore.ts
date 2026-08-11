import { create } from 'zustand';

export type BasemapMode = 'osm' | 'satellite';

type BasemapState = {
  mode: BasemapMode;
  toggle: () => void;
  setMode: (mode: BasemapMode) => void;
};

// Basemap activo del mapa web. `osm` = OpenStreetMap raster (default),
// `satellite` = Esri World Imagery. MapView.web.tsx escucha `mode` y aplica
// visibility a las capas correspondientes del style JSON — mismo patrón que
// capasStore para el resto de capas SIG.
export const useBasemapStore = create<BasemapState>((set) => ({
  mode: 'osm',
  toggle: () => set((s) => ({ mode: s.mode === 'osm' ? 'satellite' : 'osm' })),
  setMode: (mode) => set({ mode }),
}));
