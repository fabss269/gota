import { create } from 'zustand';

type FlyTarget = { lat: number; lon: number; zoom: number };
type PinPosition = { lat: number; lon: number };

type MapSearchState = {
  flyTarget: FlyTarget | null;
  pin: PinPosition | null;
  // true entre que el usuario dispara `searchAndFly` y que MapView notifica
  // `moveend`. Lo lee el LocationSearchBar para mantener el loader "Buscando por
  // ..." visible hasta que la cámara aterrice. Solo se activa por acciones del
  // buscador — `flyTo` normal (click en incidencia, "Ver en el mapa", etc.) no lo
  // enciende.
  isFlying: boolean;
  // Mueve la cámara sin plantar pin ni encender el loader — para navegación
  // interna: click en incidencia, botón "Ver en el mapa", etc.
  flyTo: (target: { lat: number; lon: number; zoom?: number }) => void;
  // Igual que flyTo pero además planta un pin rojo en el destino y enciende el
  // loader del buscador. Solo debe llamarlo `LocationSearchBar`.
  searchAndFly: (target: { lat: number; lon: number; zoom?: number }) => void;
  clearPin: () => void;
  setFlying: (flying: boolean) => void;
};

// Store mínimo para desacoplar el buscador (vive como overlay sobre el mapa, en
// mapa/index.web.tsx) del componente que realmente tiene la instancia de MapLibre
// (MapView.web.tsx) — mismo patrón que ubicacionStore/capasStore.
export const useMapSearchStore = create<MapSearchState>((set) => ({
  flyTarget: null,
  pin: null,
  isFlying: false,
  flyTo: ({ lat, lon, zoom = 18 }) => set({ flyTarget: { lat, lon, zoom } }),
  searchAndFly: ({ lat, lon, zoom = 18 }) =>
    set({ flyTarget: { lat, lon, zoom }, pin: { lat, lon }, isFlying: true }),
  clearPin: () => set({ pin: null }),
  setFlying: (flying) => set({ isFlying: flying }),
}));
