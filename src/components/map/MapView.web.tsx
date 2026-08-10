import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { resolveAsset } from '@/utils/resolveAsset';

const RESERVORIO_ELEVADO_URI = resolveAsset(require('@/assets/images/icons/reservorio_elevado.webp'));
const RESERVORIO_APOYADO_URI = resolveAsset(require('@/assets/images/icons/reservorio_apoyado.webp'));

import type { ApiBbox, TipoFalla } from '@/api/types';
import { postSimulacion } from '@/api/grafo';
import { IncidentMarker } from '@/components/map/IncidentMarker';
import {
  CAPA_KEY_POR_LAYER_ID,
  CAPA_LAYER_IDS,
  CATASTRO_SECTOR_FILTER_LAYERS,
  ELEMENTO_INFO_LAYERS,
  HOVER_INTERACTIVE_LAYERS,
  SECTOR_COLOR_LAYER_IDS,
  SECTOR_LAYER_IDS,
  SIMULACION_AFECTADO_COLOR,
  SIMULACION_COLOR_ORIGINAL,
  SIMULACION_ISOLATE_LAYERS,
  SIMULACION_OCULTAR_EN_VISTA,
  colorForSectorId,
  unionBbox,
  type ElementoRedTipo,
} from '@/components/map/mapLayers';
import { SimulacionBorderOverlay } from '@/components/map/SimulacionBorderOverlay.web';
import { SimulacionControl } from '@/components/map/SimulacionControl.web';
import { type CapaKey, useCapasStore } from '@/state/capasStore';
import { useMapSearchStore } from '@/state/mapSearchStore';
import { useSimulacionStore } from '@/state/simulacionStore';
import { useThemeStore } from '@/state/themeStore';
import { useUbicacionStore } from '@/state/ubicacionStore';
import type { IncidentCluster } from '@/utils/clusterIncidents';

// Layers clickeables en modo simulación -> qué tipo de elemento/falla representan.
// "Cualquier item que tenga activo en filtros" (pedido del usuario 2026-08-03): esta
// lista es el universo posible, pero el click handler además filtra contra
// capasVisibles (ver más abajo) para que solo dispare si la capa del elemento está
// realmente prendida. atoro_tramo/fuga_tuberia/fuga_accesorio se infieren del layer
// clickeado; para buzones el usuario elige entre colapso_buzon/tapa_faltante en
// SimulacionControl (mismo layer, dos fallas posibles, no hay forma de inferirlo del
// click). caja_agua queda fuera a propósito (excluida explícitamente del modo
// simulación); caja_desague sí entra (dispara falla_conexion).
const SIMULACION_LAYER_IDS = [
  'agua-red',
  'alcantarillado-primaria',
  'alcantarillado-secundaria',
  'buzones-circle',
  'accesorios-circle',
  'cajadesague-circle',
];

type ElementoSimulacion = {
  tipoFalla: TipoFalla;
  elementoTipo: 'tramo' | 'tuberia' | 'buzon' | 'accesorio' | 'cajadesague';
  elementoId: number;
};

function elementoDeFeature(
  layerId: string,
  properties: Record<string, unknown> | undefined,
  tipoFallaBuzon: TipoFalla
): ElementoSimulacion | null {
  if (layerId === 'agua-red') {
    const id = properties?.aguaid;
    return typeof id === 'number' ? { tipoFalla: 'fuga_tuberia', elementoTipo: 'tuberia', elementoId: id } : null;
  }
  if (layerId === 'alcantarillado-primaria' || layerId === 'alcantarillado-secundaria') {
    const id = properties?.alcantarilladoid;
    return typeof id === 'number' ? { tipoFalla: 'atoro_tramo', elementoTipo: 'tramo', elementoId: id } : null;
  }
  if (layerId === 'buzones-circle') {
    const id = properties?.buzonid;
    return typeof id === 'number' ? { tipoFalla: tipoFallaBuzon, elementoTipo: 'buzon', elementoId: id } : null;
  }
  if (layerId === 'accesorios-circle') {
    const id = properties?.accesorioid;
    return typeof id === 'number' ? { tipoFalla: 'fuga_accesorio', elementoTipo: 'accesorio', elementoId: id } : null;
  }
  if (layerId === 'cajadesague-circle') {
    const id = properties?.cajadesagueid;
    return typeof id === 'number'
      ? { tipoFalla: 'falla_conexion', elementoTipo: 'cajadesague', elementoId: id }
      : null;
  }
  return null;
}

