/** Fecha corta `DD/MM/YYYY`, usada en listas de reclamos/trazabilidad (Spec 06). */
export function formatFecha(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Fecha + hora `DD/MM/YYYY  ·  HH:MM a. m./p. m.`, formato usado en el diseño Penpot. */
export function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'p. m.' : 'a. m.';
  hours = hours % 12 || 12;
  return `${formatFecha(iso)}  ·  ${String(hours).padStart(2, '0')}:${minutes} ${suffix}`;
}
