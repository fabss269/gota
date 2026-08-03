import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

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
import { type CapaKey, useCapasStore } from '@/state/capasStore';
import { useMapSearchStore } from '@/state/mapSearchStore';
import { useUbicacionStore } from '@/state/ubicacionStore';
import type { IncidentCluster } from '@/utils/clusterIncidents';

// Chiclayo, Perú (Spec 03, RF-03.1 — centro por defecto si no hay incidencias).
const DEFAULT_CENTER: [number, number] = [-79.8409, -6.7714];

// Mismo estilo demo público que la versión nativa (ver MapView.tsx).
const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? 'https://demotiles.maplibre.org/style.json';

type Props = {
  clusters: IncidentCluster[];
  onPressCluster: (cluster: IncidentCluster) => void;
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

export function EpselMapView({ clusters, onPressCluster }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
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
            map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
          }
        }
      }
      if (useCapasStore.getState().isApplying) {
        map.once('idle', () => useCapasStore.getState().setApplying(false));
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
          map.setPaintProperty(layerId, paintProp, colorMatch);
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
        map.setFilter(layerId, filtro);
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
        if (idsActivos.length === 0) {
          map.setFilter(id, (baseFilter as maplibregl.FilterSpecification | undefined) ?? null);
        } else {
          const combinado = (
            baseFilter ? ['all', baseFilter, sectorFilter] : sectorFilter
          ) as maplibregl.FilterSpecification;
          map.setFilter(id, combinado);
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    map.flyTo({ center: [flyTarget.lon, flyTarget.lat], zoom: flyTarget.zoom, duration: 1000 });
  }, [flyTarget]);

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

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
