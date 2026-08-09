import type { StoredUser } from '@/auth/session';

/**
 * Backend simulado (Spec 02 / docs/API.md § 1).
 * Reemplazar por llamadas reales a la API cuando exista (ver src/api/client.ts).
 */
export const MOCK_USERS: { correo: string; password: string; usuario: StoredUser }[] = [
  {
    correo: 'tecnico@epsel.gob.pe',
    password: 'epsel2026',
    usuario: {
      id: 'u_001',
      nombre: 'Juan Gonzales Rubio',
      rol: 'Técnico · Cuadrilla 5',
      sector: 'Sector 5',
      avatarUrl: null,
    },
  },
  {
    correo: 'supervisor@epsel.gob.pe',
    password: 'epsel2026',
    usuario: {
      id: 'u_002',
      nombre: 'María Vásquez Torres',
      rol: 'Supervisor · Operaciones',
      sector: 'Sector 5',
      avatarUrl: null,
    },
  },
];

function randomToken(): string {
  return `mock.${Math.random().toString(36).slice(2)}.${Date.now()}`;
}

export async function mockLogin(correo: string, password: string) {
  await delay(500);
  const found = MOCK_USERS.find((u) => u.correo === correo && u.password === password);
  if (!found) {
    const error = new Error('CREDENCIALES_INVALIDAS');
    error.name = 'CREDENCIALES_INVALIDAS';
    throw error;
  }
  return {
    accessToken: randomToken(),
    refreshToken: randomToken(),
    expiresIn: 3600,
    usuario: found.usuario,
  };
}

export async function mockRefresh(_refreshToken: string) {
  await delay(200);
  return {
    accessToken: randomToken(),
    refreshToken: randomToken(),
    expiresIn: 3600,
    usuario: MOCK_USERS[0].usuario,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
