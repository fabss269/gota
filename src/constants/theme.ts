/**
 * Paleta derivada de la auditoría del diseño Penpot.
 * Ver specs/00-auditoria-diseno.md § 5 — no había Design Tokens definidos en Penpot,
 * estos valores se extrajeron de las capturas y se corrigieron donde había errores
 * (ej. el rojo de criticidad).
 */
export const Colors = {
  primary: '#0D2B52',
  primaryDark: '#062A5D',
  accent: '#0152AC',
  agua: '#1565C0',
  desague: '#8E24AA',
  statusATiempo: '#34C759',
  statusAlerta: '#FFCC00',
  statusCritica: '#D32F2F',
  textBody: '#212121',
  textMuted: '#8B9BB8',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  border: '#E3E7EE',
  white: '#FFFFFF',
  dangerBg: '#FDECEC',
  dangerText: '#C0392B',
  accentBg: '#E0E4FF',
} as const;

/**
 * Paleta oscura — alcance acotado a las pantallas de Mapa (mapa, sidebar/panel de
 * capas, detalle de incidencia, bottom sheet), pedido de Edgar 2026-08-05. `white`
 * se mantiene fijo en ambos modos: es texto sobre superficies de color saturado
 * (badges de prioridad, chips activos), no texto de página.
 */
export const ColorsDark = {
  primary: '#B9C7DE',
  primaryDark: '#1C2C42',
  accent: '#4C8DFF',
  agua: '#5B9BF7',
  desague: '#D080E8',
  statusATiempo: '#34C759',
  statusAlerta: '#FFCC00',
  statusCritica: '#F26A69',
  textBody: '#E7EAF0',
  textMuted: '#8B95A8',
  background: '#10151D',
  surface: '#1A212C',
  border: '#2B3444',
  white: '#FFFFFF',
  dangerBg: '#3A1F1F',
  dangerText: '#F1897F',
  accentBg: '#1E2E4A',
} as const;

export type ColorPalette = { [K in keyof typeof Colors]: string };

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;
