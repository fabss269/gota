import {
  Camera,
  type CameraRef,
  Map as MapLibreMap,
  Marker,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ApiBbox } from '@/api/types';
import { IncidentMarker } from '@/components/map/IncidentMarker';
import {
  CAPA_LAYER_IDS,
  CATASTRO_SECTOR_FILTER_LAYERS,
  SECTOR_COLOR_LAYER_IDS,
  SECTOR_LAYER_IDS,
  colorForSectorId,
  sectorIdsEfectivos,
} from '@/components/map/mapLayers';
import { useCapasStore } from '@/state/capasStore';
import { useMapSearchStore } from '@/state/mapSearchStore';
import { useThemeStore } from '@/state/themeStore';
import { useUbicacionStore } from '@/state/ubicacionStore';
import type { IncidentCluster } from '@/utils/clusterIncidents';

// Chiclayo, Perú (Spec 03, RF-03.1 — centro por defecto si no hay incidencias).
const DEFAULT_CENTER: [number, number] = [-79.8409, -6.7714];

// Mismo estilo que la versión web (ver MapView.web.tsx) — sin API key, ver Spec 03 /
// specs/00-auditoria-diseno.md.
const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? 'https://demotiles.maplibre.org/style.json';

// Reverse-map de CAPA_LAYER_IDS: por cada layerId del style.json, a qué CapaKey
// pertenece — para togglear layout.visibility layer por layer.
const LAYER_ID_TO_CAPA = Object.fromEntries(
  Object.entries(CAPA_LAYER_IDS).flatMap(([capa, layerIds]) => layerIds.map((id) => [id, capa]))
);

type StyleLayer = {
  id: string;
  filter?: unknown;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
};
type StyleJson = { layers?: StyleLayer[]; [key: string]: unknown };

/**
 * A diferencia de maplibre-gl-js (web), @maplibre/maplibre-react-native no permite
 * mutar layers de un estilo ya cargado (`setLayoutProperty`/`setFilter`/
 * `setPaintProperty` no existen en su MapRef — solo `setSourceVisibility`, a nivel de
 * source completo). La única forma de controlar capas individuales acá es recalcular
 * el objeto de estilo completo y pasarlo por `mapStyle` — un toggle puede recargar el
 * estilo entero (posible parpadeo breve), simplificación aceptada por ahora.
 */
function buildEffectiveStyle(
  baseStyle: StyleJson,
  capasVisibles: Set<string>,
  sectores: { id: string; distritoId: string }[],
  distritos: { id: string; provinciaId: string }[],
  provinciaActiva: string | null,
  distritoActivo: string | null,
  sectorActivo: string | null,
  sectorPreview: string | null
): StyleJson {
  // Cascada sector→distrito→provincia (mismo bug/fix que la versión web — ver
  // sectorIdsEfectivos en mapLayers.ts): sin esto, con solo un distrito/provincia
  // activo (sin sector elegido) el catastro se mostraba sin acotar.
  const idsCascada = sectorIdsEfectivos({ sectores, distritos, provinciaActiva, distritoActivo, sectorActivo });
  const resaltarActivo = capasVisibles.has('resaltar_sector');
  const idsResaltadoCascada = resaltarActivo ? idsCascada : [];
  // El "ojito" (sectorPreview) se une SOLO al resaltado, nunca al filtro de
  // catastro (sectorFilter más abajo) — previsualizar un sector no debe cargar su
  // red completa sin que sea el filtro realmente activo.
  const idsResaltado = sectorPreview
    ? [...new Set([...idsResaltadoCascada, Number(sectorPreview)])]
    : idsResaltadoCascada;

  const colorMatch: unknown[] = ['match', ['get', 'sectorid']];
  for (const sector of sectores) {
    colorMatch.push(Number(sector.id), colorForSectorId(sector.id));
  }
  colorMatch.push('#9E9E9E');

  const catastroFilterById = new Map(CATASTRO_SECTOR_FILTER_LAYERS.map((l) => [l.id, l.baseFilter]));
  const sectorFilter = ['in', ['get', 'sectorid'], ['literal', idsCascada]];
  const resaltadoFilter = ['in', ['get', 'sectorid'], ['literal', idsResaltado]];
  const colorLayerProp = new Map(SECTOR_COLOR_LAYER_IDS);

  const layers = (baseStyle.layers ?? []).map((layer): StyleLayer => {
    const capaKey = LAYER_ID_TO_CAPA[layer.id];
    let next = layer;

    if (capaKey) {
      const visible = capasVisibles.has(capaKey);
      next = { ...next, layout: { ...next.layout, visibility: visible ? 'visible' : 'none' } };
    }

    if (SECTOR_LAYER_IDS.includes(layer.id)) {
      next = { ...next, filter: resaltadoFilter };
      const paintProp = colorLayerProp.get(layer.id);
      if (paintProp) {
        next = { ...next, paint: { ...next.paint, [paintProp]: colorMatch } };
      }
    } else if (catastroFilterById.has(layer.id)) {
      const baseFilter = catastroFilterById.get(layer.id);
      const filter =
        idsCascada.length === 0
          ? (baseFilter ?? null)
          : baseFilter
            ? ['all', baseFilter, sectorFilter]
            : sectorFilter;
      next = { ...next, filter };
    }

    return next;
  });

  return { ...baseStyle, layers };
}

