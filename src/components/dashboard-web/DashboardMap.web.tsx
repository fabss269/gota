import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StyleSheet, View } from 'react-native';

import { useHeatmapSectores } from '@/hooks/useDashboardGeo';
import { useDashboardFilters } from '@/state/dashboardFilters';

import { IncidenciaPopup } from './IncidenciaPopup';
import { LayersPanel, type CapaCatastro } from './LayersPanel';
import { HALO_COLOR, registerPinIcons } from './pinIcons';

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

// Umbral de zoom para cambiar entre heatmap agregado y pines individuales.
// A bajo zoom (< 14) los pines se saturan; el heatmap muestra densidad clara.
const ZOOM_PINES = 14;

type PopupState = {
  codigo: string;
  container: HTMLDivElement;
  popup: maplibregl.Popup;
};

// Configuración de capas catastrales (id, tipo, paint props). Todas empiezan
// ocultas y se activan desde el panel lateral.
const CAPAS_CATASTRO: Record<CapaCatastro, {
  layer: maplibregl.LayerSpecification;
  before?: string;
}> = {
  agua: {
    layer: {
      id: 'catastro-agua', type: 'line', source: 'agua-catastro',
      'source-layer': 'agua',
      layout: { visibility: 'none' },
      paint: { 'line-color': '#1E40AF', 'line-width': 2, 'line-opacity': 0.7 },
    },
    before: 'sectores-fill',
  },
  alcantarillado: {
    layer: {
      id: 'catastro-alcantarillado', type: 'line', source: 'alcantarillado-catastro',
      'source-layer': 'alcantarillado',
      layout: { visibility: 'none' },
      paint: { 'line-color': '#166534', 'line-width': 2, 'line-opacity': 0.7 },
    },
    before: 'sectores-fill',
  },
  alcantarillado_flujo: {
    layer: {
      id: 'catastro-alcantarillado-flujo', type: 'line', source: 'alcantarillado_flujo-catastro',
      'source-layer': 'alcantarillado_flujo',
      layout: { visibility: 'none' },
      paint: {
        // Primaria = línea más gruesa/oscura; secundaria más clara
        'line-color': ['case', ['get', 'primaria'], '#064E3B', '#059669'],
        'line-width': ['case', ['get', 'primaria'], 2.5, 1.5],
        'line-opacity': 0.8,
      },
    },
    before: 'sectores-fill',
  },
  cajaagua: {
    layer: {
      id: 'catastro-cajaagua', type: 'circle', source: 'cajaagua-catastro',
      'source-layer': 'cajaagua',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1, 17, 4],
        'circle-color': '#3B82F6',
        'circle-opacity': 0.6,
      },
    },
    before: 'sectores-fill',
  },
  cajadesague: {
    layer: {
      id: 'catastro-cajadesague', type: 'circle', source: 'cajadesague-catastro',
      'source-layer': 'cajadesague',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1, 17, 4],
        'circle-color': '#22C55E',
        'circle-opacity': 0.6,
      },
    },
    before: 'sectores-fill',
  },
  cajaaguaconexion: {
    layer: {
      id: 'catastro-cajaaguaconexion', type: 'line', source: 'cajaaguaconexion-catastro',
      'source-layer': 'cajaaguaconexion',
      layout: { visibility: 'none' },
      paint: { 'line-color': '#60A5FA', 'line-width': 0.6, 'line-opacity': 0.6 },
    },
    before: 'sectores-fill',
  },
  cajadesagueconexion: {
    layer: {
      id: 'catastro-cajadesagueconexion', type: 'line', source: 'cajadesagueconexion-catastro',
      'source-layer': 'cajadesagueconexion',
      layout: { visibility: 'none' },
      paint: { 'line-color': '#4ADE80', 'line-width': 0.6, 'line-opacity': 0.6 },
    },
    before: 'sectores-fill',
  },
  accesorios: {
    layer: {
      id: 'catastro-accesorios', type: 'circle', source: 'accesorios-catastro',
      'source-layer': 'accesorios',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2, 17, 6],
        'circle-color': '#EAB308',
        'circle-stroke-color': '#78350F',
        'circle-stroke-width': 1,
        'circle-opacity': 0.85,
      },
    },
    before: 'sectores-fill',
  },
  lotes: {
    layer: {
      id: 'catastro-lotes', type: 'line', source: 'lotes-catastro',
      'source-layer': 'lotes',
      layout: { visibility: 'none' },
      paint: { 'line-color': '#8B5CF6', 'line-width': 0.5, 'line-opacity': 0.5 },
    },
    before: 'sectores-fill',
  },
  manzanas: {
    layer: {
      id: 'catastro-manzanas', type: 'line', source: 'manzanas-catastro',
      'source-layer': 'manzanas',
      layout: { visibility: 'none' },
      paint: { 'line-color': '#EC4899', 'line-width': 1, 'line-opacity': 0.6 },
    },
    before: 'sectores-fill',
  },
};

