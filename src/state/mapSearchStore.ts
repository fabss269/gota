import { create } from 'zustand';

type FlyTarget = { lat: number; lon: number; zoom: number };

type MapSearchState = {
  flyTarget: FlyTarget | null;
  flyTo: (target: { lat: number; lon: number; zoom?: number }) => void;
};

// Store mínimo para desacoplar el buscador (vive como overlay sobre el mapa, en
// mapa/index.web.tsx) del componente que realmente tiene la instancia de MapLibre
// (MapView.web.tsx) — mismo patrón que ubicacionStore/capasStore.
export const useMapSearchStore = create<MapSearchState>((set) => ({
  flyTarget: null,
  flyTo: ({ lat, lon, zoom = 18 }) => set({ flyTarget: { lat, lon, zoom } }),
}));
