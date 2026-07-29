import { clearSession, getStoredSession, saveSession } from '@/auth/session';

/** Cliente HTTP con renovación automática de sesión (Spec 02, RF-02.7). */
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.epsel.gob.pe/movil/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = code;
  }
}

let refreshPromise: Promise<void> | null = null;

type LoginResponseShape = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  usuario: import('@/auth/session').StoredUser;
};

async function refreshSession(): Promise<void> {
  const session = await getStoredSession();
  if (!session) throw new ApiError(401, 'TOKEN_EXPIRADO', 'Sesión no encontrada');
  // Llamada directa con fetch (no apiFetch): apiFetch en 401 llama a refreshSession,
  // así que pasar por él aquí crearía un loop si el propio refresh también da 401.
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!res.ok) throw new ApiError(res.status, 'TOKEN_EXPIRADO', 'No se pudo renovar la sesión');
  const response: LoginResponseShape = await res.json();
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
