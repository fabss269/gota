import Svg, { Circle, Line } from 'react-native-svg';

type Props = { size?: number; color?: string };

/**
 * Glifo de tapa de alcantarilla (categoría "Desagüe") reconstruido en SVG plano.
 * Ver GotaIcon.tsx / specs/00-auditoria-diseno.md para la justificación.
 */
export function AlcantarilladoIcon({ size = 18, color = '#FFFFFF' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Line x1={12} y1={4} x2={12} y2={20} stroke={color} strokeWidth={1.6} />
      <Line x1={4} y1={12} x2={20} y2={12} stroke={color} strokeWidth={1.6} />
      <Line x1={6.3} y1={6.3} x2={17.7} y2={17.7} stroke={color} strokeWidth={1.6} />
      <Line x1={17.7} y1={6.3} x2={6.3} y2={17.7} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}