// Chiclayo, Perú (Spec 03, RF-03.1 — centro por defecto si no hay incidencias).
const DEFAULT_CENTER: [number, number] = [-79.8409, -6.7714];

// Mismo estilo demo público que la versión nativa (ver MapView.tsx).
const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? 'https://demotiles.maplibre.org/style.json';

// Cursor de "esto va a fallar" durante la fase de elegir elemento en modo simulación
// (sim.activo && !sim.modoVista) — SVG armado a mano (no un emoji), círculo rojo con
// una X blanca, mismo rojo que SIMULACION_AFECTADO_COLOR.
const CURSOR_FALLA_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><circle cx='14' cy='14' r='12' fill='${SIMULACION_AFECTADO_COLOR}' stroke='white' stroke-width='2'/><path d='M9 9L19 19M19 9L9 19' stroke='white' stroke-width='2.5' stroke-linecap='round'/></svg>`;
const CURSOR_FALLA = `url("data:image/svg+xml,${encodeURIComponent(CURSOR_FALLA_SVG)}") 14 14, not-allowed`;

type Props = {
  clusters: IncidentCluster[];
  onPressCluster: (cluster: IncidentCluster) => void;
  onElementClick?: (tipo: ElementoRedTipo, id: number) => void;
};

type MarkerEntry = {
  marker: maplibregl.Marker;
  root: Root;
  clusterRef: { current: IncidentCluster };
};

// Desmontar un root de react-dom sincrónicamente desde el cleanup de un efecto puede
// coincidir con que el árbol padre (este mismo componente) también se esté desmontando,
// lo que dispara "Attempted to synchronously unmount a root while React was already
// rendering". Diferirlo a un microtask evita la colisión.
function unmountRootSafely(root: Root) {
  queueMicrotask(() => root.unmount());
}

export function EpselMapView({ clusters, onPressCluster, onElementClick }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const onElementClickRef = useRef(onElementClick);

  useEffect(() => {
    onElementClickRef.current = onElementClick;
  }, [onElementClick]);
  const onPressClusterRef = useRef(onPressCluster);

  useEffect(() => {
    onPressClusterRef.current = onPressCluster;
  }, [onPressCluster]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] =
      clusters.length > 0 ? [clusters[0].lon, clusters[0].lat] : DEFAULT_CENTER;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center,
      zoom: 13,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;
    const markers = markersRef.current;

    // Íconos usados por la capa `reservorios-icon` (map-style.json). Se registran
    // una sola vez al cargar el mapa. PNG con aspect ratio natural (elevado 188×384,
    // apoyado 384×228) y `pixelRatio: 4` — MapLibre interpreta 4 pixels del PNG = 1
    // CSS px, dando ~3.6× de margen contra pixelamiento incluso en pantallas DPR 4.
    // Base efectiva: lado más largo = 96 CSS px (384 / 4). El icon-size del style
    // multiplica esa base preservando aspect ratio.
    map.on('load', () => {
      const iconos: { id: string; url: string }[] = [
        { id: 'reservorio_elevado', url: RESERVORIO_ELEVADO_URI },
        { id: 'reservorio_apoyado', url: RESERVORIO_APOYADO_URI },
      ];
      for (const { id, url } of iconos) {
        if (map.hasImage(id)) continue;
        const img = new Image();
        img.onload = () => {
          if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 4 });
        };
        img.onerror = () => console.warn(`[MapView] No se pudo cargar el ícono ${id} desde ${url}`);
        img.src = url;
      }
    });

    return () => {
      markers.forEach(({ marker, root }) => {
        marker.remove();
        unmountRootSafely(root);
      });
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
    // Solo se inicializa una vez: el centro inicial replica el `initialViewState`
    // de la Cámara nativa (no se re-centra en updates posteriores).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El basemap demo (demotiles) no tiene variante oscura propia — se invierte el
  // canvas por CSS (truco estándar cuando no controlás el vector style) en vez del
  // contenedor entero, para no invertir también los marcadores/popups que cuelgan
  // del mismo container.
  const themeMode = useThemeStore((state) => state.mode);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    canvas.style.filter =
      themeMode === 'dark' ? 'invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92)' : '';
  }, [themeMode]);

  const capasVisibles = useCapasStore((state) => state.capasVisibles);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Lee del store en el momento de ejecución (no del closure) para que
    // re-disparos de styledata siempre usen el estado más reciente.
    const applyVisibility = () => {
      const current = useCapasStore.getState().capasVisibles;
      for (const [key, layerIds] of Object.entries(CAPA_LAYER_IDS) as [CapaKey, string[]][]) {
        const visible = current.has(key);
        for (const layerId of layerIds) {
          if (map.getLayer(layerId)) {
            const desired = visible ? 'visible' : 'none';
            // Guard: setLayoutProperty siempre marca el estilo dirty y re-dispara
            // 'styledata' aunque el valor no cambie — sin este chequeo, este handler
            // (suscrito a 'styledata') se retrigger a sí mismo en loop infinito junto
            // con applySectorHighlight/applyCatastroSectorFilter (mismo bug de fondo
            // que el ya arreglado en applyModoVista, ver comentario más abajo).
            if (map.getLayoutProperty(layerId, 'visibility') !== desired) {
              map.setLayoutProperty(layerId, 'visibility', desired);
            }
          }
        }
      }
    };

    // styledata se dispara cada vez que MapLibre termina de procesar el estilo
    // (incluyendo la primera carga y cambios de estilo posteriores).
    map.on('styledata', applyVisibility);

    // Aplicar también de inmediato si el estilo ya está cargado.
    if (map.isStyleLoaded()) applyVisibility();

    return () => {
      map.off('styledata', applyVisibility);
    };
  }, [capasVisibles]);

  const sectores = useUbicacionStore((state) => state.sectores);
  const sectoresActivos = useUbicacionStore((state) => state.sectoresActivos);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applySectorHighlight = () => {
      if (!map.getLayer(SECTOR_LAYER_IDS[0])) return;

      const currentSectores = useUbicacionStore.getState().sectores;
      if (currentSectores.length > 0) {
        const colorMatch: unknown[] = ['match', ['get', 'sectorid']];
        for (const sector of currentSectores) {
          colorMatch.push(Number(sector.id), colorForSectorId(sector.id));
        }
        colorMatch.push('#9E9E9E');
        for (const [layerId, paintProp] of SECTOR_COLOR_LAYER_IDS) {
          // Mismo guard que applyVisibility: comparar antes de escribir corta el
          // ciclo con 'styledata' en vez de retriggerearlo en cada frame.
          if (JSON.stringify(map.getPaintProperty(layerId, paintProp)) !== JSON.stringify(colorMatch)) {
            map.setPaintProperty(layerId, paintProp, colorMatch);
          }
        }
      }

      // El pintado es opcional (toggle "Resaltar sector" en UBICACIÓN): el sector
      // sigue "activo" para filtrar catastro y mover la cámara, solo se deja de
      // dibujar el polígono si el usuario no lo quiere ver.
      const resaltarActivo = useCapasStore.getState().capasVisibles.has('resaltar_sector');
      const idsActivos = resaltarActivo
        ? [...useUbicacionStore.getState().sectoresActivos].map(Number)
        : [];
      const filtro: maplibregl.FilterSpecification = ['in', ['get', 'sectorid'], ['literal', idsActivos]];
      for (const layerId of SECTOR_LAYER_IDS) {
        if (JSON.stringify(map.getFilter(layerId) ?? null) !== JSON.stringify(filtro)) {
          map.setFilter(layerId, filtro);
        }
      }
    };

    map.on('styledata', applySectorHighlight);
    if (map.isStyleLoaded()) applySectorHighlight();

    return () => {
      map.off('styledata', applySectorHighlight);
    };
  }, [sectores, sectoresActivos, capasVisibles]);

  // Con un sector marcado, todo lo de catastro (predio, alcantarillado, agua) se
  // acota a ese sector — sin sector activo, cada capa vuelve a su filtro base (o a
  // ninguno) tal como estaba antes de marcar algo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyCatastroSectorFilter = () => {
      const idsActivos = [...useUbicacionStore.getState().sectoresActivos].map(Number);
      const sectorFilter: maplibregl.FilterSpecification = ['in', ['get', 'sectorid'], ['literal', idsActivos]];

      for (const { id, baseFilter } of CATASTRO_SECTOR_FILTER_LAYERS) {
        if (!map.getLayer(id)) continue;
        const desired =
          idsActivos.length === 0
            ? ((baseFilter as maplibregl.FilterSpecification | undefined) ?? null)
            : ((baseFilter ? ['all', baseFilter, sectorFilter] : sectorFilter) as maplibregl.FilterSpecification);
        // Mismo guard que applyVisibility/applySectorHighlight: sin esto, este
        // handler (suscrito a 'styledata') retriggerea el evento en cada frame y
        // entra en loop infinito con los otros dos.
        if (JSON.stringify(map.getFilter(id) ?? null) !== JSON.stringify(desired)) {
          map.setFilter(id, desired);
        }
      }
    };

    map.on('styledata', applyCatastroSectorFilter);
    if (map.isStyleLoaded()) applyCatastroSectorFilter();

    return () => {
      map.off('styledata', applyCatastroSectorFilter);
    };
  }, [sectoresActivos]);

  const provincias = useUbicacionStore((state) => state.provincias);
  const distritos = useUbicacionStore((state) => state.distritos);
  const provinciasActivas = useUbicacionStore((state) => state.provinciasActivas);
  const distritosActivos = useUbicacionStore((state) => state.distritosActivos);
  const lastBoundsKeyRef = useRef<string | null>(null);

  // El nivel más específico con algo marcado manda la cámara: si hay un sector
  // activo, gana sobre distrito/provincia (que igual siguen marcados como filtro
  // de datos, solo dejan de mover el mapa). Varios ítems activos en el mismo nivel
  // encuadran la unión de sus bbox.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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

    // Guarda defensiva: un catálogo cacheado por el navegador desde antes de que
    // el backend empezara a mandar `bbox` (Cache-Control de estos endpoints es de
    // 1h) puede traer items sin bbox — se ignoran en vez de romper el fitBounds.
    activos = activos.filter((a) => a.bbox);
    if (activos.length === 0) return;

    const key = `${nivel}:${activos.map((a) => a.id).sort().join(',')}`;
    if (key === lastBoundsKeyRef.current) return;
    lastBoundsKeyRef.current = key;

    const bbox = unionBbox(activos.map((a) => a.bbox));
    // maxZoom 17 uniforme (antes era 19 para sector): a z=17 ya se ve la manzana y
    // se piden 16x menos tiles que a z=19, mejor hit-rate del cache de Martin.
    // duration:0 salta directo al zoom final en vez de animar por zooms intermedios
    // (16, 17, 18) pidiendo tiles que despues se tiran — la animacion cuesta ~5s
    // en cold porque cada zoom intermedio dispara pedidos a Martin de las 10 sources.
    map.fitBounds(
      [
        [bbox.minLon, bbox.minLat],
        [bbox.maxLon, bbox.maxLat],
      ],
      { padding: 48, maxZoom: 17, duration: 0 }
    );
  }, [provincias, distritos, sectores, provinciasActivas, distritosActivos, sectoresActivos]);

  const flyTarget = useMapSearchStore((state) => state.flyTarget);
  const pin = useMapSearchStore((state) => state.pin);
  const setFlying = useMapSearchStore((state) => state.setFlying);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    map.flyTo({ center: [flyTarget.lon, flyTarget.lat], zoom: flyTarget.zoom, duration: 1000 });
    // `once('moveend', ...)` se dispara al terminar la animación (o si el usuario la
    // interrumpe con un gesto); en ambos casos apagamos el loader del buscador.
    const onMoveEnd = () => setFlying(false);
    map.once('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
    };
  }, [flyTarget, setFlying]);

  // Marker default de MapLibre (pin rojo SVG built-in). Se planta al buscar y se
  // limpia si el store lo resetea (`clearPin`) o si se reemplaza por otra búsqueda.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pinMarkerRef.current?.remove();
    pinMarkerRef.current = null;
    if (!pin) return;
    pinMarkerRef.current = new maplibregl.Marker({ color: '#E53935' })
      .setLngLat([pin.lon, pin.lat])
      .addTo(map);
    return () => {
      pinMarkerRef.current?.remove();
      pinMarkerRef.current = null;
    };
  }, [pin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seenIds = new Set<string>();

    for (const cluster of clusters) {
      seenIds.add(cluster.id);
      const existing = markersRef.current.get(cluster.id);

      if (existing) {
        existing.clusterRef.current = cluster;
        existing.marker.setLngLat([cluster.lon, cluster.lat]);
        existing.root.render(<IncidentMarker cluster={cluster} />);
        continue;
      }

      const el = document.createElement('div');
      el.style.cursor = 'pointer';
      const clusterRef = { current: cluster };
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        onPressClusterRef.current(clusterRef.current);
      });

      const root = createRoot(el);
      root.render(<IncidentMarker cluster={cluster} />);

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([cluster.lon, cluster.lat])
        .addTo(map);

      markersRef.current.set(cluster.id, { marker, root, clusterRef });
    }

    for (const [id, entry] of markersRef.current) {
      if (!seenIds.has(id)) {
        entry.marker.remove();
        unmountRootSafely(entry.root);
        markersRef.current.delete(id);
      }
    }
  }, [clusters]);

  // Modo simulación: click en cualquier elemento de red que esté activo en
  // Filtros/Capas -> POST /grafo/simulacion. No hay ningún click/query interactivo
  // previo en este componente — el listener se registra siempre (el propio handler
  // chequea `activo`/`modoVista` en cada click, lee los stores en el momento en vez
  // de por closure, igual que el resto de efectos de este archivo) para no pelear
  // con el ciclo de vida del mapa al togglear el modo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      const sim = useSimulacionStore.getState();
      if (!sim.activo || sim.modoVista) return;

      // Solo elementos cuya capa está realmente prendida (no solo presente en el
      // style) son clickeables — "todo lo que tienes activo en filtros".
      const capasVisibles = useCapasStore.getState().capasVisibles;
      const layersPresentes = SIMULACION_LAYER_IDS.filter((id) => {
        if (!map.getLayer(id)) return false;
        const capaKey = CAPA_KEY_POR_LAYER_ID[id];
        return capaKey ? capasVisibles.has(capaKey) : true;
      });
      if (layersPresentes.length === 0) return;

      const features = map.queryRenderedFeatures(event.point, { layers: layersPresentes });
      if (features.length === 0) return;

      const feature = features[0];
      const elemento = elementoDeFeature(
        feature.layer.id,
        feature.properties as Record<string, unknown> | undefined,
        sim.tipoFallaBuzon
      );
      if (!elemento) return;

      useSimulacionStore.getState().setCargando(true);
      postSimulacion(elemento.tipoFalla, elemento.elementoId)
        .then((resultado) => {
          useSimulacionStore
            .getState()
            .setResultado(
              { tipo: elemento.elementoTipo, id: elemento.elementoId },
              resultado.afectados,
              resultado.redAfectada
            );
        })
        .catch(() => useSimulacionStore.getState().setCargando(false));
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, []);

  // Hover: resalta (feature-state 'hover', ver paint de cada layer en map-style.json)
  // cualquier elemento de catastro visible bajo el cursor — tramo, tubería, buzón,
  // accesorio, caja, manzana o lote. Universo de layers = HOVER_INTERACTIVE_LAYERS
  // (mismo criterio "capa realmente prendida" que el resto de efectos de este
  // archivo). El cursor de "pointer" se cede durante la fase de elegir elemento en
  // modo simulación: ese cursor lo maneja el efecto de más abajo (CURSOR_FALLA).
  const hoveredFeatureRef = useRef<{ source: string; sourceLayer: string; id: string | number } | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const clearHover = () => {
      const prev = hoveredFeatureRef.current;
      if (prev) {
        map.setFeatureState({ source: prev.source, sourceLayer: prev.sourceLayer, id: prev.id }, { hover: false });
        hoveredFeatureRef.current = null;
      }
    };

    const handleMouseMove = (event: maplibregl.MapMouseEvent) => {
      const capas = useCapasStore.getState().capasVisibles;
      const layersPresentes = HOVER_INTERACTIVE_LAYERS.filter((id) => {
        if (!map.getLayer(id)) return false;
        const capaKey = CAPA_KEY_POR_LAYER_ID[id];
        return capaKey ? capas.has(capaKey) : true;
      });

      const feature =
        layersPresentes.length > 0
          ? map.queryRenderedFeatures(event.point, { layers: layersPresentes })[0]
          : undefined;

      if (!feature || feature.id === undefined || feature.sourceLayer === undefined) {
        clearHover();
      } else {
        const prev = hoveredFeatureRef.current;
        const same =
          prev && prev.source === feature.source && prev.sourceLayer === feature.sourceLayer && prev.id === feature.id;
        if (!same) {
          clearHover();
          map.setFeatureState(
            { source: feature.source, sourceLayer: feature.sourceLayer, id: feature.id },
            { hover: true }
          );
          hoveredFeatureRef.current = { source: feature.source, sourceLayer: feature.sourceLayer, id: feature.id };
        }
      }

      const sim = useSimulacionStore.getState();
      if (!(sim.activo && !sim.modoVista)) {
        map.getCanvas().style.cursor = feature ? 'pointer' : '';
      }
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseout', clearHover);
    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', clearHover);
      clearHover();
    };
  }, [capasVisibles]);

  // Click fuera de modo simulación: abre el panel de info de catastro
  // (GET /red/elemento/{tipo}/{id}, ver mapa/index.web.tsx). Handler separado del de
  // simulación de arriba — ese es exclusivo de `sim.activo && !sim.modoVista`, este
  // solo corre cuando la simulación está inactiva, nunca compiten por el mismo click.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onElementClickRef) return;

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      if (useSimulacionStore.getState().activo) return;
      if (!onElementClickRef.current) return;

      const capas = useCapasStore.getState().capasVisibles;
      const layersPresentes = ELEMENTO_INFO_LAYERS.filter(({ id }) => {
        if (!map.getLayer(id)) return false;
        const capaKey = CAPA_KEY_POR_LAYER_ID[id];
        return capaKey ? capas.has(capaKey) : true;
      }).map((l) => l.id);
      if (layersPresentes.length === 0) return;

      const feature = map.queryRenderedFeatures(event.point, { layers: layersPresentes })[0];
      if (!feature) return;

      const config = ELEMENTO_INFO_LAYERS.find((l) => l.id === feature.layer.id);
      const idValor = config ? feature.properties?.[config.idProperty] : undefined;
      if (!config || typeof idValor !== 'number') return;

      onElementClickRef.current(config.tipo, idValor);
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, []);

  // Cursor "esto va a fallar" (X roja, ver CURSOR_FALLA) mientras se elige el
  // elemento a romper en modo simulación — se actualiza solo al cambiar de fase (no
  // por mousemove), el hover de arriba respeta esta fase y no pisa el cursor.
  const simActivo = useSimulacionStore((state) => state.activo);
  const simModoVista = useSimulacionStore((state) => state.modoVista);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = simActivo && !simModoVista ? CURSOR_FALLA : '';
  }, [simActivo, simModoVista]);

  // Modo vista: aísla y pinta de rojo TODA la red afectada devuelta por el backend
  // (redAfectada, agrupada por elementoTipo) más las cajas de los suministros
  // afectados (por inscripcion) — mismo idioma que applyCatastroSectorFilter/
  // applySectorHighlight (filtro ['in', prop, ['literal', ids]] combinado con el
  // baseFilter existente), solo que acá los ids salen de la simulación en vez de un
  // sector activo. Al salir de modo vista, restaura filtro base y color original.
  const modoVista = useSimulacionStore((state) => state.modoVista);
  const resultadoSimulacion = useSimulacionStore((state) => state.resultado);
  const redAfectada = useSimulacionStore((state) => state.redAfectada);
  // Bug real encontrado 2026-08-04: este efecto escribía en el mapa (setFilter/
  // setPaintProperty) en CADA evento 'styledata', incluso sin haber entrado nunca a
  // modo simulación — y esas mismas escrituras disparan más 'styledata', creando un
  // ciclo infinito con applyCatastroSectorFilter/applySectorHighlight/applyVisibility
  // (los 4 efectos compiten por las mismas capas, sin converger nunca). Eso causaba
  // que el resaltado de sector y la capa de agua "a veces sí, a veces no" se vieran —
  // no era intermitente al azar, era una carrera determinística que perdía casi
  // siempre contra este efecto. Fix: si modo vista nunca estuvo activo desde el
  // último cambio relevante, no tocar estas capas en absoluto — dejarlas 100% en
  // manos de los otros efectos, que son sus dueños legítimos fuera de modo vista.
  const modoVistaAplicadoRef = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyModoVista = () => {
      const sim = useSimulacionStore.getState();
      const activo = sim.modoVista;

      if (!activo && !modoVistaAplicadoRef.current) return;

      const idsPorTipo = new Map<string, (number | string)[]>();
      for (const el of sim.redAfectada ?? []) {
        const arr = idsPorTipo.get(el.elementoTipo) ?? [];
        arr.push(el.elementoId);
        idsPorTipo.set(el.elementoTipo, arr);
      }
      idsPorTipo.set(
        'suministro',
        (sim.resultado ?? []).map((a) => a.suministro)
      );

      for (const cfg of SIMULACION_ISOLATE_LAYERS) {
        if (!map.getLayer(cfg.id)) continue;
        if (activo) {
          const ids = idsPorTipo.get(cfg.elementoTipo) ?? [];
          const isolateFilter: maplibregl.FilterSpecification = ['in', ['get', cfg.idProperty], ['literal', ids]];
          const filtro = (
            cfg.baseFilter ? ['all', cfg.baseFilter, isolateFilter] : isolateFilter
          ) as maplibregl.FilterSpecification;
          map.setFilter(cfg.id, filtro);
          map.setPaintProperty(cfg.id, cfg.paintProp, SIMULACION_AFECTADO_COLOR);
        } else {
          map.setFilter(cfg.id, (cfg.baseFilter as maplibregl.FilterSpecification | undefined) ?? null);
          map.setPaintProperty(cfg.id, cfg.paintProp, SIMULACION_COLOR_ORIGINAL[cfg.id]);
        }
      }

      // Layers sin distinción afectado/no-afectado del backend: ocultas del todo en
      // modo vista, vuelven a depender de capasVisibles al salir.
      for (const id of SIMULACION_OCULTAR_EN_VISTA) {
        if (!map.getLayer(id)) continue;
        if (activo) {
          map.setLayoutProperty(id, 'visibility', 'none');
        } else {
          const capaKey = CAPA_KEY_POR_LAYER_ID[id];
          const visible = capaKey ? useCapasStore.getState().capasVisibles.has(capaKey) : true;
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        }
      }

      // Marca que este efecto "tomó control" (activo=true) o que ya soltó el control
      // tras el reset de arriba (activo=false) — así el próximo tick, si sigue
      // inactivo, entra por el early-return y deja de pelear por estas capas.
      modoVistaAplicadoRef.current = activo;
    };

    // Registrado después de applyCatastroSectorFilter/applySectorHighlight (ambos
    // más arriba en este componente, se montan primero) para ganar el setFilter en
    // las layers que comparten mientras modo vista está activo. Al salir, el reset
    // de arriba deja el filtro en baseFilter/null por un instante, pero como
    // applyCatastroSectorFilter sigue escuchando 'styledata' y siempre reaplica el
    // sector activo desde el store (no solo cuando cambia), se autocorrige en el
    // siguiente tick — sin el guard modoVistaAplicadoRef de arriba esto generaba un
    // ciclo infinito entre ambos efectos en vez de converger.
    map.on('styledata', applyModoVista);
    if (map.isStyleLoaded()) applyModoVista();

    return () => {
      map.off('styledata', applyModoVista);
    };
  }, [modoVista, resultadoSimulacion, redAfectada]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <SimulacionBorderOverlay />
      <SimulacionControl />
    </div>
  );
}
