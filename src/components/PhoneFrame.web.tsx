import type { CSSProperties, ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

// Ancho de referencia (celular mediano) y punto a partir del cual el navegador
// se considera "de escritorio" y amerita el frame — por debajo de esto (celular
// real / PWA instalada) la app ya llena la pantalla y el frame no debe aplicarse.
const PHONE_MAX_WIDTH = 430;
const DESKTOP_BREAKPOINT = 560;

type Props = { children: ReactNode };

export function PhoneFrame({ children }: Props) {
  const { width } = useWindowDimensions();

  if (width <= DESKTOP_BREAKPOINT) {
    return <>{children}</>;
  }

  return (
    <div style={backdropStyle}>
      <div style={frameStyle}>{children}</div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#1B2432',
};

const frameStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  maxWidth: PHONE_MAX_WIDTH,
  height: '100vh',
  maxHeight: 932,
  overflow: 'hidden',
  borderRadius: 36,
  border: '8px solid #0B0F14',
  boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
  position: 'relative',
};
