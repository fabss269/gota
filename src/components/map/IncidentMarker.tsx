import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { AlcantarilladoIcon } from '@/icons/AlcantarilladoIcon';
import { GotaIcon } from '@/icons/GotaIcon';
import { Colors } from '@/constants/theme';
import type { IncidentCluster } from '@/utils/clusterIncidents';

// Color del pin por categoría (decisión Fabiana 2026-08-11): agua = azul,
// desagüe = marrón. La prioridad se refleja en la mitad inferior del pin con
// un degradé (rediseño 2026-08-12, pedido de Edgar — antes era un halo
// titilante en la punta, no convenció visualmente).
const CATEGORIA_COLOR: Record<IncidentCluster['categoriaDominante'], string> = {
  agua: Colors.agua,
  desague: Colors.desague,
};

// Color de la mitad inferior del pin por prioridad — a diferencia del halo
// anterior, ahora las 3 prioridades tienen color (antes `a_tiempo` no
// pintaba nada).
const PRIORIDAD_COLOR: Record<IncidentCluster['prioridadMaxima'], string> = {
  a_tiempo: Colors.statusATiempo,
  alerta: Colors.statusAlerta,
  critica: Colors.statusCritica,
};

const PIN_SIZE = 40;
const PIN_PATH = 'M20 0C8.95 0 0 8.95 0 20C0 33.75 20 50 20 50C20 50 40 33.75 40 20C40 8.95 31.05 0 20 0Z';

type Props = {
  cluster: IncidentCluster;
};

export function IncidentMarker({ cluster }: Props) {
  const color = CATEGORIA_COLOR[cluster.categoriaDominante];
  const prioridadColor = PRIORIDAD_COLOR[cluster.prioridadMaxima];
  // Id único por instancia — varios pines comparten el mismo documento SVG
  // en web, un id de gradiente fijo colisionaría entre marcadores.
  const gradientId = `pin-grad-${useId()}`;

  return (
    <View style={styles.wrapper}>
      <Svg width={PIN_SIZE} height={PIN_SIZE * 1.25} viewBox="0 0 40 50">
        <Defs>
          {/* 65% superior color de categoría, 35% inferior color de prioridad,
              degradé entre ambos para no cortar la vista de golpe. */}
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} />
            <Stop offset="0.55" stopColor={color} />
            <Stop offset="0.75" stopColor={prioridadColor} />
            <Stop offset="1" stopColor={prioridadColor} />
          </LinearGradient>
        </Defs>
        <Path d={PIN_PATH} fill={`url(#${gradientId})`} />
      </Svg>
      <View style={styles.glyph}>
        {cluster.categoriaDominante === 'agua' && <GotaIcon size={16} color={Colors.white} />}
        {cluster.categoriaDominante === 'desague' && <AlcantarilladoIcon size={16} color={Colors.white} />}
      </View>
      {cluster.count > 1 && (
        <View style={[styles.countBadge, { borderColor: color }]}>
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
  // pointerEvents va en style (no como prop) — la prop está deprecada en RN 0.75+.
  glyph: {
    position: 'absolute',
    top: PIN_SIZE * 0.16,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
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
    pointerEvents: 'none',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textBody,
  },
});
