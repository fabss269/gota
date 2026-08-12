import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { EstadoIncidencia, Incidencia, Prioridad } from '@/mocks/incidentsMock';

const PRIORIDAD_COLOR: Record<Prioridad, string> = {
  a_tiempo: Colors.statusATiempo,
  alerta: Colors.statusAlerta,
  critica: Colors.statusCritica,
};

const ESTADO_LABEL: Record<EstadoIncidencia, string> = {
  CREADO: 'Registrado',
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  ATENDIDO: 'Atendido',
};

type Props = {
  incidencia: Incidencia;
  onPress: () => void;
};

/** Fila de la Lista de Incidencias (Spec 05, RF-05.4). */
export function IncidentListItem({ incidencia, onPress }: Props) {
  // RF-05.4: el punto gris es exclusivo del estado "Registrado" (sin asignar aún),
  // independiente de la prioridad — mismo criterio que RF-07 usa para "sin asignar".
  const dotColor = incidencia.estado === 'CREADO' ? Colors.textMuted : PRIORIDAD_COLOR[incidencia.prioridad];
  const estadoLabel = ESTADO_LABEL[incidencia.estado];
  const subtitle =
    incidencia.prioridad === 'critica'
      ? `${incidencia.direccion} · Crítica · ${estadoLabel}`
      : `${incidencia.direccion} · ${estadoLabel}`;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: dotColor }]}>
          <Text style={styles.dotGlyph}>!</Text>
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>
            {incidencia.tipo}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
      <Text style={styles.chevron}>{'>'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotGlyph: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  textCol: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: '600', color: Colors.textBody },
  subtitle: { fontSize: 10, color: Colors.textMuted },
  chevron: { fontSize: 14, fontWeight: '700', color: '#C9CCD6' },
});
