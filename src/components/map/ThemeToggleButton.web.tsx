import type { CSSProperties } from 'react';

import { useThemeStore } from '@/state/themeStore';

/** Switch manual de modo oscuro para las pantallas de Mapa (desktop) — pedido de
 * Edgar 2026-08-05, alcance acotado a Mapa (ver useThemeStore). */
export function ThemeToggleButton() {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = mode === 'dark';

  return (
    <button
      type="button"
      style={btn}
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}

const btn: CSSProperties = {
  width: 26,
  height: 26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--map-border)',
  borderRadius: 8,
  background: 'var(--map-surface)',
  cursor: 'pointer',
  fontSize: 13,
  padding: 0,
  flexShrink: 0,
};
