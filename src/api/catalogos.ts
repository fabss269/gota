import { apiFetch } from '@/api/client';
import type { ApiDistrito, ApiProvincia, ApiSector, ApiSuministro } from '@/api/types';

export function getProvincias(): Promise<ApiProvincia[]> {
  return apiFetch<ApiProvincia[]>('/catalogos/provincias');
}

export function getDistritos(): Promise<ApiDistrito[]> {
  return apiFetch<ApiDistrito[]>('/catalogos/distritos');
}

export function getSectores(): Promise<ApiSector[]> {
  return apiFetch<ApiSector[]>('/catalogos/sectores');
}

export function buscarSuministro(codigo: string): Promise<ApiSuministro> {
  return apiFetch<ApiSuministro>(`/catalogos/suministro/${encodeURIComponent(codigo)}`);
}
