import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';
import type { ApiUsuario } from '@/api/types';
import type { Usuario } from '@/mocks/usuariosMock';

function toUsuario(u: ApiUsuario): Usuario {
  return { id: u.id, nombre: u.nombre, rol: u.rol as Usuario['rol'], sector: u.sector ?? '' };
}

/**
 * Técnicos/supervisores para reasignar (Spec 07). `GET /usuarios?rol=` (docs/API.md § 6).
 * Sin filtro por sector — decisión confirmada con Edgar: la lista siempre muestra el
 * pool completo (ver comentario en `src/mocks/usuariosMock.ts`).
 */
export function useUsuarios(roles: Usuario['rol'][] = ['tecnico', 'supervisor']) {
  return useQuery({
    queryKey: ['usuarios', roles],
    queryFn: async () => {
      const items = await apiFetch<ApiUsuario[]>(`/usuarios?rol=${roles.join(',')}`);
      return items.map(toUsuario);
    },
  });
}
