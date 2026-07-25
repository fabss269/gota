import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { IncidentMarker } from '@/components/map/IncidentMarker';
import { type CapaKey, useCapasStore } from '@/state/capasStore';
import type { IncidentCluster } from '@/utils/clusterIncidents';

// Une cada checkbox de la pestaña "Capas" (Spec 04) con los layers reales del style.json
// servido por Martin (docs/ESTADO_PROYECTO.md). "valvulas"/"grifos_contra_incendio" no
// tienen entrada porque no existe esa geometría en `sig` — no hay layer que mostrar.
const CAPA_LAYER_IDS: Record<CapaKey, string[]> = {
  red_potable: ['agua-matriz', 'agua-distribucion', 'cajaaguaconexion-line', 'cajaagua-circle'],
  valvulas: [],
  grifos_contra_incendio: [],
  red_primaria_desague: ['alcantarillado-primaria'],
  red_secundaria_desague: ['alcantarillado-secundaria', 'cajadesagueconexion-line', 'cajadesague-circle'],
  buzones: ['buzones-circle'],
};

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

    const applyVisibility = () => {
      for (const [key, layerIds] of Object.entries(CAPA_LAYER_IDS) as [CapaKey, string[]][]) {
        const visible = capasVisibles.has(key);
        for (const layerId of layerIds) {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
          }
        }
      }
      // "idle" confirma que MapLibre terminó de pedir/dibujar los tiles de las capas
      // recién mostradas — recién ahí se apaga el loader del botón "Ver en el mapa".
      if (useCapasStore.getState().isApplying) {
        map.once('idle', () => useCapasStore.getState().setApplying(false));
      }
    };

    if (map.isStyleLoaded()) {
      applyVisibility();
    } else {
      map.once('load', applyVisibility);
    }
  }, [capasVisibles]);

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
