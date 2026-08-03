import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export type DetailTab = 'detalle' | 'trazabilidad' | 'foco' | 'impacto' | 'predio';

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'detalle', label: 'Detalle' },
  { key: 'trazabilidad', label: 'Trazabilidad' },
  { key: 'foco', label: 'Foco' },
  { key: 'impacto', label: 'Impacto' },
  { key: 'predio', label: 'Predio' },
];

type Props = { active: DetailTab; onChange: (tab: DetailTab) => void };

/** Barra de 4 tabs del Detalle de Incidencia (Spec 06 § 2). */
export function TabsBar({ active, onChange }: Props) {
  return (
    <View style={styles.row}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            <View style={[styles.indicator, isActive && styles.indicatorActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: Spacing.sm },
  label: { fontSize: 12, fontWeight: '400', color: Colors.textMuted },
  labelActive: { fontWeight: '700', color: Colors.accent },
  indicator: { height: 3, width: '70%', borderRadius: 2, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: Colors.accent },
});
