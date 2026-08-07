import type { CSSProperties } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { useNavigation, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailPanel } from '@/components/incident-detail/DetailPanel';
import { CatastroFloatingPanel } from '@/components/map/CatastroFloatingPanel';
import { ClusterListSheet } from '@/components/map/ClusterListSheet';
import { ElementoInfoPanel } from '@/components/map/ElementoInfoPanel.web';
import { FiltersSidebar } from '@/components/map/FiltersSidebar';
import { LocationSearchBar } from '@/components/map/LocationSearchBar';
import type { ElementoRedTipo } from '@/components/map/mapLayers';
import { MapThemeVars } from '@/components/map/MapThemeVars.web';
import { EpselMapView } from '@/components/map/MapView';
import { MapModeSheet } from '@/components/map/MapModeSheet';
import { MapBottomSheet } from '@/components/sheet/MapBottomSheet';
import { Radius, type ColorPalette } from '@/constants/theme';
import { useIncidentsToday } from '@/hooks/useIncidentsToday';
import type { Incidencia } from '@/mocks/incidentsMock';
import { openDrawer } from '@/navigation/openDrawer';
import { useFiltersStore } from '@/state/filtersStore';
import { useMapSearchStore } from '@/state/mapSearchStore';
import { useSimulacionStore } from '@/state/simulacionStore';
import { useThemeColors } from '@/state/themeStore';
import { clusterIncidents, type IncidentCluster } from '@/utils/clusterIncidents';

const DESKTOP_BP = 768;

/**
 * Pantalla Mapa — variante web.
 * - ≥768px: layout de 3 columnas (sidebar filtros | mapa | panel detalle)
 * - <768px:  mismo layout móvil que index.tsx (bottom sheet, drawer, etc.)
 */
export default function MapaScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const isDesktop = width >= DESKTOP_BP;

  const { data: incidencias = [], isLoading, isError, refetch } = useIncidentsToday();
  const clusters = useMemo(() => clusterIncidents(incidencias), [incidencias]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [elementoSeleccionado, setElementoSeleccionado] = useState<{ tipo: ElementoRedTipo; id: number } | null>(
    null
  );
  const [clusterSeleccionado, setClusterSeleccionado] = useState<IncidentCluster | null>(null);
  const modoVista = useSimulacionStore((s) => s.modoVista);

  const abrirDetalle = (id: string) => {
    setElementoSeleccionado(null);
    if (isDesktop) {
      setSelectedId(id);
    } else {
      router.push({ pathname: '/incidencia/[id]', params: { id } });
    }
  };

  const handleElementClick = (tipo: ElementoRedTipo, id: number) => {
    setSelectedId(null);
    setElementoSeleccionado({ tipo, id });
  };

  const handleClusterPress = (cluster: IncidentCluster) => {
    useMapSearchStore.getState().flyTo({ lat: cluster.lat, lon: cluster.lon });
    if (cluster.count === 1) {
      abrirDetalle(cluster.incidencias[0].id);
      return;
    }
    // Varias Incidencias distintas cayeron en el mismo punto/radio de agrupación
    // (mismo suministro con más de un tipo de problema, por ejemplo — el dedup del
    // backend agrupa por suministro+tipo, así que son entidades genuinamente
    // separadas) — se elige cuál abrir desde la lista, ver ClusterListSheet.
    setClusterSeleccionado(cluster);
  };

  const handleSelectFromCluster = (incidencia: Incidencia) => {
    setClusterSeleccionado(null);
    useMapSearchStore.getState().flyTo({ lat: incidencia.lat, lon: incidencia.lon });
    abrirDetalle(incidencia.id);
  };

  if (!isDesktop) {
    return (
      <MobileLayout
        clusters={clusters}
        onPressCluster={handleClusterPress}
        isLoading={isLoading}
        isError={isError}
        onRefetch={refetch}
        clusterSeleccionado={clusterSeleccionado}
        onSelectFromCluster={handleSelectFromCluster}
        onCloseCluster={() => setClusterSeleccionado(null)}
      />
    );
  }

  return (
    <div style={desktopRoot}>
      <MapThemeVars />

      {/* Columna izquierda: filtros + capas — oculta en modo vista (bloqueo total,
          "no interactuar con nada" salvo el ← de SimulacionControl). */}
      {!modoVista && <FiltersSidebar />}

      {/* Columna central: mapa */}
      <div style={centerCol}>
        <EpselMapView
          clusters={clusters}
          onPressCluster={handleClusterPress}
          onElementClick={handleElementClick}
        />

        {/* Buscador de dirección / suministro */}
        {!modoVista && <LocationSearchBar />}

        {/* Capas de catastro (Predio/Alcantarillado/Agua) — panel flotante inferior */}
        {!modoVista && <CatastroFloatingPanel />}

        {/* Banners de estado */}
        {!modoVista && isLoading && <div style={banner}>Cargando incidencias de hoy…</div>}
        {!modoVista && isError && (
          <div
            style={{ ...banner, backgroundColor: 'var(--map-danger-bg)', color: 'var(--map-danger-text)', cursor: 'pointer' }}
            onClick={() => refetch()}
          >
            No se pudo cargar. Clic para reintentar.
          </div>
        )}
      </div>

      {/* Columna derecha: panel de detalle de incidencia o de elemento de catastro —
          mutuamente excluyentes (abrirDetalle/handleElementClick limpian el otro). */}
      {!modoVista && selectedId && (
        <DetailPanel incidenciaId={selectedId} onClose={() => setSelectedId(null)} />
      )}
      {!modoVista && elementoSeleccionado && (
        <ElementoInfoPanel
          tipo={elementoSeleccionado.tipo}
          id={elementoSeleccionado.id}
          onClose={() => setElementoSeleccionado(null)}
        />
      )}

      <ClusterListSheet
        visible={!!clusterSeleccionado}
        incidencias={clusterSeleccionado?.incidencias ?? []}
        onSelect={handleSelectFromCluster}
        onClose={() => setClusterSeleccionado(null)}
      />
    </div>
  );
}

