import { createContext, useContext, type ReactNode } from 'react';

type ToastContextValue = {
  showToast: (message: string, variant?: 'success' | 'error') => void;
};

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

/** No-op en nativo: la app targetea web (ver AGENTS.md), este shim solo evita
 * romper el resolve de Metro en `_layout.tsx` (universal, no `.web.tsx`). */
export function ToastProvider({ children }: { children: ReactNode }) {
  return <ToastContext.Provider value={{ showToast: () => {} }}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
