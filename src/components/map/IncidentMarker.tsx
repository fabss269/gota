import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AlcantarilladoIcon } from '@/icons/AlcantarilladoIcon';
import { GotaIcon } from '@/icons/GotaIcon';
import { Colors } from '@/constants/theme';
import type { IncidentCluster } from '@/utils/clusterIncidents';

// Color del pin por categoría (decisión Fabiana 2026-08-11): agua = azul,
// desagüe = marrón. La prioridad se refleja como un anillo alrededor del pin
// que titila cuando es alerta o crítica.
const CATEGORIA_COLOR: Record<IncidentCluster['categoriaDominante'], string> = {
  agua: Colors.agua,
  desague: Colors.desague,
};

// Color del anillo por prioridad. `a_tiempo` no dibuja anillo — pin liso.
const PRIORIDAD_ANILLO: Partial<Record<IncidentCluster['prioridadMaxima'], string>> = {
  alerta: Colors.statusAlerta,
  critica: Colors.statusCritica,
};

const PIN_SIZE = 40;
const PIN_PATH = 'M20 0C8.95 0 0 8.95 0 20C0 33.75 20 50 20 50C20 50 40 33.75 40 20C40 8.95 31.05 0 20 0Z';
const KEYFRAME_ID = 'gota-pin-pulse-kf';

// Inyecta el keyframe una sola vez al importar este módulo (idempotente).
// Sirve para el anillo titilante en web; en nativo el guard `typeof document`
// evita el side effect y el `style.animation` de RN nativo ignora la prop.
if (typeof document !== 'undefined' && !document.getElementById(KEYFRAME_ID)) {
  const styleEl = document.createElement('style');
  styleEl.id = KEYFRAME_ID;
  styleEl.textContent =
    '@keyframes gota-pin-pulse { 0%,100% { stroke-opacity: 0.35 } 50% { stroke-opacity: 1 } }';
  document.head.appendChild(styleEl);
}

type Props = {
  cluster: IncidentCluster;
};

export function IncidentMarker({ cluster }: Props) {
  const color = CATEGORIA_COLOR[cluster.categoriaDominante];
  const anilloColor = PRIORIDAD_ANILLO[cluster.prioridadMaxima];

  return (
    <View style={styles.wrapper}>
      <Svg width={PIN_SIZE} height={PIN_SIZE * 1.25} viewBox="0 0 40 50">
        <Path d={PIN_PATH} fill={color} />
        {anilloColor && (
          // Cast a `any` — PathProps no tipa `style.animation` (es CSS puro
          // que solo aplica en web; en nativo la animación se ignora).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (<Path
            d={PIN_PATH}
            fill="none"
            stroke={anilloColor}
            strokeWidth={3}
            {...({ style: { animation: 'gota-pin-pulse 1.4s ease-in-out infinite' } } as any)}
          />)
        )}
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
