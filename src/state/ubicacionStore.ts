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
  // Selección única en cascada (rediseño 2026-08-11: antes eran Sets multi-select
  // — ver FiltersSidebar.tsx/UbicacionPicker.tsx, ahora son 3 dropdowns
  // Provincia→Distrito→Sector de un solo valor cada uno, como un <select> encadenado).
  provinciaActiva: string | null;
  distritoActivo: string | null;
  sectorActivo: string | null;
  // Preview del "ojito" en el dropdown de Sector: pinta el contorno del sector en
  // el mapa (ver applySectorHighlight/buildEffectiveStyle) sin tocar sectorActivo —
  // no cambia el filtro de datos ni dispara fetch (useIncidentsToday no lo lee).
  sectorPreview: string | null;
  cargar: () => Promise<void>;
  seleccionarProvincia: (provinciaId: string | null) => void;
  seleccionarDistrito: (distritoId: string | null) => void;
  seleccionarSector: (sectorId: string | null) => void;
  previsualizarSector: (sectorId: string | null) => void;
};

export const useUbicacionStore = create<UbicacionState>((set, get) => ({
  provincias: [],
  distritos: [],
  sectores: [],
  cargando: false,
  error: null,
  provinciaActiva: PROVINCIA_DEFAULT,
  distritoActivo: DISTRITO_DEFAULT,
  sectorActivo: SECTOR_DEFAULT,
  sectorPreview: null,

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

  // Cambiar de provincia invalida distrito/sector elegidos antes (igual que un
  // <select> encadenado: la opción vieja puede ya ni pertenecer a la provincia nueva).
  seleccionarProvincia: (provinciaId) =>
    set({ provinciaActiva: provinciaId, distritoActivo: null, sectorActivo: null }),

  // Mismo criterio un nivel abajo: cambiar de distrito invalida el sector elegido.
  seleccionarDistrito: (distritoId) => set({ distritoActivo: distritoId, sectorActivo: null }),

  seleccionarSector: (sectorId) => set({ sectorActivo: sectorId }),

  // Solo el "ojito" la usa — nunca toca provinciaActiva/distritoActivo/sectorActivo.
  previsualizarSector: (sectorId) => set({ sectorPreview: sectorId }),
}));
