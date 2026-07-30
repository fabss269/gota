import type { Categoria, EstadoIncidencia, Prioridad } from '@/mocks/incidentsMock';

/** Shapes tal como los devuelve gota-backend (ver API.md y los schemas.py de cada módulo). */

export type ApiIncidencia = {
  id: string;
  tipo: string;
  categoria: Categoria;
  direccion: string | null;
  sector: string | null;
  prioridad: Prioridad | null;
  estado: EstadoIncidencia;
  antiguedadDias: number;
  lat: number | null;
  lon: number | null;
  fechaCreacion: string;
};

export type ApiIncidenciaListResponse = {
  items: ApiIncidencia[];
  page: number;
  pageSize: number;
  total: number;
};

export type ApiTecnicoAsignado = { id: string; nombre: string };
export type ApiReclamoResumen = { fechaRegistro: string; medioRecepcion: string; descripcion: string | null };
export type ApiCatastro = {
  redAsociada: string | null;
  diametroMm: number | null;
  material: string | null;
  buzonCercano: string | null;
  sector: string | null;
};
export type ApiPredio = { noReincidente: boolean; quejasUltimos6Meses: number };
export type ApiFoco = { descripcion: string; incidenciasRelacionadasIds: string[] };

export type ApiIncidenciaDetalle = {
  id: string;
  tipo: string;
  categoria: Categoria;
  direccion: string | null;
  prioridad: Prioridad | null;
  estado: EstadoIncidencia;
  antiguedadDias: number;
  tecnicoAsignado: ApiTecnicoAsignado | null;
  reclamo: ApiReclamoResumen | null;
  catastro: ApiCatastro | null;
  quejasAgrupadas: number;
  predio: ApiPredio;
  foco: ApiFoco | null;
};

export type ApiTrazabilidadPaso = {
  estado: EstadoIncidencia;
  fecha: string;
  grupo: string | null;
  asignadoA: string | null;
  nota: string | null;
};

export type ApiPredioReclamo = { id: string; tipo: string; fecha: string };

export type ApiUsuario = { id: string; nombre: string; rol: string; sector: string | null };

export type ApiBbox = { minLon: number; minLat: number; maxLon: number; maxLat: number };
export type ApiProvincia = { id: string; nombre: string; bbox: ApiBbox };
export type ApiDistrito = { id: string; nombre: string; provinciaId: string; bbox: ApiBbox };
export type ApiSector = { id: string; nombre: string; distritoId: string; bbox: ApiBbox };
export type ApiSuministro = { lat: number; lon: number; sectorId: number | null; sectorNombre: string | null };

export type ApiDashboardResumen = {
  kpis: {
    incidenciasAbiertasHoy: number;
    incidenciasCriticas: number;
    tiempoPromedioAtencionHoras: number;
    cuadrillasActivas: number;
  };
  porCategoria: Record<string, number>;
  serieTickets: { mes: string; agua: number; desague: number }[];
  topTiposAtencion: { tipo: string; cantidad: number }[];
  prioridadPorSector: { sectorId: string; nombre: string; antiguedadPromedioDias: number }[];
};
