import Svg, { Path } from 'react-native-svg';

type Props = { size?: number; color?: string };

/**
 * Glifo de gota reconstruido en SVG plano (Spec 03 / specs/00-auditoria-diseno.md,
 * decisión de íconos: el original en assets/reference/gota.png es una ilustración
 * tipo mascota con color fijo, no apta para tintar por criticidad).
 */
export function GotaIcon({ size = 18, color = '#FFFFFF' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C12 2 5 11.5 5 15.5C5 19.6 8.13 22 12 22C15.87 22 19 19.6 19 15.5C19 11.5 12 2 12 2Z"
        fill={color}
      />
    </Svg>
  );
}
