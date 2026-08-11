import { useNavigation } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlertasPanel } from '@/components/dashboard-web/AlertasPanel';
import { DashboardMap } from '@/components/dashboard-web/DashboardMap.web';
import { DashboardTabsBar, type DashboardTab } from '@/components/dashboard-web/DashboardTabsBar';
import { FilterBar } from '@/components/dashboard-web/FilterBar';
import { KpiRow } from '@/components/dashboard-web/KpiRow';
import { LongitudPorMaterialChart } from '@/components/dashboard-web/LongitudPorMaterialChart';
import { MonthlyLineChart } from '@/components/dashboard-web/MonthlyLineChart';
import { PrediccionSectoresChart } from '@/components/dashboard-web/PrediccionSectoresChart';
import { RobosMensualChart } from '@/components/dashboard-web/RobosMensualChart';
import { RobosPorDistritoChart } from '@/components/dashboard-web/RobosPorDistritoChart';
import { TiempoResolucionChart } from '@/components/dashboard-web/TiempoResolucionChart';
import { TipoAtencionPie } from '@/components/dashboard-web/TipoAtencionPie';
import { TipoAtencionStacked } from '@/components/dashboard-web/TipoAtencionStacked';
import { TipoGrupoPie } from '@/components/dashboard-web/TipoGrupoPie';
import { TopSectoresBar } from '@/components/dashboard-web/TopSectoresBar';
import { Colors, Spacing } from '@/constants/theme';
import { openDrawer } from '@/navigation/openDrawer';

export default function DashboardWebScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState<DashboardTab>('resumen');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => openDrawer(navigation)} hitSlop={8}>
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
        <Text style={styles.title}>Panel operativo · GOTA</Text>
      </View>

      <DashboardTabsBar active={tab} onChange={setTab} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Filtros globales — aplican a todos los tabs */}
        <FilterBar />

        {tab === 'resumen' && (
          <>
            <KpiRow />
            <View style={styles.mainRow}>
              <View style={styles.mapCol}>
                <DashboardMap />
              </View>
              <View style={styles.rightCol}>
                <AlertasPanel />
              </View>
            </View>
          </>
        )}

        {tab === 'sectores' && (
          <View style={styles.chartsRow}>
            <TopSectoresBar />
            <RobosPorDistritoChart />
          </View>
        )}

        {tab === 'tendencias' && (
          <>
            <View style={styles.chartsRow}>
              <MonthlyLineChart mostrarProyeccion={false} />
              <TiempoResolucionChart />
            </View>
            <View style={styles.chartsRow}>
              <RobosMensualChart />
            </View>
          </>
        )}

        {tab === 'composicion' && (
          <>
            <View style={styles.chartsRow}>
              <TipoGrupoPie />
              <TipoAtencionPie />
            </View>
            <View style={styles.chartsRow}>
              <TipoAtencionStacked />
            </View>
          </>
        )}

        {tab === 'predictivo' && (
          <View style={styles.chartsRow}>
            <PrediccionSectoresChart />
          </View>
        )}

        {tab === 'red' && (
          <View style={styles.chartsRow}>
            <LongitudPorMaterialChart />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
    backgroundColor: Colors.surface,
  },
  menuIcon: { fontSize: 22, color: Colors.textBody },
  title: { fontSize: 16, fontWeight: '700', color: Colors.textBody },

  scroll: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  mainRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    height: 720,
  },
  mapCol: {
    flex: 2,
    height: 720,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  rightCol: {
    flex: 1,
    gap: Spacing.md,
    minWidth: 320,
    maxWidth: 380,
  },

  chartsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
});
