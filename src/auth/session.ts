import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type StoredUser = {
  id: string;
  nombre: string;
  rol: string;
  sector?: string;
  avatarUrl?: string | null;
};

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  usuario: StoredUser;
};

const KEY = 'epsel_session_v1';

/** expo-secure-store no tiene implementación en web (usa Keychain/Keystore nativos); ahí cae a localStorage. */
async function setStoredValue(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteStoredValue(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveSession(session: StoredSession): Promise<void> {
  await setStoredValue(KEY, JSON.stringify(session));
}

export async function getStoredSession(): Promise<StoredSession | null> {
  const raw = await getStoredValue(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await deleteStoredValue(KEY);
}

export function isSessionExpired(session: StoredSession): boolean {
  return Date.now() >= session.expiresAt;
}
