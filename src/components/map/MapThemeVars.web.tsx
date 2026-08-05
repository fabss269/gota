import { useEffect } from 'react';

import { useThemeStore } from '@/state/themeStore';

/**
 * Puente entre useThemeStore y CSS custom properties para las pantallas de Mapa en
 * desktop (FiltersSidebar, CatastroFloatingPanel, DetailPanel, LocationSearchBar,
 * SimulacionControl, mapa/index.web.tsx) — todas usan `style={{ color: 'var(--x)' }}`
 * en vez de hex directo. Un solo `data-theme` en <html> cambia todo el árbol sin
 * tener que re-computar cada objeto de estilo por render (a diferencia de los
 * componentes React Native compartidos con mobile, que sí necesitan leer
 * useThemeColors() reactivamente porque StyleSheet.create no soporta CSS vars en
 * nativo). Solo existe la variante .web — no se monta en builds nativos.
 */
export function MapThemeVars() {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [mode]);

  return (
    <style>{`
      [data-theme="light"] {
        --map-bg: #F0F2F5;
        --map-surface: #FFFFFF;
        --map-surface-alt: #F5F6F8;
        --map-border: #E3E7EE;
        --map-text: #212121;
        --map-text-muted: #8B9BB4;
        --map-accent: #0152AC;
        --map-accent-bg: #EAF1FB;
        --map-shadow: rgba(6, 42, 93, 0.14);
        --map-danger-bg: #FDECEC;
        --map-danger-text: #C0392B;
      }
      [data-theme="dark"] {
        --map-bg: #10151D;
        --map-surface: #1A212C;
        --map-surface-alt: #222B38;
        --map-border: #2B3444;
        --map-text: #E7EAF0;
        --map-text-muted: #8B95A8;
        --map-accent: #4C8DFF;
        --map-accent-bg: #1E2E4A;
        --map-shadow: rgba(0, 0, 0, 0.45);
        --map-danger-bg: #3A1F1F;
        --map-danger-text: #F1897F;
      }
    `}</style>
  );
}
