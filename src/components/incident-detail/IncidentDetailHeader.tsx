import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AlcantarilladoIcon } from '@/icons/AlcantarilladoIcon';
import { GotaIcon } from '@/icons/GotaIcon';
import { Colors, Spacing } from '@/constants/theme';
import type { IncidenciaDetalle } from '@/mocks/incidentDetailMock';

const PRIORIDAD_LABEL: Record<IncidenciaDetalle['prioridad'], string> = {
  a_tiempo: 'A tiempo',
  alerta: 'Alerta',
  critica: 'Crítica',
};
const PRIORIDAD_COLOR: Record<IncidenciaDetalle['prioridad'], string> = {
  a_tiempo: Colors.statusATiempo,
  alerta: Colors.statusAlerta,
  critica: Colors.statusCritica,
};

type Props = {
  incidencia: IncidenciaDetalle;
  onClose: () => void;
  onChangeEstadoPress: () => void;
  onReassignPress: () => void;
};

/** Header común a los 4 tabs del Detalle de Incidencia (Spec 06, RF-06.1). */
export function IncidentDetailHeader({ incidencia, onClose, onChangeEstadoPress, onReassignPress }: Props) {
  const initials = incidencia.tecnicoAsignado
    ? incidencia.tecnicoAsignado.nombre
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
    : '?';

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {incidencia.tipo}
        </Text>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>{incidencia.direccion}</Text>

      <View style={styles.metaRow}>
        <View style={[styles.priorityBadge, { backgroundColor: PRIORIDAD_COLOR[incidencia.prioridad] }]}>
          <Text style={styles.priorityLabel}>{PRIORIDAD_LABEL[incidencia.prioridad]}</Text>
        </View>
        <Text style={styles.daysLabel}>{incidencia.antiguedadDias} días</Text>
        {incidencia.categoria === 'agua' ? (
          <GotaIcon size={16} color={Colors.accent} />
        ) : (
          <AlcantarilladoIcon size={16} color={Colors.accent} />
        )}
        <Pressable style={styles.statusChip} onPress={onChangeEstadoPress}>
          <Text style={styles.statusLabel}>{incidencia.estado.replace('_', ' ')}</Text>
          <Text style={styles.chevronDown}>▾</Text>
        </Pressable>
      </View>

      <Pressable style={styles.assigneeRow} onPress={onReassignPress}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLabel}>{initials}</Text>
        </View>
        <View style={styles.assigneeTextCol}>
          <Text style={styles.assigneeName}>{incidencia.tecnicoAsignado?.nombre ?? 'Sin asignar'}</Text>
          <Text style={styles.assigneeRole}>Técnico asignado</Text>
        </View>
        <Text style={styles.chevronRight}>{'>'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.primaryDark },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E3E4E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 16, fontWeight: '700', color: Colors.textBody },
  subtitle: { fontSize: 12, color: Colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  priorityBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  priorityLabel: { fontSize: 11, fontWeight: '700', color: Colors.white },
  daysLabel: { fontSize: 11, color: Colors.textMuted },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0E4FF',
    borderRadius: 20,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  statusLabel: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  chevronDown: { fontSize: 10, color: Colors.accent },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { fontSize: 12, fontWeight: '700', color: Colors.white },
  assigneeTextCol: { flex: 1, gap: 2 },
  assigneeName: { fontSize: 12.5, fontWeight: '600', color: Colors.textBody },
  assigneeRole: { fontSize: 10.5, color: Colors.textMuted },
  chevronRight: { fontSize: 16, fontWeight: '700', color: Colors.textMuted },
});
