import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { SectorPrioridad } from '@/mocks/dashboardMock';

const COLOR_MAP: Record<SectorPrioridad['color'], string> = {
  verde: Colors.statusATiempo,
  amarillo: Colors.statusAlerta,
  rojo: Colors.statusCritica,
};

type Props = { sectores: SectorPrioridad[] };

/** Grid "Mapa esquemático de prioridad por sector" (Spec 09, RF-09.6). */
export function PrioridadSectorGrid({ sectores }: Props) {
  return (
    <View>
      <View style={styles.grid}>
        {sectores.map((s) => (
          <View key={s.sector} style={[styles.cell, { backgroundColor: COLOR_MAP[s.color] }]}>
            <Text style={styles.cellLabel} numberOfLines={2}>
              {s.sector.split('·')[0].trim()}
            </Text>
            <Text style={styles.cellDays}>{s.antiguedadPromedio}d</Text>
          </View>
        ))}
      </View>
      <View style={styles.legendRow}>
        <LegendItem color={Colors.statusATiempo} label="Verde ≤11d" />
        <LegendItem color={Colors.statusAlerta} label="Amarillo 11-22d" />
        <LegendItem color={Colors.statusCritica} label="Rojo >22d" />
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  cell: {
    width: 74,
    height: 54,
    borderRadius: 8,
    padding: 6,
    justifyContent: 'space-between',
  },
  cellLabel: { fontSize: 9, fontWeight: '700', color: Colors.white },
  cellDays: { fontSize: 9, fontWeight: '600', color: Colors.white },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 9, height: 9, borderRadius: 2 },
  legendLabel: { fontSize: 9.5, fontWeight: '500', color: Colors.textBody },
});
