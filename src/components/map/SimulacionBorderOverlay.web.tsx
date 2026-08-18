import { useSimulacionStore } from '@/state/simulacionStore';

const COLOR = '#22D3EE';

// `position:fixed` + `inset:0` para cubrir TODO el viewport sin importar dónde se
// monte este componente en el árbol (EpselMapView, montado tanto en el layout
// desktop de 3 columnas como en el mobile de pantalla completa) — así no hace falta
// repetirlo en cada layout, mismo truco que ya usa SimulacionControl para aparecer en
// ambos sin duplicar wiring.
const KEYFRAMES = `
@keyframes gota-simulacion-borde-titilante {
  0%, 100% { box-shadow: inset 0 0 24px 6px ${COLOR}55, inset 0 0 4px 2px ${COLOR}; opacity: 0.55; }
  50% { box-shadow: inset 0 0 60px 18px ${COLOR}AA, inset 0 0 10px 4px ${COLOR}; opacity: 1; }
}
`;

/** Borde titilante celeste de todo el viewport mientras el modo simulación está
 * activo (elegir elemento o modo vista) — efecto "personaje dañado" pedido por
 * Edgar: la pantalla completa "sangra" celeste en vez de rojo. */
export function SimulacionBorderOverlay() {
  const activo = useSimulacionStore((s) => s.activo);
  if (!activo) return null;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 40,
          animation: 'gota-simulacion-borde-titilante 1.4s ease-in-out infinite',
        }}
      />
    </>
  );
}
