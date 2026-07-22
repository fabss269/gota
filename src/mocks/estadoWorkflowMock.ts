import type { EstadoIncidencia } from '@/mocks/incidentsMock';

export type MotivoAvance =
  | 'CUADRILLA_EN_SITIO'
  | 'SE_RESOLVIO'
  | 'REQUIERE_EQUIPO'
  | 'DERIVAR_OTRA_AREA'
  | 'REASIGNAR_TECNICO'
  | 'EN_ESPERA'
  | 'NO_SE_PUDO_ATENDER';

/** RF-07.3 (docs/API.md § 5 `POST /incidencias/{id}/avances`, campo `motivo`). */
export const MOTIVOS_AVANCE: { value: MotivoAvance; label: string }[] = [
  { value: 'CUADRILLA_EN_SITIO', label: 'Cuadrilla en sitio' },
  { value: 'SE_RESOLVIO', label: 'Se resolvió' },
  { value: 'REQUIERE_EQUIPO', label: 'Requiere equipo' },
  { value: 'DERIVAR_OTRA_AREA', label: 'Derivar a otra área' },
  { value: 'REASIGNAR_TECNICO', label: 'Reasignar técnico' },
  { value: 'EN_ESPERA', label: 'En espera' },
  { value: 'NO_SE_PUDO_ATENDER', label: 'No se pudo atender' },
];

export type TransicionEstado = {
  desde: EstadoIncidencia;
  hacia: EstadoIncidencia;
  label: string;
  /** true → abre el formulario de Registrar Avance; false → confirmación simple (RF-07.2). */
  requiereFormulario: boolean;
};

/**
 * Flujo de estados (Spec 07, confirmado por Edgar: CREADO → PENDIENTE → EN_PROGRESO →
 * ATENDIDO, lineal, con un único loop EN_PROGRESO → EN_PROGRESO). Esto NO es una
 * regla de negocio fija: Edgar planea un futuro portal web tipo Jira donde este
 * workflow (y otras cosas configurables del sistema) se edite desde un backend. Por
 * eso vive como datos planos aquí (no como lógica embebida en componentes) — el día
 * que exista ese backend, esta tabla se reemplaza por la respuesta de un endpoint de
 * configuración sin tocar `CambiarEstadoSheet` ni el resto de la UI.
 */
export const TRANSICIONES_ESTADO: TransicionEstado[] = [
  { desde: 'CREADO', hacia: 'PENDIENTE', label: 'Registrar avance', requiereFormulario: true },
  { desde: 'PENDIENTE', hacia: 'EN_PROGRESO', label: 'Registrar avance', requiereFormulario: true },
  { desde: 'EN_PROGRESO', hacia: 'EN_PROGRESO', label: 'Registrar avance', requiereFormulario: true },
  { desde: 'EN_PROGRESO', hacia: 'ATENDIDO', label: 'Marcar como atendido', requiereFormulario: false },
];

export function getTransicionesDisponibles(estado: EstadoIncidencia): TransicionEstado[] {
  return TRANSICIONES_ESTADO.filter((t) => t.desde === estado);
}
