import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { mockLogin } from '@/mocks/authMock';
import {
  clearSession,
  getStoredSession,
  isSessionExpired,
  saveSession,
  type StoredUser,
} from '@/auth/session';

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: StoredUser | null;
  signIn: (correo: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    (async () => {
      const session = await getStoredSession();
      if (session && !isSessionExpired(session)) {
        setUser(session.usuario);
      }
      setIsLoading(false);
    })();
  }, []);

  const signIn = async (correo: string, password: string) => {
    // Spec 02, RF-02.3: contra backend real esto sería src/api/auth.ts -> POST /auth/login
    const response = await mockLogin(correo, password);
    await saveSession({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
      usuario: response.usuario,
    });
    setUser(response.usuario);
  };

  const signOut = async () => {
    await clearSession();
    setUser(null);
  };

  const value = useMemo<AuthState>(
    () => ({ isLoading, isAuthenticated: !!user, user, signIn, signOut }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