type Props = {
  clusters: IncidentCluster[];
  onPressCluster: (cluster: IncidentCluster) => void;
  // No implementado en nativo (como el resto de modo simulación, ver MapView.web.tsx)
  // — solo para que el tipo de Props coincida con la variante web, que sí lo usa.
  onElementClick?: (tipo: import('@/components/map/mapLayers').ElementoRedTipo, id: number) => void;
};

export function EpselMapView({ clusters, onPressCluster }: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const [baseStyle, setBaseStyle] = useState<StyleJson | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(MAP_STYLE_URL)
      .then((res) => res.json())
      .then((json: StyleJson) => {
        if (!cancelado) setBaseStyle(json);
      })
      .catch(() => {
        // Se degrada a pasar MAP_STYLE_URL directo como string (ver mapStyle más
        // abajo) — el mapa sigue funcionando, solo sin las capas de catastro/sectores.
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const capasVisibles = useCapasStore((state) => state.capasVisibles);
  const sectores = useUbicacionStore((state) => state.sectores);
  const distritos = useUbicacionStore((state) => state.distritos);
  const provinciaActiva = useUbicacionStore((state) => state.provinciaActiva);
  const distritoActivo = useUbicacionStore((state) => state.distritoActivo);
  const sectorActivo = useUbicacionStore((state) => state.sectorActivo);
  const sectorPreview = useUbicacionStore((state) => state.sectorPreview);

  const effectiveStyle = useMemo(() => {
    if (!baseStyle) return null;
    return buildEffectiveStyle(
      baseStyle,
      capasVisibles,
      sectores,
      distritos,
      provinciaActiva,
      distritoActivo,
      sectorActivo,
      sectorPreview
    );
  }, [baseStyle, capasVisibles, sectores, distritos, provinciaActiva, distritoActivo, sectorActivo, sectorPreview]);

  const center: [number, number] =
    clusters.length > 0 ? [clusters[0].lon, clusters[0].lat] : DEFAULT_CENTER;

  // Auto-encuadre de cámara por el nivel más específico con algo activo en UBICACIÓN
  // (sector > distrito > provincia) — mismo criterio que MapView.web.tsx. Selección
  // única en cada nivel (rediseño 2026-08-11), ya no hace falta unionBbox.
  const provincias = useUbicacionStore((state) => state.provincias);
  const lastBoundsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const state = useUbicacionStore.getState();
    let activo: { id: string; bbox: ApiBbox } | undefined;
    let nivel: string;

    if (state.sectorActivo) {
      activo = state.sectores.find((s) => s.id === state.sectorActivo);
      nivel = 'sector';
    } else if (state.distritoActivo) {
      activo = state.distritos.find((d) => d.id === state.distritoActivo);
      nivel = 'distrito';
    } else if (state.provinciaActiva) {
      activo = state.provincias.find((p) => p.id === state.provinciaActiva);
      nivel = 'provincia';
    } else {
      return;
    }

    if (!activo?.bbox) return;

    const key = `${nivel}:${activo.id}`;
    if (key === lastBoundsKeyRef.current) return;
    lastBoundsKeyRef.current = key;

    const bbox = activo.bbox;
    cameraRef.current?.fitBounds([bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat], {
      padding: { top: 48, left: 48, bottom: 48, right: 48 },
      duration: 800,
    });
  }, [provincias, distritos, sectores, provinciaActiva, distritoActivo, sectorActivo]);

  // Buscador (dirección/suministro) — mismo store que la versión web.
  const flyTarget = useMapSearchStore((state) => state.flyTarget);
  useEffect(() => {
    if (!flyTarget) return;
    cameraRef.current?.flyTo({ center: [flyTarget.lon, flyTarget.lat], zoom: flyTarget.zoom, duration: 1000 });
  }, [flyTarget]);

  // Sin variante oscura del basemap demo y sin filtro CSS disponible en nativo (a
  // diferencia de MapView.web.tsx, que sí puede invertir el canvas) — un scrim
  // semitransparente es el mejor esfuerzo razonable acá; no toca los marcadores
  // porque se dibuja encima de todo el mapa, no como parte de su estilo.
  const isDark = useThemeStore((state) => state.mode === 'dark');

  return (
    <View style={styles.map}>
      <MapLibreMap
        style={styles.map}
        mapStyle={(effectiveStyle as StyleSpecification | null) ?? MAP_STYLE_URL}
        logo={false}
        attribution={false}
      >
        <Camera ref={cameraRef} initialViewState={{ center, zoom: 13 }} />
        {clusters.map((cluster) => (
          <Marker
            key={cluster.id}
            lngLat={[cluster.lon, cluster.lat]}
            anchor="bottom"
            onPress={() => onPressCluster(cluster)}
          >
            <IncidentMarker cluster={cluster} />
          </Marker>
        ))}
      </MapLibreMap>
      {isDark && <View style={styles.darkScrim} pointerEvents="none" />}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  darkScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0B1220',
    opacity: 0.55,
  },
});
