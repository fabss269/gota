import type { ReactNode } from 'react';

type Props = { children: ReactNode };

// El frame simulado de teléfono ya no es necesario: el layout web es responsivo
// (ver mapa/index.web.tsx) y gestiona sus propios breakpoints.
export function PhoneFrame({ children }: Props) {
  return <>{children}</>;
}
