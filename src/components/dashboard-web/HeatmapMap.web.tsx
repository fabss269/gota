import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePuntosHeatmap } from '@/hooks/useDashboardGeo';

// Basemap OSM raster — mismo default que el resto del dashboard. Para producción
// real conviene apuntar a un tile provider con SLA (MapTiler/Stadia), pero
// para dev/demo sirve.
const BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'basemap', type: 'raster', source: 'osm' }],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

const DEFAULT_CENTER: [number, number] = [-79.8409, -6.7714];

/** Rampa de color tipo pronóstico del clima — azul (frío/bajo) → celeste →
 * verde → amarillo → naranja → rojo (caliente/alto). Chart de MapLibre
 * `heatmap-color` recibe pares [stop, color] entre 0 y 1 sobre la densidad
 * normalizada de puntos por tile. */
const WEATHER_RAMP: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['heatmap-density'],
  0,    'rgba(33, 102, 172, 0)',
  0.15, 'rgba(103, 169, 207, 0.55)',
  0.35, 'rgba(122, 214, 122, 0.7)',
  0.55, 'rgba(255, 220, 0, 0.75)',
  0.75, 'rgba(255, 140, 0, 0.85)',
  0.9,  'rgba(220, 60, 30, 0.9)',
  1.0,  'rgba(178, 24, 43, 1)',
];

type Props = {
  /** Filtra a incidencias con `es_robo=true`. Usado por el tab Robo. */
  soloRobos?: boolean;
};

/** Heatmap continuo (tipo pronóstico) sobre incidencias o robos — reemplaza el
 * antiguo relleno por sector. Reusable: el mismo componente sirve el Resumen
 * (incidencias) y el tab Robo (con `soloRobos`), cambia solo la data que pide
 * al hook. */
export function HeatmapMap({ soloRobos = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const { data: puntos } = usePuntosHeatmap(soloRobos);

  // ============ Init del mapa (una sola vez) ============
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: 12,
      maxZoom: 18,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    const resizeObs = new ResizeObserver(() => {
      const m = mapRef.current;
      if (!m) return;
      m.resize();
    });
    resizeObs.observe(containerRef.current);

    // Fix conocido — el mapa a veces monta con dimensiones cero durante el
    // primer paint (layout async). Un par de resize/repaint después del load
    // lo destraba.
    map.on('load', () => {
      [0, 100, 300].forEach((d) => setTimeout(() => {
        const m = mapRef.current;
        if (!m) return;
        m.resize();
        m.triggerRepaint();
      }, d));
    });

    return () => {
      resizeObs.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ============ Cargar/actualizar puntos como capa heatmap ============
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !puntos) return;

    const aplicar = () => {
      if (!map.isStyleLoaded()) {
        map.once('idle', aplicar);
        return;
      }
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: puntos.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: { peso: p.peso },
        })),
      };

      const existingSource = map.getSource('heatmap-src') as maplibregl.GeoJSONSource | undefined;
      if (existingSource) {
        existingSource.setData(geojson);
      } else {
        map.addSource('heatmap-src', { type: 'geojson', data: geojson });
        map.addLayer({
          id: 'heatmap-layer',
          type: 'heatmap',
          source: 'heatmap-src',
          paint: {
            // Peso por punto — coordenadas agrupadas por el backend ya vienen
            // con `peso` (COUNT por lat/lon redondeado), lo respetamos para
            // que hotspots reales pesen más que un simple punto aislado.
            'heatmap-weight': [
              'interpolate', ['linear'], ['get', 'peso'],
              0, 0, 10, 1,
            ],
            'heatmap-intensity': [
              'interpolate', ['linear'], ['zoom'],
              10, 0.8, 15, 2.2,
            ],
            'heatmap-color': WEATHER_RAMP,
            'heatmap-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 12, 15, 30, 18, 50,
            ],
            'heatmap-opacity': [
              'interpolate', ['linear'], ['zoom'],
              10, 0.85, 18, 0.75,
            ],
          },
        });
      }
    };

    aplicar();
  }, [puntos]);

  return (
    <View style={styles.wrapper}>
      <div ref={containerRef} style={styles.mapContainer as any} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, minHeight: 400, position: 'relative' },
  mapContainer: { width: '100%', height: '100%', position: 'absolute', inset: 0 },
});
