import { apiFetch } from '@/api/client';
import type { ApiDistrito, ApiProvincia, ApiSector, ApiSuministro, ApiTipoGrupo } from '@/api/types';

export function getTiposGrupo(): Promise<ApiTipoGrupo[]> {
  return apiFetch<ApiTipoGrupo[]>('/catalogos/tipos-grupo');
}

export function getProvincias(): Promise<ApiProvincia[]> {
  return apiFetch<ApiProvincia[]>('/catalogos/provincias');
}

export function getDistritos(): Promise<ApiDistrito[]> {
  return apiFetch<ApiDistrito[]>('/catalogos/distritos');
}

export function getSectores(distritoId?: string): Promise<ApiSector[]> {
  const query = distritoId ? `?${new URLSearchParams({ distritoId })}` : '';
  return apiFetch<ApiSector[]>(`/catalogos/sectores${query}`);
}

export function buscarSuministro(codigo: string): Promise<ApiSuministro> {
  return apiFetch<ApiSuministro>(`/catalogos/suministro/${encodeURIComponent(codigo)}`);
}
