/**
 * Genera los iconos de pin (forma de gota con círculo blanco al centro) como
 * canvas / ImageData para registrarlos en MapLibre via map.addImage().
 * Uno por color: rojo (agua) y morado (desagüe).
 */

export const PIN_COLORS = {
  agua: '#0D2B52',    // azul oscuro (Colors.primary del theme)
  desague: '#166534', // verde oscuro — se distingue del rojo del halo
} as const;

// Color del halo pulsante para incidencias con resolución lenta (agua>45d, desagüe>30d).
// Rojo para ambas — llama la atención sin depender del grupo.
export const HALO_COLOR = '#EF4444';

/**
 * Dibuja un pin (teardrop) del color dado sobre un canvas 40x50.
 * Devuelve ImageData compatible con map.addImage(id, {width, height, data}).
 */
export function createPinImageData(color: string): ImageData {
  const width = 40;
  const height = 50;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context not available');

  // Cuerpo del pin (teardrop): círculo arriba + triángulo abajo
  ctx.beginPath();
  ctx.arc(20, 18, 16, Math.PI * 0.85, Math.PI * 0.15, false);
  ctx.lineTo(20, 48);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  // Círculo blanco central donde va el número
  ctx.beginPath();
  ctx.arc(20, 18, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();

  return ctx.getImageData(0, 0, width, height);
}

/**
 * Registra los pines en el mapa. Idempotente — si ya existen no reventa.
 */
export function registerPinIcons(map: maplibregl.Map): void {
  (['agua', 'desague'] as const).forEach((grupo) => {
    const id = `pin-${grupo}`;
    if (map.hasImage(id)) return;
    const data = createPinImageData(PIN_COLORS[grupo]);
    map.addImage(id, data, { pixelRatio: 2 });
  });
}
