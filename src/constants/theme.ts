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
  border: '#E3E7EE',
  white: '#FFFFFF',
} as const;

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