const CAPA_A_SOURCE: Record<CapaCatastro, string> = {
  agua: 'agua', alcantarillado: 'alcantarillado',
  alcantarillado_flujo: 'alcantarillado_flujo',
  cajaagua: 'cajaagua', cajadesague: 'cajadesague',
  cajaaguaconexion: 'cajaaguaconexion', cajadesagueconexion: 'cajadesagueconexion',
  accesorios: 'accesorios', lotes: 'lotes', manzanas: 'manzanas',
};

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

export function DashboardMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pulseRafRef = useRef<number | null>(null);
  const [popupState, setPopupState] = useState<PopupState | null>(null);
  const popupStateRef = useRef<PopupState | null>(null);
  useEffect(() => { popupStateRef.current = popupState; }, [popupState]);

  const [capasActivas, setCapasActivas] = useState<Record<CapaCatastro, boolean>>({
    agua: false, alcantarillado: false, alcantarillado_flujo: false,
    cajaagua: false, cajadesague: false,
    cajaaguaconexion: false, cajadesagueconexion: false,
    accesorios: false, lotes: false, manzanas: false,
  });

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
    (window as any).__dashMap = map;

    const addSourceIfMissing = (id: string, source: maplibregl.SourceSpecification) => {
      if (!map.getSource(id)) map.addSource(id, source);
    };
    const addLayerIfMissing = (layer: maplibregl.LayerSpecification, before?: string) => {
      if (!map.getLayer(layer.id)) map.addLayer(layer, before);
    };

    map.on('load', () => {
      registerPinIcons(map);

      // Sources principales
      addSourceIfMissing('sectores', {
        type: 'vector', tiles: [`${MARTIN_URL}/sectores/{z}/{x}/{y}`],
      });
      addSourceIfMissing('incidencias', {
        type: 'vector', tiles: [`${MARTIN_URL}/incidencias/{z}/{x}/{y}`],
      });

      // Sources catastro (una source por capa)
      Object.entries(CAPA_A_SOURCE).forEach(([capaId, martinId]) => {
        addSourceIfMissing(`${capaId}-catastro`, {
          type: 'vector', tiles: [`${MARTIN_URL}/${martinId}/{z}/{x}/{y}`],
        });
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

      // Capas catastrales (ocultas por default)
      Object.values(CAPAS_CATASTRO).forEach(({ layer, before }) => {
        addLayerIfMissing(layer, before);
      });

      // (no incidencias-heatmap gradiente — se usa el heatmap por SECTOR
      // vía sectores-fill que ya está más arriba y muestra contexto real:
      // polígonos con nombre de sector, no una mancha amorfa)

      // Halo pulsante rojo (SOLO a alto zoom, para no saturar la vista general)
      addLayerIfMissing({
        id: 'incidencias-halo',
        type: 'circle',
        source: 'incidencias',
        'source-layer': 'incidencias',
        minzoom: ZOOM_PINES,
        filter: ['==', ['get', 'es_resolucion_lenta'], true],
        paint: {
          'circle-radius': 14,
          'circle-color': HALO_COLOR,
          'circle-opacity': 0.25,
          'circle-stroke-color': HALO_COLOR,
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 0.7,
        },
      });

      // Pines (SOLO a alto zoom)
      addLayerIfMissing({
        id: 'incidencias-pins',
        type: 'symbol',
        source: 'incidencias',
        'source-layer': 'incidencias',
        minzoom: ZOOM_PINES,
        layout: {
          'icon-image': [
            'match', ['get', 'grupo'],
            'agua', 'pin-agua',
            'desague', 'pin-desague',
            'pin-agua',
          ],
          'icon-size': 1.5,
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'text-field': ['to-string', ['get', 'n_reclamos']],
          'text-font': ['Open Sans Bold'],
          'text-size': 13,
          'text-offset': [0, -1.85],
          'text-anchor': 'center',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': '#111' },
      });

      map.on('mouseenter', 'incidencias-pins', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'incidencias-pins', () => {
        map.getCanvas().style.cursor = '';
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

      // Click en pin → popup
      map.on('click', 'incidencias-pins', (e) => {
        const f = e.features?.[0];
        if (!f?.properties) return;
        const codigo = f.properties.codigo as string;
        if (!codigo) return;
        popupStateRef.current?.popup.remove();
        const container = document.createElement('div');
        const popup = new maplibregl.Popup({
          closeButton: false, closeOnClick: false,
          maxWidth: '380px', offset: [0, -35],
        }).setLngLat(e.lngLat).setDOMContent(container).addTo(map);
        popup.on('close', () => setPopupState(null));
        setPopupState({ codigo, container, popup });
        map.easeTo({ center: e.lngLat, offset: [0, 180], duration: 400 });
      });

      // Click en sector → filtro drill-down
      map.on('click', 'sectores-fill', (e) => {
        const pinFeatures = map.queryRenderedFeatures(e.point, {
          layers: ['incidencias-pins'],
        });
        if (pinFeatures.length > 0) return;
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

      // Animación del halo pulsante
      const start = performance.now();
      const tick = () => {
        if (!mapRef.current || !mapRef.current.getLayer('incidencias-halo')) return;
        const t = (performance.now() - start) / 1000;
        const pulse = (Math.sin(t * 2.4) + 1) / 2;
        mapRef.current.setPaintProperty('incidencias-halo', 'circle-radius', 10 + pulse * 8);
        mapRef.current.setPaintProperty('incidencias-halo', 'circle-opacity', 0.12 + pulse * 0.28);
        mapRef.current.setPaintProperty('incidencias-halo', 'circle-stroke-opacity', 0.4 + pulse * 0.4);
        pulseRafRef.current = requestAnimationFrame(tick);
      };
      tick();

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
      if (pulseRafRef.current !== null) cancelAnimationFrame(pulseRafRef.current);
      popupStateRef.current?.popup.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ============ Filtros grupo / sector ============
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const conds: any[] = ['all'];
    if (grupo !== 'todos') conds.push(['==', ['get', 'grupo'], grupo]);
    if (sectorid != null) conds.push(['==', ['get', 'sectorid'], sectorid]);
    const pinFilter = conds.length === 1 ? null : conds;
    if (map.getLayer('incidencias-pins')) map.setFilter('incidencias-pins', pinFilter);

    const haloFilter: any[] = ['all', ['==', ['get', 'es_resolucion_lenta'], true]];
    if (grupo !== 'todos') haloFilter.push(['==', ['get', 'grupo'], grupo]);
    if (sectorid != null) haloFilter.push(['==', ['get', 'sectorid'], sectorid]);
    if (map.getLayer('incidencias-halo')) map.setFilter('incidencias-halo', haloFilter);

    if (map.getLayer('sectores-line-highlight')) {
      map.setFilter('sectores-line-highlight',
        sectorid != null
          ? ['==', ['get', 'sectorid'], sectorid]
          : ['==', ['get', 'sectorid'], -1]);
    }
  }, [grupo, sectorid]);

  // ============ Toggle de capas catastrales ============
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    (Object.entries(capasActivas) as [CapaCatastro, boolean][]).forEach(([capa, activa]) => {
      const layerId = CAPAS_CATASTRO[capa].layer.id;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', activa ? 'visible' : 'none');
      }
    });
  }, [capasActivas]);

  const toggleCapa = (c: CapaCatastro) =>
    setCapasActivas((prev) => ({ ...prev, [c]: !prev[c] }));

  return (
    <View style={styles.wrapper}>
      <div ref={containerRef} style={styles.mapContainer as any} />
      <LayersPanel activas={capasActivas} onToggle={toggleCapa} />
      {popupState &&
        createPortal(
          <IncidenciaPopup
            codigo={popupState.codigo}
            onClose={() => popupState.popup.remove()}
          />,
          popupState.container,
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, minHeight: 400, position: 'relative' },
  mapContainer: { width: '100%', height: '100%', position: 'absolute', inset: 0 },
});
