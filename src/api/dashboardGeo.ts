import { apiFetch } from '@/api/client';

// ============ Tipos ============

export type Periodo = 'anual' | 'mensual';
export type Grupo = 'todos' | 'agua' | 'desague';
export type NivelAlerta = 'rojo' | 'amarillo' | 'verde';

export type ReclamoDetalle = { fecha: string; detalle: string | null };

export type IncidenciaPopup = {
  codigo: string;
  suministro: string | null;
  direccion: string | null;
  tipo_atencion: string;
  grupo: 'agua' | 'desague';
  sector: string | null;
  creado_en: string;
  fecha_solucion: string | null;
  dias_hasta_solucion: number | null;
  sin_solucion: boolean;
  reclamos: ReclamoDetalle[];
};

export type KpiPuntoSparkline = { x: string; y: number };
export type Kpi = {
  valor: number;
  delta_pct: number | null;
  delta_abs: number | null;
  sparkline: KpiPuntoSparkline[];
};
export type Kpis = {
  volumen: Kpi;
  tiempo_mediano_dias: Kpi;
  robos: Kpi;
  sin_solucion: Kpi;
};

export type Storytelling = { periodo: string; texto: string };

export type SectorRank = {
  sectorid: number | null;
  sector: string;
  n_incidencias: number;
  n_agua: number;
  n_desague: number;
};

export type HeatmapSector = {
  sectorid: number;
  sector: string;
  n_incidencias: number;
  densidad_por_km2: number;
};

export type TramoRank = {
  tramo_id: number;
  tramo_tipo: string;
  direccion_muestra: string | null;
  sectorid: number | null;
  sector: string | null;
  n_incidencias: number;
};

export type SeriePunto = { x: string; y: number };
export type SerieMensual = {
  actual: SeriePunto[];
  anio_anterior: SeriePunto[];
  prediccion: SeriePunto[];
};
export type SerieTiempoResolucion = { puntos: SeriePunto[] };
export type SerieStackedPunto = { x: string; valores: Record<string, number> };
export type SerieStacked = { tipos: string[]; puntos: SerieStackedPunto[] };

export type Reincidente = {
  suministro: string;
  direccion: string | null;
  sector: string | null;
  n_incidencias: number;
  tipo_dominante: string;
  ultima_fecha: string;
};

export type SinSolucionRow = {
  codigo: string;
  tipo_atencion: string;
  sector: string | null;
  direccion: string | null;
  dias_sin_resolver: number;
};

export type MultiReclamo = {
  codigo: string;
  direccion: string | null;
  sector: string | null;
  n_reclamos: number;
  tipo_atencion: string;
};

export type ParentescoSlice = { parentesco: string; n: number; pct: number };
export type Alerta = { nivel: NivelAlerta; mensaje: string; link: string | null };
export type PrediccionSector = {
  sectorid: number;
  sector: string;
  tendencia: 'creciente' | 'decreciente' | 'estable';
  pred_proximo_mes: number;
  cambio_pct_mensual: number;
};

// ============ Helpers ============

function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

type FiltrosBase = { grupo?: Grupo; sectorid?: number | null };
type FiltrosConPeriodo = FiltrosBase & {
  periodo?: Periodo;
  anio?: number;
  mes?: number;
};

// ============ API ============

export const dashboardGeoApi = {
  popup: (codigo: string) =>
    apiFetch<IncidenciaPopup>(`/dashboard-v2/incidencia/${codigo}/popup`),

  kpis: (p: FiltrosConPeriodo = {}) =>
    apiFetch<Kpis>(`/dashboard-v2/kpis${qs(p)}`),

  storytelling: (p: FiltrosConPeriodo = {}) =>
    apiFetch<Storytelling>(`/dashboard-v2/storytelling${qs(p)}`),

  sectores: (p: FiltrosBase & { limite?: number } = {}) =>
    apiFetch<SectorRank[]>(`/dashboard-v2/sectores${qs(p)}`),

  heatmapSectores: (p: FiltrosBase = {}) =>
    apiFetch<HeatmapSector[]>(`/dashboard-v2/heatmap-sectores${qs(p)}`),

  topCalles: (p: FiltrosBase & { limite?: number } = {}) =>
    apiFetch<TramoRank[]>(`/dashboard-v2/top-calles${qs(p)}`),

  serieMensual: (p: FiltrosBase = {}) =>
    apiFetch<SerieMensual>(`/dashboard-v2/serie-mensual${qs(p)}`),

  tiempoResolucionMensual: (p: FiltrosBase = {}) =>
    apiFetch<SerieTiempoResolucion>(`/dashboard-v2/tiempo-resolucion-mensual${qs(p)}`),

  robosMensual: (p: { anio?: number } = {}) =>
    apiFetch<SerieMensual>(`/dashboard-v2/robos-mensual${qs(p)}`),

  tipoAtencionMensual: (p: FiltrosBase = {}) =>
    apiFetch<SerieStacked>(`/dashboard-v2/tipo-atencion-mensual${qs(p)}`),

  reincidentes: (p: { meses?: number; minimo?: number; solo_robo?: boolean; limite?: number } = {}) =>
    apiFetch<Reincidente[]>(`/dashboard-v2/reincidentes${qs(p)}`),

  sinSolucion: (p: FiltrosBase & { limite?: number } = {}) =>
    apiFetch<SinSolucionRow[]>(`/dashboard-v2/sin-solucion${qs(p)}`),

  multiReclamos: (p: FiltrosBase & { minimo?: number; limite?: number } = {}) =>
    apiFetch<MultiReclamo[]>(`/dashboard-v2/multi-reclamos${qs(p)}`),

  parentesco: (p: FiltrosBase = {}) =>
    apiFetch<ParentescoSlice[]>(`/dashboard-v2/parentesco${qs(p)}`),

  alertas: () => apiFetch<Alerta[]>(`/dashboard-v2/alertas`),

  prediccionSectores: (p: { lookback?: number } = {}) =>
    apiFetch<PrediccionSector[]>(`/dashboard-v2/prediccion-sectores${qs(p)}`),
};
