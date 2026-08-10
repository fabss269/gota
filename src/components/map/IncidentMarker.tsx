import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AlcantarilladoIcon } from '@/icons/AlcantarilladoIcon';
import { GotaIcon } from '@/icons/GotaIcon';
import { Colors } from '@/constants/theme';
import type { IncidentCluster } from '@/utils/clusterIncidents';

const PRIORIDAD_COLOR: Record<IncidentCluster['prioridadMaxima'], string> = {
  a_tiempo: Colors.statusATiempo,
  alerta: Colors.statusAlerta,
  critica: Colors.statusCritica,
};

const PIN_SIZE = 40;

type Props = {
  cluster: IncidentCluster;
};

export function IncidentMarker({ cluster }: Props) {
  const color = PRIORIDAD_COLOR[cluster.prioridadMaxima];

  return (
    <View style={styles.wrapper}>
      <Svg width={PIN_SIZE} height={PIN_SIZE * 1.25} viewBox="0 0 40 50">
        <Path
          d="M20 0C8.95 0 0 8.95 0 20C0 33.75 20 50 20 50C20 50 40 33.75 40 20C40 8.95 31.05 0 20 0Z"
          fill={color}
        />
      </Svg>
      <View style={styles.glyph} pointerEvents="none">
        {cluster.categoriaDominante === 'agua' && <GotaIcon size={16} color={Colors.white} />}
        {cluster.categoriaDominante === 'desague' && <AlcantarilladoIcon size={16} color={Colors.white} />}
      </View>
      {cluster.count > 1 && (
        <View style={[styles.countBadge, { borderColor: color }]} pointerEvents="none">
          <Text style={styles.countText}>{cluster.count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: PIN_SIZE,
    height: PIN_SIZE * 1.25,
    alignItems: 'center',
  },
  glyph: {
    position: 'absolute',
    top: PIN_SIZE * 0.16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textBody,
  },
});
