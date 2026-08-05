import BottomSheet from '@gorhom/bottom-sheet';
import { useNavigation, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClusterListSheet } from '@/components/map/ClusterListSheet';
import { LocationSearchBar } from '@/components/map/LocationSearchBar';
import { EpselMapView } from '@/components/map/MapView';
import { MapModeSheet } from '@/components/map/MapModeSheet';
import { MapBottomSheet } from '@/components/sheet/MapBottomSheet';
import { Radius, type ColorPalette } from '@/constants/theme';
import { useIncidentsToday } from '@/hooks/useIncidentsToday';
import { openDrawer } from '@/navigation/openDrawer';
import { useFiltersStore } from '@/state/filtersStore';
import { useMapSearchStore } from '@/state/mapSearchStore';
import { useThemeColors } from '@/state/themeStore';
import { clusterIncidents, type IncidentCluster } from '@/utils/clusterIncidents';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Mapa de incidencias (Spec 03) — pantalla principal de la app. */
export default function MapaScreen() {
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
  const navigation = useNavigation();
  const router = useRouter();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [mapModeVisible, setMapModeVisible] = useState(false);
  const mapMode = useFiltersStore((s) => s.mapMode);

  // Distancia del botón de modo de mapa al fondo de la pantalla — se anima cada vez que
  // el Bottom Sheet cambia de snap point (ver onSheetPositionChange), para que el botón
  // suba junto con el sheet en vez de quedar tapado por él (antes tenía un `bottom` fijo).
  const { height: windowHeight } = useWindowDimensions();
  const GAP_SOBRE_SHEET = 16;
  const SNAP_COLAPSADO = 0.14; // debe coincidir con el primer snapPoint de MapBottomSheet
  const mapModeButtonBottom = useSharedValue(windowHeight * SNAP_COLAPSADO + GAP_SOBRE_SHEET);
  const mapModeButtonAnimatedStyle = useAnimatedStyle(() => ({
    bottom: mapModeButtonBottom.value,
  }));
  const handleSheetPositionChange = (sheetTopY: number) => {
    // Mutar `.value` de un SharedValue es el patrón normal de Reanimated, pero el React
    // Compiler no lo reconoce y lo marca como si fuera un valor inmutable.
    // eslint-disable-next-line react-hooks/immutability
    mapModeButtonBottom.value = withTiming(windowHeight - sheetTopY + GAP_SOBRE_SHEET, { duration: 250 });
  };

  const { data: incidencias = [], isLoading, isError, refetch } = useIncidentsToday();
  const clusters = useMemo(() => clusterIncidents(incidencias), [incidencias]);
  const [clusterSeleccionado, setClusterSeleccionado] = useState<IncidentCluster | null>(null);

  const handleClusterPress = (cluster: IncidentCluster) => {
    useMapSearchStore.getState().flyTo({ lat: cluster.lat, lon: cluster.lon });
    if (cluster.count === 1) {
      router.push({ pathname: '/incidencia/[id]', params: { id: cluster.incidencias[0].id } });
      return;
    }
    // Varias Incidencias distintas cayeron en el mismo punto/radio de agrupación
    // (mismo suministro con más de un tipo de problema, por ejemplo — el dedup del
    // backend agrupa por suministro+tipo, así que son entidades genuinamente
    // separadas) — se elige cuál abrir desde la lista, ver ClusterListSheet.
    setClusterSeleccionado(cluster);
  };

  return (
    <View style={styles.flex}>
      <EpselMapView clusters={clusters} onPressCluster={handleClusterPress} />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Pressable style={styles.menuButton} onPress={() => openDrawer(navigation)}>
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>

        <View style={styles.searchBarSlot} pointerEvents="box-none">
          <LocationSearchBar />
        </View>

        <AnimatedPressable
          style={[styles.mapModeButton, mapModeButtonAnimatedStyle]}
          onPress={() => setMapModeVisible(true)}
        >
          <Text style={styles.mapModeIcon}>🗺️</Text>
        </AnimatedPressable>

        {mapMode !== 'normal' && (
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>
              {mapMode === 'calor' ? 'Mapa de calor' : 'Mapa de foco'}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {isLoading && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>Cargando incidencias de hoy…</Text>
        </View>
      )}
      {isError && (
        <Pressable style={[styles.statusBanner, styles.errorBanner]} onPress={() => refetch()}>
          <Text style={styles.statusText}>No se pudo cargar. Toca para reintentar.</Text>
        </Pressable>
      )}

      <MapModeSheet visible={mapModeVisible} onClose={() => setMapModeVisible(false)} />
      <MapBottomSheet ref={bottomSheetRef} onSheetPositionChange={handleSheetPositionChange} />

      <ClusterListSheet
        visible={!!clusterSeleccionado}
        incidencias={clusterSeleccionado?.incidencias ?? []}
        onSelect={(incidencia) => {
          setClusterSeleccionado(null);
          useMapSearchStore.getState().flyTo({ lat: incidencia.lat, lon: incidencia.lon });
          router.push({ pathname: '/incidencia/[id]', params: { id: incidencia.id } });
        }}
        onClose={() => setClusterSeleccionado(null)}
      />
    </View>
  );
}

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    flex: { flex: 1 },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    searchBarSlot: {
      position: 'absolute',
      top: 16,
      left: 72,
      right: 12,
    },
    menuButton: {
      position: 'absolute',
      top: 16,
      left: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
    },
    menuIcon: { color: t.white, fontSize: 20 },
    mapModeButton: {
      // `bottom` real lo controla mapModeButtonAnimatedStyle (sigue al Bottom Sheet).
      position: 'absolute',
      left: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
    },
    mapModeIcon: { fontSize: 20 },
    modeBadge: {
      position: 'absolute',
      top: 16,
      alignSelf: 'center',
      backgroundColor: t.primaryDark,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.pill,
    },
    modeBadgeText: { color: t.white, fontWeight: '700', fontSize: 12 },
    statusBanner: {
      position: 'absolute',
      top: 76,
      alignSelf: 'center',
      backgroundColor: t.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.pill,
      elevation: 4,
    },
    errorBanner: { backgroundColor: t.dangerBg },
    statusText: { fontSize: 12, fontWeight: '600', color: t.textBody },
  });
}
