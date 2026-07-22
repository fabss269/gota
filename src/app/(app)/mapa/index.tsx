import BottomSheet from '@gorhom/bottom-sheet';
import { useNavigation, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EpselMapView } from '@/components/map/MapView';
import { MapModeSheet } from '@/components/map/MapModeSheet';
import { MapBottomSheet } from '@/components/sheet/MapBottomSheet';
import { Colors, Radius } from '@/constants/theme';
import { useIncidentsToday } from '@/hooks/useIncidentsToday';
import { openDrawer } from '@/navigation/openDrawer';
import { useFiltersStore } from '@/state/filtersStore';
import { clusterIncidents, type IncidentCluster } from '@/utils/clusterIncidents';

/** Mapa de incidencias (Spec 03) — pantalla principal de la app. */
export default function MapaScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [mapModeVisible, setMapModeVisible] = useState(false);
  const mapMode = useFiltersStore((s) => s.mapMode);

  const { data: incidencias = [], isLoading, isError, refetch } = useIncidentsToday();
  const clusters = useMemo(() => clusterIncidents(incidencias), [incidencias]);

  const handleClusterPress = (cluster: IncidentCluster) => {
    if (cluster.count === 1) {
      router.push({ pathname: '/incidencia/[id]', params: { id: cluster.incidencias[0].id } });
      return;
    }
    // Clúster con más de una incidencia: no hay una UI de desambiguación diseñada
    // (Spec 03) para elegir cuál abrir, así que se mantiene el resumen en texto.
    Alert.alert(
      `${cluster.count} incidencias`,
      cluster.incidencias.map((i) => `• ${i.tipo} — ${i.direccion}`).join('\n'),
    );
  };

  return (
    <View style={styles.flex}>
      <EpselMapView clusters={clusters} onPressCluster={handleClusterPress} />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Pressable style={styles.menuButton} onPress={() => openDrawer(navigation)}>
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>

        <Pressable style={styles.mapModeButton} onPress={() => setMapModeVisible(true)}>
          <Text style={styles.mapModeIcon}>🗺️</Text>
        </Pressable>

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
      <MapBottomSheet ref={bottomSheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menuButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  menuIcon: { color: Colors.white, fontSize: 20 },
  mapModeButton: {
    position: 'absolute',
    bottom: 96,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  mapModeIcon: { fontSize: 20 },
  modeBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  modeBadgeText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  statusBanner: {
    position: 'absolute',
    top: 76,
    alignSelf: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    elevation: 4,
  },
  errorBanner: { backgroundColor: '#FDECEC' },
  statusText: { fontSize: 12, fontWeight: '600', color: Colors.textBody },
});
