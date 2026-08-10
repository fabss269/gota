import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import type { ApiIncidenciaDetalle, ApiPredioReclamo, ApiTrazabilidadPaso } from '@/api/types';
import type { IncidenciaDetalle, IncidenciaRelacionada, ReclamoPredio, TrazabilidadPaso } from '@/mocks/incidentDetailMock';

async function hidratarRelacionadas(ids: string[]): Promise<IncidenciaRelacionada[]> {
  // El backend solo da los IDs en `foco.incidenciasRelacionadasIds` (no hidratados) —
  // `quejas_max_relacionadas` (config backend) acota esto a 10, así que el N+1 es barato.
  const detalles = await Promise.all(ids.map((relId) => apiFetch<ApiIncidenciaDetalle>(`/incidencias/${relId}`)));
  return detalles.map((d) => ({
    id: d.id,
    tipo: d.tipo,
    direccion: d.direccion ?? 'Dirección no disponible',
    sector: d.catastro?.sector ?? 'Sin sector',
    estado: d.estado,
  }));
}

function toTrazabilidadPaso(p: ApiTrazabilidadPaso): TrazabilidadPaso {
  return {
    estado: p.estado,
    fecha: p.fecha,
    grupo: p.grupo ?? undefined,
    asignadoA: p.asignadoA ?? undefined,
    nota: p.nota ?? undefined,
  };
}

function toReclamoPredio(p: ApiPredioReclamo): ReclamoPredio {
  return { id: p.id, tipo: p.tipo, fecha: p.fecha };
}

/**
 * Detalle de una incidencia (Spec 06). Junta 3 llamadas (`/incidencias/{id}`,
 * `/trazabilidad`, `/predio`, docs/API.md § 4) y, si hay foco, hidrata
 * `foco.incidenciasRelacionadasIds`.
 *
 * Campos sin equivalente real en el backend hoy quedan con un placeholder fijo — gap
 * de datos conocido, no bloqueante visualmente: `reclamo.canal` (el backend no lo
 * registra), `catastro.conexionAproximada` (no existe ese flag en `sig`),
 * `reclamosAgrupados` (el backend solo da el conteo `quejasAgrupadas`, no la lista).
 */
export function useIncidentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['incidencia-detalle', id],
    queryFn: async (): Promise<IncidenciaDetalle> => {
      if (!id) throw new Error('NO_ENCONTRADO');

      const [detalle, trazabilidad, predioHistorico] = await Promise.all([
        apiFetch<ApiIncidenciaDetalle>(`/incidencias/${id}`),
        apiFetch<ApiTrazabilidadPaso[]>(`/incidencias/${id}/trazabilidad`),
        apiFetch<ApiPredioReclamo[]>(`/incidencias/${id}/predio`),
      ]);

      const incidenciasRelacionadas = detalle.foco
        ? await hidratarRelacionadas(detalle.foco.incidenciasRelacionadasIds)
        : [];

      return {
        id: detalle.id,
        tipo: detalle.tipo,
        categoria: detalle.categoria,
        direccion: detalle.direccion ?? 'Dirección no disponible',
        codigoSuministro: detalle.codigoSuministro ?? null,
        sector: detalle.catastro?.sector ?? 'Sin sector',
        prioridad: detalle.prioridad ?? 'a_tiempo',
        estado: detalle.estado,
        antiguedadDias: detalle.antiguedadDias,
        // Backend los resuelve vía catastro (mismo predio_catastral que arma
        // `catastro` acá abajo) — pueden salir null si el suministro no matcheó
        // en `sig` (ver memoria backend), de ahí el fallback a 0.
        lat: detalle.lat ?? 0,
        lon: detalle.lon ?? 0,
        fechaCreacion: detalle.reclamo?.fechaRegistro ?? new Date().toISOString(),
        tecnicoAsignado: detalle.tecnicoAsignado
          ? { id: detalle.tecnicoAsignado.id, nombre: detalle.tecnicoAsignado.nombre, rol: 'tecnico', sector: '' }
          : null,
        reclamo: {
          fechaRegistro: detalle.reclamo?.fechaRegistro ?? new Date().toISOString(),
          medioRecepcion: detalle.reclamo?.medioRecepcion ?? 'No especificado',
          canal: '—',
          descripcion: detalle.reclamo?.descripcion ?? 'Sin descripción registrada.',
          detalleTicket: detalle.reclamo?.detalleTicket ?? null,
          esRobo: detalle.reclamo?.esRobo ?? false,
        },
        catastro: {
          redAsociada: detalle.catastro?.redAsociada ?? 'Sin red asociada',
          diametroMm: detalle.catastro?.diametroMm ?? 0,
          material: detalle.catastro?.material ?? 'No disponible',
          buzonCercano: detalle.catastro?.buzonCercano ?? 'No disponible',
          conexionAproximada: false,
        },
        quejasAgrupadas: detalle.quejasAgrupadas,
        reclamosAgrupados: [],
        predio: {
          noReincidente: detalle.predio.noReincidente,
          quejasUltimos6Meses: detalle.predio.quejasUltimos6Meses,
          historico: predioHistorico.map(toReclamoPredio),
        },
        foco: detalle.foco
          ? { descripcion: detalle.foco.descripcion, incidenciasRelacionadas: incidenciasRelacionadas }
          : null,
        trazabilidad: trazabilidad.map(toTrazabilidadPaso),
      };
    },
    enabled: !!id,
  });
}
