import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { Colors, Spacing } from '@/constants/theme';

const SIZE = 120;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Props = { agua: number; desague: number };

/** Donut "Tickets por categoría" (Spec 09, RF-09.3). */
export function CategoryDonut({ agua, desague }: Props) {
  const aguaLength = (agua / 100) * CIRCUMFERENCE;

  return (
    <View style={styles.row}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <G transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={Colors.desague}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={Colors.agua}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${aguaLength} ${CIRCUMFERENCE - aguaLength}`}
          />
        </G>
      </Svg>
      <View style={styles.legend}>
        <LegendRow color={Colors.agua} label={`Agua  ·  ${agua}%`} />
        <LegendRow color={Colors.desague} label={`Desagüe  ·  ${desague}%`} />
      </View>
    </View>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  legend: { gap: Spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12.5, fontWeight: '500', color: Colors.textBody },
});
