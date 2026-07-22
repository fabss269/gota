import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { KpiCard } from '@/mocks/dashboardMock';

type Props = { kpis: KpiCard[] };

/**
 * Fila de 4 tarjetas KPI (Spec 09, RF-09.2). Valores mock a propósito — ver
 * `src/mocks/dashboardMock.ts`. El caption debajo lo deja explícito también en la UI,
 * no solo en el código/specs.
 */
export function KpiRow({ kpis }: Props) {
  return (
    <View>
      <View style={styles.grid}>
        {kpis.map((kpi) => (
          <View key={kpi.label} style={styles.card}>
            <Text style={styles.value}>{kpi.value}</Text>
            <Text style={styles.label}>{kpi.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.caption}>Valores de ejemplo — métricas pendientes de validar con negocio.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 4,
  },
  value: { fontSize: 20, fontWeight: '700', color: Colors.white },
  label: { fontSize: 12, color: '#B7C2D9' },
  caption: { fontSize: 10.5, color: Colors.textMuted, marginTop: Spacing.xs, fontStyle: 'italic' },
});
