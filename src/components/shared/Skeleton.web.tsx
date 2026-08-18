import type { CSSProperties } from 'react';

const KEYFRAMES = `
@keyframes gota-skeleton-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
`;

/** Placeholder rectangular con pulso de opacidad — mismo mecanismo de `<style>` +
 * `@keyframes` que SimulacionBorderOverlay.web.tsx (única forma de animar sin
 * librería extra en este proyecto). Se monta una sola vez por bloque; el `<style>`
 * repetido no pesa (el navegador dedupea reglas idénticas). */
export function SkeletonBlock({
  width = '100%',
  height = 12,
  radius = 4,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          width,
          height,
          borderRadius: radius,
          backgroundColor: 'var(--map-surface-alt)',
          animation: 'gota-skeleton-pulse 1.2s ease-in-out infinite',
          ...style,
        }}
      />
    </>
  );
}
