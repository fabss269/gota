import type { ReactNode } from 'react';

/** No-op en nativo: el "frame" de teléfono es una ayuda visual solo para el navegador de escritorio. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
