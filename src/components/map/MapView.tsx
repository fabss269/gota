import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet } from 'react-native';

import { IncidentMarker } from '@/components/map/IncidentMarker';
import type { IncidentCluster } from '@/utils/clusterIncidents';

// Chiclayo, Perú (Spec 03, RF-03.1 — centro por defecto si no hay incidencias).
const DEFAULT_CENTER: [number, number] = [-79.8409, -6.7714];

// Estilo demo público de MapLibre (sin API key, ver Spec 03 / decisión de mapas en
// specs/00-auditoria-diseno.md). Para producción, reemplazar por un estilo propio
// (ej. MapTiler/Stadia/tiles self-hosted) vía EXPO_PUBLIC_MAP_STYLE_URL.
const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? 'https://demotiles.maplibre.org/style.json';

type Props = {
  clusters: IncidentCluster[];
  onPressCluster: (cluster: IncidentCluster) => void;
};

export function EpselMapView({ clusters, onPressCluster }: Props) {
  const center: [number, number] =
    clusters.length > 0 ? [clusters[0].lon, clusters[0].lat] : DEFAULT_CENTER;

  return (
    <Map style={styles.map} mapStyle={MAP_STYLE_URL} logo={false} attribution={false}>
      <Camera initialViewState={{ center, zoom: 13 }} />
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
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
