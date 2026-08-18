import { apiFetch } from '@/api/client';
import type { ApiFocoActivo, ApiImpacto, ApiSimulacion, TipoFalla } from '@/api/types';

export function getImpactoIncidencia(id: string): Promise<ApiImpacto> {
  return apiFetch<ApiImpacto>(`/grafo/incidencias/${encodeURIComponent(id)}/impacto`);
}

export function getFocosActivos(
  tipoRed: 'agua' | 'desague',
  params?: { dias?: number; minReclamos?: number }
): Promise<ApiFocoActivo[]> {
  const query = new URLSearchParams({ tipoRed });
  if (params?.dias) query.set('dias', String(params.dias));
  if (params?.minReclamos) query.set('minReclamos', String(params.minReclamos));
  return apiFetch<ApiFocoActivo[]>(`/grafo/focos?${query.toString()}`);
}

export function postSimulacion(tipoFalla: TipoFalla, elementoId: number): Promise<ApiSimulacion> {
  return apiFetch<ApiSimulacion>('/grafo/simulacion', {
    method: 'POST',
    body: JSON.stringify({ tipoFalla, elementoId }),
  });
}
