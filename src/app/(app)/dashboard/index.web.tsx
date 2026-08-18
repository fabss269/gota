import { useNavigation } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardTabsBar, type DashboardTab } from '@/components/dashboard-web/DashboardTabsBar';
import { HeatmapMap } from '@/components/dashboard-web/HeatmapMap.web';
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
import { esMobile, useBreakpoint } from '@/hooks/useBreakpoint';
import { openDrawer } from '@/navigation/openDrawer';

export default function DashboardWebScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState<DashboardTab>('resumen');
  const bp = useBreakpoint();
  const mobile = esMobile(bp);

  // Estilos derivados del breakpoint — mainRow y chartsRow colapsan a 1 col en
  // mobile; el mapa reduce su alto para no ocupar 3 pantallazos de scroll;
  // rightCol pierde su ancho máximo (era 380px, en mobile debe ser full).
  const dyn = useMemo(() => {
    const alturaMapa = mobile ? 340 : bp === 'tablet' ? 520 : 720;
    return StyleSheet.create({
      scroll: {
        padding: mobile ? Spacing.sm : Spacing.md,
        gap: mobile ? Spacing.sm : Spacing.md,
      },
      mainRow: {
        flexDirection: mobile ? 'column' : 'row',
        gap: Spacing.md,
        height: mobile ? undefined : alturaMapa,
      },
      mapCol: {
        flex: mobile ? undefined : 2,
        height: alturaMapa,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.surface,
      },
      rightCol: {
        flex: mobile ? undefined : 1,
        gap: Spacing.md,
        minWidth: mobile ? undefined : 320,
        maxWidth: mobile ? undefined : 380,
        width: mobile ? '100%' : undefined,
      },
      chartsRow: {
        flexDirection: mobile ? 'column' : 'row',
        gap: Spacing.md,
        flexWrap: 'wrap',
      },
    });
  }, [mobile, bp]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => openDrawer(navigation)} hitSlop={8}>
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
        <Text style={[styles.title, mobile && styles.titleMobile]} numberOfLines={1}>
          Panel operativo · GOTA
        </Text>
      </View>

      {/* KPIs siempre visibles arriba; los tabs debajo. FilterBar global fue
          removida (rediseño Edgar 2026-08-13) — cada gráfico que necesita
          filtro los expone internamente. Layout responsive con 3 breakpoints
          (mobile <640, tablet 640-1024, desktop >=1024) — ver useBreakpoint. */}
      <ScrollView contentContainerStyle={dyn.scroll}>
        <KpiRow />
        <DashboardTabsBar active={tab} onChange={setTab} />

        {tab === 'resumen' && (
          <View style={dyn.mainRow}>
            <View style={dyn.mapCol}>
              <HeatmapMap />
            </View>
            <View style={dyn.rightCol}>
              <TopSectoresBar />
            </View>
          </View>
        )}

        {tab === 'sectores' && (
          <View style={dyn.chartsRow}>
            <TopSectoresBar />
            <RobosPorDistritoChart />
          </View>
        )}

        {tab === 'tendencias' && (
          <>
            <View style={dyn.chartsRow}>
              <MonthlyLineChart mostrarProyeccion={false} />
              <TiempoResolucionChart />
            </View>
            <View style={dyn.chartsRow}>
              <RobosMensualChart />
            </View>
          </>
        )}

        {tab === 'composicion' && (
          <>
            <View style={dyn.chartsRow}>
              <TipoGrupoPie />
              <TipoAtencionPie />
            </View>
            <View style={dyn.chartsRow}>
              <TipoAtencionStacked />
            </View>
          </>
        )}

        {tab === 'predictivo' && (
          <View style={dyn.chartsRow}>
            <PrediccionSectoresChart />
          </View>
        )}

        {tab === 'robo' && (
          <>
            <View style={dyn.chartsRow}>
              <RobosPorDistritoChart />
              <View style={dyn.mapCol}>
                <HeatmapMap soloRobos />
              </View>
            </View>
            <View style={dyn.chartsRow}>
              <RobosMensualChart />
            </View>
          </>
        )}

        {tab === 'red' && (
          <View style={dyn.chartsRow}>
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
  titleMobile: { fontSize: 14 },
});
