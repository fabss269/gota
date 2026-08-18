import { StyleSheet, View } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';

type Props = {
  data: { x: string; y: number }[];
  color: string;
  height?: number;
  width?: number;
};

/**
 * Mini gráfico de línea sin ejes ni labels. Ideal para poner debajo del número
 * de un KPI. Usa SVG (react-native-svg) para funcionar igual en web y nativo.
 */
export function Sparkline({ data, color, height = 32, width = 120 }: Props) {
  if (!data || data.length < 2) {
    return <View style={{ height, width }} />;
  }
  const ys = data.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = maxY - minY || 1;
  const stepX = width / (data.length - 1);

  const points = data
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p.y - minY) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  // Área bajo la curva (relleno tenue)
  const areaPath = `M 0,${height} L ${points.split(' ').join(' L ')} L ${width},${height} Z`;

  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={areaPath} fill={color} opacity={0.15} />
        <Polyline points={points} stroke={color} strokeWidth={1.5} fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
});
