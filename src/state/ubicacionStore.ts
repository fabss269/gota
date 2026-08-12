import { create } from 'zustand';

import { getDistritos, getProvincias, getSectores } from '@/api/catalogos';
import type { ApiDistrito, ApiProvincia, ApiSector } from '@/api/types';
import {
  distritosSinSectorDeProvincia,
  estadoVisibilidad,
  sectoresDeDistrito,
  sectoresDeProvincia,
} from '@/components/map/mapLayers';

// Chiclayo (provinciacod '01', ubigeo distrital '140101') — scope por defecto (Spec:
// sede EPSEL está ahí y es donde vive la mayoría de la data de prueba). Sector 06
// (sig.sectores.sectorid=28) preseleccionado: es el segundo con mas incidencias del
// historico de Chiclayo (1175 tickets), buen punto de entrada al mapa.
export const PROVINCIA_DEFAULT = '01';
export const DISTRITO_DEFAULT = '140101';
const SECTOR_DEFAULT = '28';

type UbicacionState = {
  provincias: ApiProvincia[];
  distritos: ApiDistrito[];
  sectores: ApiSector[];
  cargando: boolean;
  error: string | null;
  // Árbol tipo Figma (rediseño 2026-08-12): el "ojito" de cada fila ES el filtro
  // real — prende/apaga sectores individuales, o cascadea sobre todos los
  // descendientes de un Distrito/Provincia. `sectoresVisibles` es la fuente de
  // verdad que pinta el mapa (applySectorHighlight/applyCatastroSectorFilter) Y
  // arma el filtro de incidencias (useIncidentsToday) — ya no hay "preview" por
  // separado del filtro activo.
  sectoresVisibles: Set<string>;
  // La mayoría de los distritos no tiene ningún sector propio (catastro
  // comercial parcial) — esos no se pueden representar en sectoresVisibles, así
  // que llevan su propio set. Solo importa para el ojo de ese distrito y como
  // fallback de useIncidentsToday (distritoId) cuando no hay ningún sector visible.
  distritosSinSectorVisibles: Set<string>;
  cargar: () => Promise<void>;
  toggleSectorVisible: (sectorId: string) => void;
  toggleDistritoVisible: (distritoId: string) => void;
  toggleProvinciaVisible: (provinciaId: string) => void;
  // Selección única para el combo box de UbicacionPicker.tsx (mobile, no cambia
  // de UI en este rediseño) — limpia todo y cascada-prende solo el nivel
  // elegido; id null = "Todos" (limpia sin prender nada).
  seleccionarSoloDistrito: (distritoId: string | null) => void;
  seleccionarSoloSector: (sectorId: string | null) => void;
};

export const useUbicacionStore = create<UbicacionState>((set, get) => ({
  provincias: [],
  distritos: [],
  sectores: [],
  cargando: false,
  error: null,
  sectoresVisibles: new Set([SECTOR_DEFAULT]),
  distritosSinSectorVisibles: new Set(),

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

  toggleSectorVisible: (sectorId) =>
    set((state) => {
      const next = new Set(state.sectoresVisibles);
      if (next.has(sectorId)) next.delete(sectorId);
      else next.add(sectorId);
      return { sectoresVisibles: next };
    }),

  // Cascada estilo Figma: togglear el ojo de un distrito prende/apaga TODOS sus
  // sectores a la vez — a diferencia del modelo viejo (multi-select por
  // checkbox), acá activar el padre SIEMPRE fuerza a todos los hijos al mismo
  // estado, no solo limpia al desactivar. Sin sectores propios, togglea directo
  // sobre distritosSinSectorVisibles (no hay nada que cascadear).
  toggleDistritoVisible: (distritoId) =>
    set((state) => {
      const idsSectores = sectoresDeDistrito(state.sectores, distritoId);
      if (idsSectores.length === 0) {
        const next = new Set(state.distritosSinSectorVisibles);
        if (next.has(distritoId)) next.delete(distritoId);
        else next.add(distritoId);
        return { distritosSinSectorVisibles: next };
      }
      const prender = estadoVisibilidad(idsSectores, state.sectoresVisibles) !== 'on';
      const next = new Set(state.sectoresVisibles);
      for (const id of idsSectores) {
        if (prender) next.add(id);
        else next.delete(id);
      }
      return { sectoresVisibles: next };
    }),

  // Mismo criterio un nivel arriba: cascada sobre TODOS los sectores de todos
  // sus distritos, más sus distritos-sin-sector propio.
  toggleProvinciaVisible: (provinciaId) =>
    set((state) => {
      const idsSectores = sectoresDeProvincia(state.sectores, state.distritos, provinciaId);
      const idsDistritosSinSector = distritosSinSectorDeProvincia(state.distritos, state.sectores, provinciaId);
      const visiblesCombinado = new Set([...state.sectoresVisibles, ...state.distritosSinSectorVisibles]);
      const prender = estadoVisibilidad([...idsSectores, ...idsDistritosSinSector], visiblesCombinado) !== 'on';

      const sectoresVisibles = new Set(state.sectoresVisibles);
      for (const id of idsSectores) {
        if (prender) sectoresVisibles.add(id);
        else sectoresVisibles.delete(id);
      }
      const distritosSinSectorVisibles = new Set(state.distritosSinSectorVisibles);
      for (const id of idsDistritosSinSector) {
        if (prender) distritosSinSectorVisibles.add(id);
        else distritosSinSectorVisibles.delete(id);
      }
      return { sectoresVisibles, distritosSinSectorVisibles };
    }),

  seleccionarSoloDistrito: (distritoId) =>
    set((state) => {
      if (!distritoId) return { sectoresVisibles: new Set(), distritosSinSectorVisibles: new Set() };
      const idsSectores = sectoresDeDistrito(state.sectores, distritoId);
      if (idsSectores.length === 0) {
        return { sectoresVisibles: new Set(), distritosSinSectorVisibles: new Set([distritoId]) };
      }
      return { sectoresVisibles: new Set(idsSectores), distritosSinSectorVisibles: new Set() };
    }),

  seleccionarSoloSector: (sectorId) =>
    set({
      sectoresVisibles: new Set(sectorId ? [sectorId] : []),
      distritosSinSectorVisibles: new Set(),
    }),
}));
