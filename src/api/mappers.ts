import type { Incidencia } from '@/mocks/incidentsMock';
import type { ApiIncidencia } from '@/api/types';

/**
 * El backend permite `direccion`/`sector`/`prioridad`/`lat`/`lon` nulos (catastro sin
 * resolver, alertas fuera de alcance — ver specs/03 y specs/04 del backend); el resto
 * de la UI asume estos campos siempre presentes, así que se rellenan con un default
 * seguro en vez de propagar `null` a componentes que no lo esperan.
 */
export function toIncidencia(item: ApiIncidencia): Incidencia {
  return {
    id: item.id,
    tipo: item.tipo,
    categoria: item.categoria,
    direccion: item.direccion ?? 'Dirección no disponible',
    sector: item.sector ?? 'Sin sector',
    prioridad: item.prioridad ?? 'a_tiempo',
    estado: item.estado,
    antiguedadDias: item.antiguedadDias,
    lat: item.lat ?? 0,
    lon: item.lon ?? 0,
    fechaCreacion: item.fechaCreacion,
  };
}
