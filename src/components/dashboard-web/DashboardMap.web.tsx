import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useHeatmapSectores } from '@/hooks/useDashboardGeo';
import { useDashboardFilters } from '@/state/dashboardFilters';

// Basemap OSM (raster). Suficiente para dev/demo.
const BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,   // OSM no sirve tiles más allá de z=19
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'basemap', type: 'raster', source: 'osm' }],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

// Fallback real (túnel), no localhost — bug encontrado 2026-08-07: un fallback a
// 'localhost:3000' solo resuelve para quien navega desde la MISMA máquina que
// corre Martin, así que cualquier otra PC veía "Failed to fetch" al entrar al
// dashboard (EXPO_PUBLIC_MARTIN_URL nunca estaba seteada). Mismo criterio que
// EXPO_PUBLIC_API_BASE_URL en api/client.ts, que ya usa un dominio real como
// default, no localhost.
const MARTIN_URL = process.env.EXPO_PUBLIC_MARTIN_URL ?? 'https://tiles-gota.kasqan.com';
const DEFAULT_CENTER: [number, number] = [-79.8409, -6.7714];

function colorPorDensidad(n: number, maxN: number): string {
  if (n === 0) return 'rgba(200, 200, 200, 0.1)';
  const ratio = maxN > 0 ? Math.min(n / maxN, 1) : 0;
  // Gradiente vibrante: verde (baja) → amarillo → naranja → rojo (alta)
  // hue: 130 (verde) → 0 (rojo). Saturación y luminosidad calibrados para
  // que se distingan claramente sobre el basemap OSM.
  const hue = 130 - 130 * ratio;
  const sat = 90;
  const light = 50 - 5 * ratio;   // 50% → 45% (siempre saturado, no pastel)
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

/** Mapa de calor por sector — tab Resumen. Sin pines de incidencias ni capas de
 * catastro: esas se editan desde el mapa operativo, aquí solo interesa la
 * densidad agregada por sector (y el drill-down de click → filtrar sector). */
export function DashboardMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const { grupo, sectorid, seleccionarSector } = useDashboardFilters();
  const { data: heatmap } = useHeatmapSectores();

  const heatmapRef = useRef(heatmap);
  const seleccionarRef = useRef(seleccionarSector);
  useEffect(() => { heatmapRef.current = heatmap; }, [heatmap]);
  useEffect(() => { seleccionarRef.current = seleccionarSector; }, [seleccionarSector]);

  // ============ Init del mapa (una sola vez) ============
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: 12,
      maxZoom: 18,   // límite para no sobrepasar el maxzoom de OSM (19)
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    const addSourceIfMissing = (id: string, source: maplibregl.SourceSpecification) => {
      if (!map.getSource(id)) map.addSource(id, source);
    };
    const addLayerIfMissing = (layer: maplibregl.LayerSpecification, before?: string) => {
      if (!map.getLayer(layer.id)) map.addLayer(layer, before);
    };

    map.on('load', () => {
      addSourceIfMissing('sectores', {
        type: 'vector', tiles: [`${MARTIN_URL}/sectores/{z}/{x}/{y}`],
      });

      // Polígonos de sectores
      addLayerIfMissing({
        id: 'sectores-fill', type: 'fill', source: 'sectores',
        'source-layer': 'sectores',
        paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.35 },
      });
      addLayerIfMissing({
        id: 'sectores-line', type: 'line', source: 'sectores',
        'source-layer': 'sectores',
        paint: { 'line-color': '#475569', 'line-width': 1, 'line-opacity': 0.55 },
      });
      addLayerIfMissing({
        id: 'sectores-line-highlight', type: 'line', source: 'sectores',
        'source-layer': 'sectores',
        filter: ['==', ['get', 'sectorid'], -1],
        paint: { 'line-color': '#0D2B52', 'line-width': 3 },
      });

      // Tooltip al hover en sector: nombre + # incidencias
      const sectorTooltip = new maplibregl.Popup({
        closeButton: false, closeOnClick: false, offset: 8,
        className: 'sector-tooltip',
      });
      map.on('mouseenter', 'sectores-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mousemove', 'sectores-fill', (e) => {
        const f = e.features?.[0];
        const sid = f?.properties?.sectorid;
        if (sid == null) return;
        const info = heatmapRef.current?.find((h) => h.sectorid === sid);
        const nombre = info?.sector ?? `Sector ${sid}`;
        const n = info?.n_incidencias ?? 0;
        const html = `
          <div style="font-family:system-ui;padding:6px 10px;">
            <div style="font-weight:700;font-size:12px;color:#0D2B52;">${nombre}</div>
            <div style="font-size:11px;color:#334155;margin-top:2px;">
              <strong>${n.toLocaleString('es-PE')}</strong> incidencia${n === 1 ? '' : 's'}
            </div>
          </div>`;
        sectorTooltip.setLngLat(e.lngLat).setHTML(html).addTo(map);
      });
      map.on('mouseleave', 'sectores-fill', () => {
        map.getCanvas().style.cursor = '';
        sectorTooltip.remove();
      });

      // Click en sector → filtro drill-down
      map.on('click', 'sectores-fill', (e) => {
        const f = e.features?.[0];
        if (!f?.properties) return;
        const sid = f.properties.sectorid as number;
        if (sid == null) return;
        const nombre = heatmapRef.current?.find((h) => h.sectorid === sid)?.sector
                    ?? `Sector ${sid}`;
        seleccionarRef.current(sid, nombre);
      });

      // Heatmap: expone una función global via ref que se puede llamar desde
      // el useEffect (cuando llega data) O desde eventos del mapa (idle/data).
      // Robusto ante cualquier orden de llegada.
      (map as any).__aplicarHeatmap = () => {
        const data = heatmapRef.current;
        if (!data || data.length === 0) return false;
        if (!map.getLayer('sectores-fill')) return false;
        try {
          const maxN = Math.max(...data.map((s) => s.n_incidencias), 1);
          const matchExpr: any[] = ['match', ['get', 'sectorid']];
          data.forEach((s) => {
            matchExpr.push(s.sectorid, colorPorDensidad(s.n_incidencias, maxN));
          });
          matchExpr.push('rgba(200,200,200,0.1)');
          map.setPaintProperty('sectores-fill', 'fill-color', matchExpr as any);
          map.setPaintProperty('sectores-fill', 'fill-opacity', 0.7);
          return true;
        } catch {
          return false;
        }
      };
      // Intentar aplicar tanto ahora como cuando el mapa esté idle.
      (map as any).__aplicarHeatmap();
      map.on('idle', () => (map as any).__aplicarHeatmap?.());

      // Fix del layout async
      [0, 100, 300].forEach((delay) => {
        setTimeout(() => {
          if (!mapRef.current) return;
          const m = mapRef.current;
          m.resize();
          m.jumpTo({ center: m.getCenter(), zoom: m.getZoom() });
          m.triggerRepaint();
        }, delay);
      });
    });

    const resizeObs = new ResizeObserver(() => {
      const m = mapRef.current;
      if (!m) return;
      m.resize();
      m.jumpTo({ center: m.getCenter(), zoom: m.getZoom() });
    });
    resizeObs.observe(containerRef.current);

    return () => {
      resizeObs.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ============ Heatmap por sector — trigger apply cuando llega data ============
  useEffect(() => {
    if (!heatmap || heatmap.length === 0) return;
    // Intentar unas cuantas veces (map puede aún no estar listo).
    const intentos = [0, 100, 400, 1000, 2000];
    const timers = intentos.map((delay) =>
      setTimeout(() => (mapRef.current as any)?.__aplicarHeatmap?.(), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [heatmap]);

  // ============ Highlight de sector seleccionado ============
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer('sectores-line-highlight')) {
      map.setFilter('sectores-line-highlight',
        sectorid != null
          ? ['==', ['get', 'sectorid'], sectorid]
          : ['==', ['get', 'sectorid'], -1]);
    }
    // El grupo (agua/desague) no filtra el heatmap por sector, que es agregado —
    // se deja como referencia visual del filtro activo, sin efecto en el mapa.
  }, [grupo, sectorid]);

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
