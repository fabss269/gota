import { useNavigation } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlertasPanel } from '@/components/dashboard-web/AlertasPanel';
import { DashboardMap } from '@/components/dashboard-web/DashboardMap.web';
import { FilterBar } from '@/components/dashboard-web/FilterBar';
import { KpiRow } from '@/components/dashboard-web/KpiRow';
import { MonthlyLineChart } from '@/components/dashboard-web/MonthlyLineChart';
import {
  ReincidentesRoboTable,
  ReincidentesTable,
} from '@/components/dashboard-web/ReincidentesTable';
import { RobosMensualChart } from '@/components/dashboard-web/RobosMensualChart';
import { TiempoResolucionChart } from '@/components/dashboard-web/TiempoResolucionChart';
import { TipoAtencionStacked } from '@/components/dashboard-web/TipoAtencionStacked';
import { TopSectoresBar } from '@/components/dashboard-web/TopSectoresBar';
import { Colors, Spacing } from '@/constants/theme';
import { openDrawer } from '@/navigation/openDrawer';

export default function DashboardWebScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => openDrawer(navigation)} hitSlop={8}>
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
        <Text style={styles.title}>Panel operativo · GOTA</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Filtros globales */}
        <FilterBar />

        {/* KPIs */}
        <KpiRow />

        {/* Fila principal: mapa (grande) + panel derecho (alertas + top sectores) */}
        <View style={styles.mainRow}>
          <View style={styles.mapCol}>
            <DashboardMap />
          </View>
          <View style={styles.rightCol}>
            <AlertasPanel />
            <TopSectoresBar />
          </View>
        </View>

        {/* Charts temporales */}
        <View style={styles.chartsRow}>
          <MonthlyLineChart />
          <TiempoResolucionChart />
        </View>
        <View style={styles.chartsRow}>
          <TipoAtencionStacked />
        </View>

        {/* Tablas operativas — layout:
              [ Reincidentes ] [ Reincidentes robo   ]
              [               ] [ Robos por mes      ]
        */}
        <View style={styles.tablesRow}>
          <View style={styles.tablesLeftCol}>
            <ReincidentesTable />
          </View>
          <View style={styles.tablesRightCol}>
            <ReincidentesRoboTable />
            <RobosMensualChart />
          </View>
        </View>
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
  tablesRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  tablesLeftCol: {
    flex: 1.4,   // más grande — la lista es la protagonista
    minWidth: 500,
  },
  tablesRightCol: {
    flex: 1,
    minWidth: 380,
    gap: Spacing.md,
  },
});
