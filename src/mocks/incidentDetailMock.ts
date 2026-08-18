import { INCIDENCIAS_ALL, type Categoria, type EstadoIncidencia, type Incidencia } from '@/mocks/incidentsMock';
import { getOverride } from '@/mocks/incidentOverridesStore';
import { USUARIOS, type Usuario } from '@/mocks/usuariosMock';

export type TrazabilidadPaso = {
  estado: EstadoIncidencia;
  fecha: string | null; // null = paso futuro, no alcanzado todavía (RF-06.5)
  grupo?: string;
  asignadoA?: string;
  motivo?: string;
  nota?: string;
};

export type ReclamoAgrupado = { id: string; fecha: string };
export type ReclamoPredio = { id: string; tipo: string; fecha: string; detalleTicket: string | null };
export type IncidenciaRelacionada = { id: string; tipo: string; direccion: string; sector: string; estado: EstadoIncidencia };

export type IncidenciaDetalle = Incidencia & {
  codigoSuministro: string | null;
  tecnicoAsignado: Usuario | null;
  reclamo: {
    fechaRegistro: string;
    medioRecepcion: string;
    canal: string;
    descripcion: string;
    detalleTicket: string | null;
    esRobo: boolean;
  };
  catastro: {
    redAsociada: string;
    diametroMm: number;
    material: string;
    buzonCercano: string;
    conexionAproximada: boolean;
  };
  quejasAgrupadas: number;
  reclamosAgrupados: ReclamoAgrupado[];
  predio: { noReincidente: boolean; quejasUltimos6Meses: number; historico: ReclamoPredio[] };
  foco: { descripcion: string; incidenciasRelacionadas: IncidenciaRelacionada[] } | null;
  trazabilidad: TrazabilidadPaso[];
};

const ESTADOS_ORDEN: EstadoIncidencia[] = ['CREADO', 'PENDIENTE', 'EN_PROGRESO', 'ATENDIDO'];

const MEDIOS_RECEPCION = ['Teléfono', 'Presencial', 'Correo electrónico'];
const CANALES = ['App móvil EPSEL', 'Central telefónica 104', 'Oficina Sector'];
const MATERIALES = ['PVC', 'Fierro fundido dúctil', 'Asbesto cemento', 'HDPE'];
const DIAMETROS_MM = [110, 160, 200, 250, 315];
const DESCRIPCIONES: Record<Categoria, string[]> = {
  agua: [
    'Fuga visible en vereda, frente al domicilio. Agua acumulada desde la madrugada.',
    'Pérdida de presión reportada por varios vecinos de la cuadra.',
    'Tubería expuesta tras trabajo de pavimentación reciente.',
  ],
  desague: [
    'Atoro recurrente en colector, agua residual acumulada en vía pública.',
    'Buzón rebalsado, olor fuerte reportado por vecinos.',
    'Colapso parcial de tubería secundaria.',
  ],
};
const RED_ASOCIADA: Record<Categoria, string[]> = {
  agua: ['Red primaria de agua potable', 'Red secundaria de agua potable'],
  desague: ['Red primaria de desagüe', 'Red secundaria de desagüe'],
};
const FOCO_CAUSA: Record<Categoria, string> = {
  agua: 'fuga en tramo de red matriz',
  desague: 'colapso en tramo de red primaria',
};

const TECNICOS_POOL = USUARIOS.filter((u) => u.rol === 'tecnico');

