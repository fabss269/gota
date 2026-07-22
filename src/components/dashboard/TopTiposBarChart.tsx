import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Props = { items: { tipo: string; cantidad: number }[] };

/** Barras horizontales "Top tipos de atención" (Spec 09, RF-09.5). */
export function TopTiposBarChart({ items }: Props) {
  const max = Math.max(...items.map((i) => i.cantidad), 1);

  return (
    <View style={styles.container}>
      {items.map((item) => (
        <View key={item.tipo} style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>
            {item.tipo}
          </Text>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${(item.cantidad / max) * 100}%` }]} />
          </View>
          <Text style={styles.value}>{item.cantidad}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  label: { width: 100, fontSize: 9.5, fontWeight: '500', color: Colors.textBody },
  track: { flex: 1, height: 13, backgroundColor: '#EEF1F6', borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: Colors.accent, borderRadius: 4 },
  value: { width: 28, fontSize: 9.5, color: Colors.textMuted, textAlign: 'right' },
});
