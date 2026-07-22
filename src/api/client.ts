import { mockRefresh } from '@/mocks/authMock';
import { clearSession, getStoredSession, saveSession } from '@/auth/session';

/**
 * Cliente HTTP con renovación automática de sesión (Spec 02, RF-02.7).
 *
 * Hoy no se usa desde las pantallas (todo corre sobre datos mock locales, ver
 * specs/00-auditoria-diseno.md § 2 — decisión de backend). Queda listo para el día
 * en que `EXPO_PUBLIC_API_BASE_URL` apunte a un backend real: los hooks de
 * src/hooks/* solo necesitan cambiar su fuente de datos mock por `apiFetch(...)`.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.epsel.gob.pe/movil/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  const session = await getStoredSession();
  if (!session) throw new ApiError(401, 'TOKEN_EXPIRADO', 'Sesión no encontrada');
  const response = await mockRefresh(session.refreshToken);
  await saveSession({
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: Date.now() + response.expiresIn * 1000,
    usuario: response.usuario,
  });
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, _retried = false): Promise<T> {
  const session = await getStoredSession();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401 && !_retried) {
    // Evita múltiples refresh en paralelo si varias requests fallan a la vez.
    refreshPromise ??= refreshSession().finally(() => {
      refreshPromise = null;
    });
    try {
      await refreshPromise;
      return apiFetch<T>(path, init, true);
    } catch {
      await clearSession();
      throw new ApiError(401, 'TOKEN_EXPIRADO', 'Sesión expirada');
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Error de red');
  }

  return response.json();
}
