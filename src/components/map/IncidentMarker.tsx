import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AlcantarilladoIcon } from '@/icons/AlcantarilladoIcon';
import { GotaIcon } from '@/icons/GotaIcon';
import { Colors } from '@/constants/theme';
import type { IncidentCluster } from '@/utils/clusterIncidents';

// Color del pin por categoría (decisión Fabiana 2026-08-11): agua = azul,
// desagüe = marrón. La prioridad se refleja como un halo titilante en la
// punta del pin (rediseño 2026-08-12, pedido de Edgar — antes era un anillo
// alrededor de todo el pin, se sentía menos claro que "acá cae el incidente").
const CATEGORIA_COLOR: Record<IncidentCluster['categoriaDominante'], string> = {
  agua: Colors.agua,
  desague: Colors.desague,
};

// Color del halo por prioridad. `a_tiempo` no dibuja halo — pin liso.
const PRIORIDAD_HALO: Partial<Record<IncidentCluster['prioridadMaxima'], string>> = {
  alerta: Colors.statusAlerta,
  critica: Colors.statusCritica,
};

const PIN_SIZE = 40;
const PIN_PATH = 'M20 0C8.95 0 0 8.95 0 20C0 33.75 20 50 20 50C20 50 40 33.75 40 20C40 8.95 31.05 0 20 0Z';
// Punta del pin — mismo punto que ancla el marker en el mapa (`anchor: 'bottom'`
// en MapView.web.tsx/MapView.tsx), así el halo titila exactamente donde "cae"
// el incidente. Radio 5 con centro en y=45 para que el círculo completo quede
// dentro del viewBox (0 0 40 50) sin recortarse.
const HALO_CX = 20;
const HALO_CY = 45;
const HALO_R = 5;
const KEYFRAME_ID = 'gota-pin-pulse-kf';

// Inyecta el keyframe una sola vez al importar este módulo (idempotente).
// Sirve para el halo titilante en web; en nativo el guard `typeof document`
// evita el side effect y el `style.animation` de RN nativo ignora la prop.
if (typeof document !== 'undefined' && !document.getElementById(KEYFRAME_ID)) {
  const styleEl = document.createElement('style');
  styleEl.id = KEYFRAME_ID;
  styleEl.textContent =
    '@keyframes gota-pin-pulse { 0%,100% { opacity: 0.35 } 50% { opacity: 1 } }';
  document.head.appendChild(styleEl);
}

type Props = {
  cluster: IncidentCluster;
};

export function IncidentMarker({ cluster }: Props) {
  const color = CATEGORIA_COLOR[cluster.categoriaDominante];
  const haloColor = PRIORIDAD_HALO[cluster.prioridadMaxima];

  return (
    <View style={styles.wrapper}>
      <Svg width={PIN_SIZE} height={PIN_SIZE * 1.25} viewBox="0 0 40 50">
        <Path d={PIN_PATH} fill={color} />
        {haloColor && (
          // Cast a `any` — CircleProps no tipa `style.animation` (es CSS puro
          // que solo aplica en web; en nativo la animación se ignora).
          (<Circle
            cx={HALO_CX}
            cy={HALO_CY}
            r={HALO_R}
            fill={haloColor}
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