// ── Layout móvil (replicado de index.tsx) ────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function MobileLayout({
  clusters,
  onPressCluster,
  isLoading,
  isError,
  onRefetch,
  clusterSeleccionado,
  onSelectFromCluster,
  onCloseCluster,
}: {
  clusters: IncidentCluster[];
  onPressCluster: (cluster: IncidentCluster) => void;
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  clusterSeleccionado: IncidentCluster | null;
  onSelectFromCluster: (incidencia: Incidencia) => void;
  onCloseCluster: () => void;
}) {
  const t = useThemeColors();
  const mobile = useMemo(() => makeMobileStyles(t), [t]);
  const navigation = useNavigation();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [mapModeVisible, setMapModeVisible] = useState(false);
  const mapMode = useFiltersStore((s) => s.mapMode);
  const modoVista = useSimulacionStore((s) => s.modoVista);

  const { height: windowHeight } = useWindowDimensions();
  const GAP = 16;
  const SNAP_COLAPSADO = 0.14;
  const mapModeBottom = useSharedValue(windowHeight * SNAP_COLAPSADO + GAP);
  const mapModeStyle = useAnimatedStyle(() => ({ bottom: mapModeBottom.value }));

  const onSheetPositionChange = (sheetTopY: number) => {
    // eslint-disable-next-line react-hooks/immutability
    mapModeBottom.value = withTiming(windowHeight - sheetTopY + GAP, { duration: 250 });
  };

  return (
    <View style={mobile.flex}>
      <EpselMapView clusters={clusters} onPressCluster={onPressCluster} />

      {!modoVista && (
        <SafeAreaView style={mobile.overlay} pointerEvents="box-none">
          <Pressable style={mobile.menuBtn} onPress={() => openDrawer(navigation)}>
            <Text style={mobile.menuIcon}>☰</Text>
          </Pressable>

          <AnimatedPressable
            style={[mobile.mapModeBtn, mapModeStyle]}
            onPress={() => setMapModeVisible(true)}
          >
            <Text style={mobile.mapModeIcon}>🗺️</Text>
          </AnimatedPressable>

          {mapMode !== 'normal' && (
            <View style={mobile.modeBadge}>
              <Text style={mobile.modeBadgeText}>
                {mapMode === 'calor' ? 'Mapa de calor' : 'Mapa de foco'}
              </Text>
            </View>
          )}
        </SafeAreaView>
      )}

      {!modoVista && isLoading && (
        <View style={mobile.statusBanner}>
          <Text style={mobile.statusText}>Cargando incidencias de hoy…</Text>
        </View>
      )}
      {!modoVista && isError && (
        <Pressable style={[mobile.statusBanner, mobile.errorBanner]} onPress={onRefetch}>
          <Text style={mobile.statusText}>No se pudo cargar. Toca para reintentar.</Text>
        </Pressable>
      )}

      {!modoVista && <MapModeSheet visible={mapModeVisible} onClose={() => setMapModeVisible(false)} />}
      {!modoVista && <MapBottomSheet ref={bottomSheetRef} onSheetPositionChange={onSheetPositionChange} />}

      <ClusterListSheet
        visible={!!clusterSeleccionado}
        incidencias={clusterSeleccionado?.incidencias ?? []}
        onSelect={onSelectFromCluster}
        onClose={onCloseCluster}
      />
    </View>
  );
}

// ── Estilos desktop (CSS) ─────────────────────────────────────────────

const desktopRoot: CSSProperties = {
  display: 'flex',
  height: '100vh',
  overflow: 'hidden',
  backgroundColor: 'var(--map-bg)',
};

const centerCol: CSSProperties = {
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
};

const banner: CSSProperties = {
  position: 'absolute',
  top: 52,
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: 'var(--map-surface)',
  padding: '6px 14px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: '600',
  color: 'var(--map-text)',
  boxShadow: '0 1px 4px var(--map-shadow)',
  zIndex: 10,
  whiteSpace: 'nowrap',
};

// ── Estilos móvil (RN StyleSheet) ────────────────────────────────────

function makeMobileStyles(t: ColorPalette) {
  return StyleSheet.create({
    flex: { flex: 1 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    menuBtn: {
      position: 'absolute', top: 16, left: 16,
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: t.primaryDark,
      alignItems: 'center', justifyContent: 'center', elevation: 4,
    },
    menuIcon: { color: t.white, fontSize: 20 },
    mapModeBtn: {
      position: 'absolute', left: 16,
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: t.surface,
      alignItems: 'center', justifyContent: 'center', elevation: 4,
    },
    mapModeIcon: { fontSize: 20 },
    modeBadge: {
      position: 'absolute', top: 16, alignSelf: 'center',
      backgroundColor: t.primaryDark,
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: Radius.pill,
    },
    modeBadgeText: { color: t.white, fontWeight: '700', fontSize: 12 },
    statusBanner: {
      position: 'absolute', top: 76, alignSelf: 'center',
      backgroundColor: t.surface,
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: Radius.pill, elevation: 4,
    },
    errorBanner: { backgroundColor: t.dangerBg },
    statusText: { fontSize: 12, fontWeight: '600', color: t.textBody },
  });
}
