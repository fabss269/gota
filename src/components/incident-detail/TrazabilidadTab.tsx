import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { IncidenciaDetalle, TrazabilidadPaso } from '@/mocks/incidentDetailMock';
import { formatFechaHora } from '@/utils/formatFecha';

const ESTADO_LABEL: Record<TrazabilidadPaso['estado'], string> = {
  CREADO: 'CREADO',
  PENDIENTE: 'PENDIENTE',
  EN_PROGRESO: 'EN PROGRESO',
  ATENDIDO: 'ATENDIDO',
};
const DOT_COLOR: Record<TrazabilidadPaso['estado'], string> = {
  CREADO: '#A0A0A0',
  PENDIENTE: '#A0A0A0',
  EN_PROGRESO: '#AEFFFC',
  ATENDIDO: '#9AFF84',
};

type Props = { incidencia: IncidenciaDetalle };

/** Tab "Trazabilidad" (Spec 06, RF-06.5). */
export function TrazabilidadTab({ incidencia }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Trazabilidad completa</Text>
      {incidencia.trazabilidad.map((paso, i) => (
        <View key={`${paso.estado}-${i}`} style={styles.step}>
          {i > 0 && <View style={styles.connector} />}
          <View style={styles.dotRow}>
            <View style={[styles.dot, { backgroundColor: DOT_COLOR[paso.estado] }]} />
            <View style={styles.textCol}>
              <Text style={styles.estadoLabel}>{ESTADO_LABEL[paso.estado]}</Text>
              <Text style={styles.fechaLabel}>{paso.fecha ? formatFechaHora(paso.fecha) : 'Pendiente'}</Text>
              {paso.grupo && <Text style={styles.metaLabel}>Grupo: {paso.grupo}</Text>}
              {paso.asignadoA && <Text style={styles.metaLabel}>Asignado a: {paso.asignadoA}</Text>}
              {paso.motivo && <Text style={styles.metaLabel}>Motivo: {paso.motivo}</Text>}
              {paso.nota && <Text style={styles.metaLabel}>Nota: {paso.nota}</Text>}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: Colors.accent, marginBottom: Spacing.xs },
  step: {},
  connector: { position: 'absolute', left: 4, top: -10, width: 1, height: 10, backgroundColor: Colors.border },
  dotRow: { flexDirection: 'row', gap: Spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  textCol: { flex: 1, gap: 1, paddingBottom: Spacing.sm },
  estadoLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textBody },
  fechaLabel: { fontSize: 11, color: Colors.textMuted },
  metaLabel: { fontSize: 11, color: Colors.textMuted },
});
