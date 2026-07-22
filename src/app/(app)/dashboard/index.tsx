import { useNavigation } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryDonut } from '@/components/dashboard/CategoryDonut';
import { KpiRow } from '@/components/dashboard/KpiRow';
import { PrioridadSectorGrid } from '@/components/dashboard/PrioridadSectorGrid';
import { TicketsLineChart } from '@/components/dashboard/TicketsLineChart';
import { TopTiposBarChart } from '@/components/dashboard/TopTiposBarChart';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { openDrawer } from '@/navigation/openDrawer';

/** Dashboard (Spec 09) — panel de métricas de supervisión. */
export default function DashboardScreen() {
  const navigation = useNavigation();
  const { data, isLoading, isError, refetch } = useDashboardMetrics();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => openDrawer(navigation)}>
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
        <Text style={styles.title}>Dashboard</Text>
      </View>

      {isLoading && (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Cargando métricas…</Text>
        </View>
      )}
      {isError && (
        <Pressable style={styles.statusBox} onPress={() => refetch()}>
          <Text style={styles.statusText}>No se pudo cargar. Toca para reintentar.</Text>
        </Pressable>
      )}

      {data && (
        <ScrollView contentContainerStyle={styles.body}>
          <KpiRow kpis={data.kpis} />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tickets por categoría</Text>
            <CategoryDonut agua={data.categoriaSplit.agua} desague={data.categoriaSplit.desague} />
          </View>

          <View style={styles.card}>
            <TicketsLineChart serie={data.serieTickets} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top tipos de atención</Text>
            <TopTiposBarChart items={data.topTipos} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mapa esquemático de prioridad por sector</Text>
            <PrioridadSectorGrid sectores={data.prioridadPorSector} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  menuIcon: { fontSize: 22, color: Colors.primaryDark },
  title: { fontSize: 20, fontWeight: '800', color: Colors.primaryDark },
  statusBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusText: { color: Colors.textMuted, fontSize: 13 },
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  cardTitle: { fontSize: 12.5, fontWeight: '700', color: Colors.primaryDark, marginBottom: Spacing.sm },
});
