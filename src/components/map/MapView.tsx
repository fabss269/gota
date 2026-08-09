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
  unionBbox,
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
  sectores: { id: string }[],
  sectoresActivos: Set<string>
): StyleJson {
  const idsActivos = [...sectoresActivos].map(Number);
  const resaltarActivo = capasVisibles.has('resaltar_sector');
  const idsResaltado = resaltarActivo ? idsActivos : [];

  const colorMatch: unknown[] = ['match', ['get', 'sectorid']];
  for (const sector of sectores) {
    colorMatch.push(Number(sector.id), colorForSectorId(sector.id));
  }
  colorMatch.push('#9E9E9E');

  const catastroFilterById = new Map(CATASTRO_SECTOR_FILTER_LAYERS.map((l) => [l.id, l.baseFilter]));
  const sectorFilter = ['in', ['get', 'sectorid'], ['literal', idsActivos]];
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
        idsActivos.length === 0
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
  const sectoresActivos = useUbicacionStore((state) => state.sectoresActivos);

  const effectiveStyle = useMemo(() => {
    if (!baseStyle) return null;
    return buildEffectiveStyle(baseStyle, capasVisibles, sectores, sectoresActivos);
  }, [baseStyle, capasVisibles, sectores, sectoresActivos]);

  const center: [number, number] =
    clusters.length > 0 ? [clusters[0].lon, clusters[0].lat] : DEFAULT_CENTER;

  // Auto-encuadre de cámara por el nivel más específico con algo activo en UBICACIÓN
  // (sector > distrito > provincia) — mismo criterio que MapView.web.tsx.
  const provincias = useUbicacionStore((state) => state.provincias);
  const distritos = useUbicacionStore((state) => state.distritos);
  const provinciasActivas = useUbicacionStore((state) => state.provinciasActivas);
  const distritosActivos = useUbicacionStore((state) => state.distritosActivos);
  const lastBoundsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const state = useUbicacionStore.getState();
    let activos: { id: string; bbox: ApiBbox }[];
    let nivel: string;

    if (state.sectoresActivos.size > 0) {
      activos = state.sectores.filter((s) => state.sectoresActivos.has(s.id));
      nivel = 'sector';
    } else if (state.distritosActivos.size > 0) {
      activos = state.distritos.filter((d) => state.distritosActivos.has(d.id));
      nivel = 'distrito';
    } else if (state.provinciasActivas.size > 0) {
      activos = state.provincias.filter((p) => state.provinciasActivas.has(p.id));
      nivel = 'provincia';
    } else {
      return;
    }

    activos = activos.filter((a) => a.bbox);
    if (activos.length === 0) return;

    const key = `${nivel}:${activos.map((a) => a.id).sort().join(',')}`;
    if (key === lastBoundsKeyRef.current) return;
    lastBoundsKeyRef.current = key;

    const bbox = unionBbox(activos.map((a) => a.bbox));
    cameraRef.current?.fitBounds([bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat], {
      padding: { top: 48, left: 48, bottom: 48, right: 48 },
      duration: 800,
    });
  }, [provincias, distritos, sectores, provinciasActivas, distritosActivos, sectoresActivos]);

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
