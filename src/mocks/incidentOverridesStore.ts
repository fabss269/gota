import type { EstadoIncidencia } from '@/mocks/incidentsMock';
import type { TrazabilidadPaso } from '@/mocks/incidentDetailMock';
import type { Usuario } from '@/mocks/usuariosMock';

type Override = {
  estado?: EstadoIncidencia;
  tecnico?: Usuario;
  avancesExtra: TrazabilidadPaso[];
};

/**
 * Estado mutable en memoria para las acciones de la Spec 07 (Cambiar estado, Registrar
 * avance, Reasignar responsable). No hay backend real (`docs/API.md` § 5) — esto
 * simula las mutaciones `PATCH`/`POST` para que `useIncidentDetail` refleje el cambio
 * de inmediato (RF-07.6, RF-07.9) al invalidar su query. Se pierde al recargar la app
 * (no persiste), que es aceptable para una capa de mock.
 */
const overrides = new Map<string, Override>();

function getOrCreate(id: string): Override {
  let o = overrides.get(id);
  if (!o) {
    o = { avancesExtra: [] };
    overrides.set(id, o);
  }
  return o;
}

export function getOverride(id: string): Override | undefined {
  return overrides.get(id);
}

export function setEstadoOverride(id: string, estado: EstadoIncidencia): void {
  getOrCreate(id).estado = estado;
}

export function setTecnicoOverride(id: string, tecnico: Usuario): void {
  getOrCreate(id).tecnico = tecnico;
}

export function appendAvanceOverride(id: string, paso: TrazabilidadPaso): void {
  getOrCreate(id).avancesExtra.push(paso);
}