/** Hash determinístico (no `Math.random`): mismo `id` → mismos datos siempre. */
function hashCode(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(pool: T[], seed: number): T {
  return pool[seed % pool.length];
}

function sectorKey(sector: string): string {
  return sector.split('·')[0].trim();
}

/**
 * Genera el detalle completo de una incidencia (Spec 06) a partir de sus campos ya
 * existentes en `INCIDENCIAS_ALL` (Spec 03/05), determinístico por `id` — no hay
 * backend real todavía (`docs/API.md` § 4), y se decidió con Edgar generar detalle
 * completo para las 28 incidencias del mock en vez de solo un par "vitrina", para que
 * cualquier fila de la Lista/Mapa sea tocable con un resultado coherente.
 */
export function getIncidentDetail(id: string): IncidenciaDetalle | undefined {
  const base = INCIDENCIAS_ALL.find((i) => i.id === id);
  if (!base) return undefined;

  const seed = hashCode(id);
  const override = getOverride(id);
  const estadoEfectivo = override?.estado ?? base.estado;

  const tecnicoAsignado =
    override?.tecnico ?? (estadoEfectivo === 'CREADO' ? null : pick(TECNICOS_POOL, seed));

  const descripcion = pick(DESCRIPCIONES[base.categoria], seed + 3);
  const reclamo = {
    fechaRegistro: base.fechaCreacion,
    medioRecepcion: pick(MEDIOS_RECEPCION, seed),
    canal: pick(CANALES, seed + 7) + (base.sector.includes('Sector') ? ` ${sectorKey(base.sector)}` : ''),
    descripcion,
    detalleTicket: `${descripcion} Se solicita atención inmediata por parte de la cuadrilla de zona.`,
    esRobo: base.tipo.toLowerCase().includes('medidor') && seed % 4 === 0,
  };

  const catastro = {
    redAsociada: pick(RED_ASOCIADA[base.categoria], seed + 1),
    diametroMm: pick(DIAMETROS_MM, seed + 2),
    material: pick(MATERIALES, seed + 4),
    buzonCercano: `BZ-0${(seed % 90) + 10} · Cota ${40 + (seed % 20)}.${seed % 9}0 m`,
    conexionAproximada: seed % 3 === 0,
  };

  const quejasAgrupadas = 1 + (seed % 5);
  const reclamosAgrupados: ReclamoAgrupado[] = Array.from({ length: Math.min(3, quejasAgrupadas) }, (_, i) => {
    const fecha = new Date(base.fechaCreacion);
    fecha.setDate(fecha.getDate() - i);
    return { id: `EPS-${((seed + i * 13) % 300).toString().padStart(5, '0')}`, fecha: fecha.toISOString() };
  });

  const historicoCount = seed % 4;
  const historico: ReclamoPredio[] = Array.from({ length: historicoCount }, (_, i) => {
    const fecha = new Date(base.fechaCreacion);
    fecha.setDate(fecha.getDate() - (i + 1) * (20 + (seed % 30)));
    return {
      id: `EPS-${((seed + i * 29) % 300).toString().padStart(5, '0')}`,
      tipo: base.tipo,
      fecha: fecha.toISOString(),
      detalleTicket: pick(DESCRIPCIONES[base.categoria], seed + i + 11),
    };
  });
  const predio = {
    noReincidente: historicoCount === 0,
    quejasUltimos6Meses: historicoCount + 1,
    historico,
  };

  const relacionadas = INCIDENCIAS_ALL.filter(
    (i) => i.id !== base.id && i.categoria === base.categoria && sectorKey(i.sector) === sectorKey(base.sector),
  ).slice(0, 3);
  const foco: IncidenciaDetalle['foco'] =
    relacionadas.length > 0
      ? {
          descripcion: `Posible causa común: ${FOCO_CAUSA[base.categoria]}, ${sectorKey(base.sector)}.`,
          incidenciasRelacionadas: relacionadas.map((i) => ({
            id: i.id,
            tipo: i.tipo,
            direccion: i.direccion,
            sector: i.sector,
            estado: i.estado,
          })),
        }
      : null;

  // Pasos "históricos" fabricados hasta el estado ORIGINAL del mock (inmutable) — lo
  // que ya existiría en la Trazabilidad antes de que el usuario haga algo en esta
  // sesión. Cualquier avance/cambio de estado real registrado vía Spec 07 llega
  // después, con fecha real, desde `override.avancesExtra` (ver
  // `incidentOverridesStore.ts`).
  const baseIndex = ESTADOS_ORDEN.indexOf(base.estado);
  const trazabilidad: TrazabilidadPaso[] = [];
  for (let i = 0; i <= baseIndex; i++) {
    const estado = ESTADOS_ORDEN[i];
    const fecha = new Date(base.fechaCreacion);
    fecha.setHours(fecha.getHours() + i * 6);
    const paso: TrazabilidadPaso = { estado, fecha: fecha.toISOString() };
    if (estado === 'PENDIENTE') paso.grupo = 'Mesa de partes';
    if (estado === 'EN_PROGRESO' && i === baseIndex && tecnicoAsignado) {
      paso.asignadoA = `${tecnicoAsignado.nombre} · ${tecnicoAsignado.cuadrilla ?? tecnicoAsignado.sector}`;
    }
    trazabilidad.push(paso);
  }
  trazabilidad.push(...(override?.avancesExtra ?? []));

  const alcanzados = new Set(trazabilidad.map((p) => p.estado));
  for (const estado of ESTADOS_ORDEN) {
    if (!alcanzados.has(estado)) trazabilidad.push({ estado, fecha: null });
  }

  return {
    ...base,
    estado: estadoEfectivo,
    codigoSuministro: `${1000000 + (seed % 800000)}`,
    tecnicoAsignado,
    reclamo,
    catastro,
    quejasAgrupadas,
    reclamosAgrupados,
    predio,
    foco,
    trazabilidad,
  };
}
