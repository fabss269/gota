import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export type DashboardTab =
  | 'resumen'
  | 'sectores'
  | 'tendencias'
  | 'composicion'
  | 'predictivo'
  | 'red';

const TABS: { key: DashboardTab; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'sectores', label: 'Sectores' },
  { key: 'tendencias', label: 'Tendencias' },
  { key: 'composicion', label: 'Composición' },
  { key: 'predictivo', label: 'Predictivo' },
  { key: 'red', label: 'Red y materiales' },
];

type Props = { active: DashboardTab; onChange: (tab: DashboardTab) => void };

/** Barra de tabs del dashboard ejecutivo. Mismo look que TabsBar de
 * incident-detail, pero sobre la paleta plana (light-only) de dashboard-web. */
export function DashboardTabsBar({ active, onChange }: Props) {
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
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tab: { alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  label: { fontSize: 13, fontWeight: '500', color: Colors.textMuted },
  labelActive: { fontWeight: '700', color: Colors.accent },
  indicator: { height: 3, width: '70%', borderRadius: 2, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: Colors.accent },
});
