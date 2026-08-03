import { create } from 'zustand';

import { getDistritos, getProvincias, getSectores } from '@/api/catalogos';
import type { ApiDistrito, ApiProvincia, ApiSector } from '@/api/types';

// Chiclayo (provinciacod '01', ubigeo distrital '140101') — scope por defecto (Spec:
// sede EPSEL está ahí y es donde vive la mayoría de la data de prueba). Sector 06
// (sig.sectores.sectorid=28) preseleccionado: es el segundo con mas incidencias del
// historico de Chiclayo (1175 tickets), buen punto de entrada al mapa.
const PROVINCIA_DEFAULT = '01';
const DISTRITO_DEFAULT = '140101';
const SECTOR_DEFAULT = '28';

type UbicacionState = {
  provincias: ApiProvincia[];
  distritos: ApiDistrito[];
  sectores: ApiSector[];
  cargando: boolean;
  error: string | null;
  provinciasActivas: Set<string>;
  distritosActivos: Set<string>;
  sectoresActivos: Set<string>;
  cargar: () => Promise<void>;
  toggleProvincia: (provinciaId: string) => void;
  toggleDistrito: (distritoId: string) => void;
  toggleSector: (sectorId: string) => void;
  // Selección única (combo box de distrito, versión móvil — ver UbicacionPicker.tsx)
  // a diferencia de toggleDistrito (multi-select, usado por FiltersSidebar en web).
  seleccionarDistrito: (distritoId: string | null) => void;
};

export const useUbicacionStore = create<UbicacionState>((set, get) => ({
  provincias: [],
  distritos: [],
  sectores: [],
  cargando: false,
  error: null,
  provinciasActivas: new Set([PROVINCIA_DEFAULT]),
  distritosActivos: new Set([DISTRITO_DEFAULT]),
  sectoresActivos: new Set([SECTOR_DEFAULT]),

  cargar: async () => {
    if (get().provincias.length > 0 || get().cargando) return;
    set({ cargando: true, error: null });
    try {
      const [provincias, distritos, sectores] = await Promise.all([
        getProvincias(),
        getDistritos(),
        getSectores(),
      ]);
      set({ provincias, distritos, sectores, cargando: false });
    } catch {
      set({ cargando: false, error: 'No se pudieron cargar las ubicaciones' });
    }
  },

  // Colapsar una provincia limpia también sus distritos (y los sectores de esos
  // distritos): no tiene sentido dejar selección "invisible" dentro de un grupo cerrado.
  toggleProvincia: (provinciaId) =>
    set((state) => {
      const provinciasActivas = new Set(state.provinciasActivas);
      let distritosActivos = state.distritosActivos;
      let sectoresActivos = state.sectoresActivos;

      if (provinciasActivas.has(provinciaId)) {
        provinciasActivas.delete(provinciaId);
        const idsDistritosDeLaProvincia = new Set(
          state.distritos.filter((d) => d.provinciaId === provinciaId).map((d) => d.id)
        );
        distritosActivos = new Set(
          [...state.distritosActivos].filter((id) => !idsDistritosDeLaProvincia.has(id))
        );
        const idsSectoresDeLaProvincia = new Set(
          state.sectores.filter((s) => idsDistritosDeLaProvincia.has(s.distritoId)).map((s) => s.id)
        );
        sectoresActivos = new Set(
          [...state.sectoresActivos].filter((id) => !idsSectoresDeLaProvincia.has(id))
        );
      } else {
        provinciasActivas.add(provinciaId);
      }

      return { provinciasActivas, distritosActivos, sectoresActivos };
    }),

  // Mismo criterio un nivel abajo: colapsar un distrito limpia sus sectores.
  toggleDistrito: (distritoId) =>
    set((state) => {
      const distritosActivos = new Set(state.distritosActivos);
      let sectoresActivos = state.sectoresActivos;

      if (distritosActivos.has(distritoId)) {
        distritosActivos.delete(distritoId);
        const idsSectoresDelDistrito = new Set(
          state.sectores.filter((s) => s.distritoId === distritoId).map((s) => s.id)
        );
        sectoresActivos = new Set(
          [...state.sectoresActivos].filter((id) => !idsSectoresDelDistrito.has(id))
        );
      } else {
        distritosActivos.add(distritoId);
      }

      return { distritosActivos, sectoresActivos };
    }),

  toggleSector: (sectorId) =>
    set((state) => {
      const next = new Set(state.sectoresActivos);
      if (next.has(sectorId)) {
        next.delete(sectorId);
      } else {
        next.add(sectorId);
      }
      return { sectoresActivos: next };
    }),

  // Reemplaza (no acumula) el distrito activo y limpia los sectores del distrito
  // anterior — mismo criterio de "colapsar limpia hijos" que toggleDistrito, pero
  // como reemplazo en vez de acumulación (combo box: un solo valor a la vez).
  seleccionarDistrito: (distritoId) =>
    set({
      distritosActivos: new Set(distritoId ? [distritoId] : []),
      sectoresActivos: new Set(),
    }),
}));
