import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { ApiAfectado } from '@/api/types';

export const PRIORIDAD_PILL: Record<string, { bg: string; text: string }> = {
  ALTA: { bg: '#FDEBEA', text: Colors.statusCritica },
  MEDIA: { bg: '#FFF8E1', text: '#B98900' },
  BAJA: { bg: '#E6F7EA', text: Colors.statusATiempo },
};

/** Fila de suministro afectado (nivel + horas estimadas + pill de prioridad).
 * Compartida entre ImpactoTab.tsx (tab "Impacto" del detalle de incidencia) y
 * SimulacionControl.web.tsx (modo vista del mapa) — mismo shape ApiAfectado. */
export function AfectadoRow({ afectado }: { afectado: ApiAfectado }) {
  const pill = afectado.prioridad ? PRIORIDAD_PILL[afectado.prioridad] : null;
  return (
    <View style={styles.row}>
      <View style={styles.rowTextCol}>
        <Text style={styles.rowTitle}>Suministro {afectado.suministro}</Text>
        <Text style={styles.rowSubtitle}>
          Nivel {afectado.nivel}
          {afectado.horasEstimadas != null ? ` · ~${afectado.horasEstimadas}h estimadas` : ''}
        </Text>
      </View>
      {pill && (
        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.pillLabel, { color: pill.text }]}>{afectado.prioridad}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowTextCol: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: Colors.textBody },
  rowSubtitle: { fontSize: 11, color: Colors.textMuted },
  pill: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  pillLabel: { fontSize: 11, fontWeight: '600' },
});
