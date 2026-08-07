import { apiFetch } from '@/api/client';
import type { ApiElementoRedDetalle } from '@/api/types';
import type { ElementoRedTipo } from '@/components/map/mapLayers';

export function getElementoRed(tipo: ElementoRedTipo, id: number): Promise<ApiElementoRedDetalle> {
  return apiFetch<ApiElementoRedDetalle>(`/red/elemento/${tipo}/${id}`);
}
