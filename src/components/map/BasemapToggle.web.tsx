import { Ionicons } from '@expo/vector-icons';
import type { CSSProperties } from 'react';

import { useBasemapStore } from '@/state/basemapStore';

// Botón flotante en la esquina inferior-izquierda del mapa (estilo Google
// Maps). Alterna entre OSM y satélite (Esri World Imagery). La lógica de
// visibility de capas vive en MapView.web.tsx escuchando basemapStore.
export function BasemapToggle() {
  const mode = useBasemapStore((s) => s.mode);
  const toggle = useBasemapStore((s) => s.toggle);
  const esSatelital = mode === 'satellite';

  return (
    <button
      type="button"
      onClick={toggle}
      style={btn}
      title={esSatelital ? 'Cambiar a mapa' : 'Cambiar a satélite'}
      aria-label={esSatelital ? 'Cambiar a mapa' : 'Cambiar a satélite'}
    >
      <Ionicons
        name={esSatelital ? 'map-outline' : 'earth-outline'}
        size={16}
        color="var(--map-text)"
      />
      <span>{esSatelital ? 'Mapa' : 'Satélite'}</span>
    </button>
  );
}

const btn: CSSProperties = {
  position: 'absolute',
  left: 12,
  bottom: 12,
  zIndex: 10,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--map-text)',
  backgroundColor: 'var(--map-surface)',
  border: 'none',
  borderRadius: 8,
  boxShadow: '0 2px 6px rgba(0,0,0,0.20)',
  cursor: 'pointer',
};
