import type { CSSProperties } from 'react';

type Props = {
  // Multiplicador base — con size=1 el spinner mide 44px de lado y borde 4px.
  size?: number;
  // Color del arco giratorio (por default el accent del proyecto).
  color?: string;
  // Color del anillo de fondo, semi-transparente para dar contraste sobre
  // fondos claros y oscuros del mapa sin necesitar una card detrás.
  backdropColor?: string;
  // Si `true` (default), monta un overlay `position: fixed` que centra el
  // loader en toda la pantalla. Si `false`, renderiza inline en el JSX.
  overlay?: boolean;
};

// Loader "doble anillo" — un anillo backdrop semi-transparente ancla la forma
// circular y un arco de color rota encima. Se lee bien sobre cualquier
// basemap (OSM, satelital, mixto) sin card ni sombra.
export function Loader({
  size = 1,
  color = '#1F72E0',
  backdropColor = 'rgba(0,0,0,0.18)',
  overlay = true,
}: Props) {
  const spinner = (
    <>
      <style>{keyframes}</style>
      <span
        style={{
          position: 'relative',
          width: 44 * size,
          height: 44 * size,
          borderRadius: '50%',
          display: 'inline-block',
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            border: `${4 * size}px solid ${backdropColor}`,
            borderRadius: '50%',
            boxSizing: 'border-box',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            border: `${4 * size}px solid ${color}`,
            borderTopColor: 'transparent',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            boxSizing: 'border-box',
            animation: 'gota-loader-rotation 0.9s linear infinite',
          }}
        />
      </span>
    </>
  );

  if (!overlay) return spinner;

  return (
    <div style={overlayStyle} role="status" aria-label="Cargando">
      {spinner}
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 1000,
};

const keyframes = '@keyframes gota-loader-rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
