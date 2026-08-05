import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Colors, Spacing } from '@/constants/theme';
import type { SerieTicketsPunto } from '@/mocks/dashboardMock';

const WIDTH = 320;
const HEIGHT = 140;
const PAD_LEFT = 34;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;
const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;
const GRID_LINES = 4;

type Categoria = 'agua' | 'desague';

type Props = { serie: SerieTicketsPunto[] };

/** Línea "Tickets" con toggle Agua/Desagüe (Spec 09, RF-09.4). */
export function TicketsLineChart({ serie }: Props) {
  const [categoria, setCategoria] = useState<Categoria>('agua');
  const color = categoria === 'agua' ? Colors.agua : Colors.desague;

  if (serie.length === 0) {
    return (
      <View>
        <Text style={styles.title}>Tickets</Text>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyLabel}>Sin datos disponibles</Text>
        </View>
      </View>
    );
  }

  const values = serie.map((p) => p[categoria]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = serie.map((p, i) => {
    const x = PAD_LEFT + (i / (serie.length - 1)) * PLOT_W;
    const y = PAD_TOP + PLOT_H - ((p[categoria] - min) / range) * PLOT_H;
    return { x, y, mes: p.mes };
  });
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.title}>Tickets</Text>
        <View style={styles.tabs}>
          <Tab label="Agua" active={categoria === 'agua'} color={Colors.agua} onPress={() => setCategoria('agua')} />
          <Tab
            label="Desagüe"
            active={categoria === 'desague'}
            color={Colors.desague}
            onPress={() => setCategoria('desague')}
          />
        </View>
      </View>

      <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {Array.from({ length: GRID_LINES + 1 }, (_, i) => {
          const y = PAD_TOP + (PLOT_H / GRID_LINES) * i;
          const value = Math.round(max - (range / GRID_LINES) * i);
          return (
            <G key={i}>
              <Line x1={PAD_LEFT} y1={y} x2={WIDTH - PAD_RIGHT} y2={y} stroke={Colors.border} strokeWidth={1} />
              <SvgText x={PAD_LEFT - 6} y={y + 3} fontSize={8.5} fill={Colors.textMuted} textAnchor="end">
                {value}
              </SvgText>
            </G>
          );
        })}

        <Polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p) => (
          <Circle key={p.mes} cx={p.x} cy={p.y} r={3} fill={Colors.white} stroke={color} strokeWidth={2} />
        ))}

        {points.map((p) => (
          <SvgText key={p.mes} x={p.x} y={HEIGHT - 4} fontSize={8.5} fill={Colors.textMuted} textAnchor="middle">
            {p.mes}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

function Tab({ label, active, color, onPress }: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Text style={[styles.tabLabel, active && { color, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  title: { fontSize: 16, fontWeight: '700', color: Colors.accent },
  tabs: { flexDirection: 'row', gap: Spacing.sm },
  tabLabel: { fontSize: 13, color: Colors.textMuted },
  emptyBox: {
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FB',
    borderRadius: 8,
  },
  emptyLabel: { fontSize: 12, color: Colors.textMuted },
});
