import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { IncidenciaDetalle } from '@/mocks/incidentDetailMock';
import { formatFecha } from '@/utils/formatFecha';

type Props = { incidencia: IncidenciaDetalle };

/** Tab "Predio" (Spec 06, RF-06.7). */
export function PredioTab({ incidencia }: Props) {
  const items = [
    { id: incidencia.id, tipo: incidencia.tipo, fecha: incidencia.fechaCreacion, current: true },
    ...incidencia.predio.historico.map((h) => ({ ...h, current: false })),
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Histórico del predio</Text>
      <Text style={styles.subtitle}>
        {incidencia.direccion}  ·  {incidencia.predio.quejasUltimos6Meses} quejas en 6 meses
      </Text>

      {items.map((item, i) => (
        <View key={`${item.id}-${i}`} style={styles.row}>
          {i > 0 && <View style={styles.connector} />}
          <View style={[styles.dot, item.current ? styles.dotActive : styles.dotInactive]} />
          <View style={styles.textCol}>
            <Text style={styles.tipo}>{item.tipo}</Text>
            <Text style={styles.meta}>
              Reclamo #{item.id}  ·  {formatFecha(item.fecha)}
            </Text>
          </View>
        </View>
      ))}

      {incidencia.predio.historico.length === 0 && (
        <Text style={styles.emptyText}>Primer reclamo registrado en este predio.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.xs },
  cardTitle: { fontSize: 13, fontWeight: '700', color: Colors.accent },
  subtitle: { fontSize: 11.5, color: Colors.textMuted, marginBottom: Spacing.xs },
  row: { flexDirection: 'row', gap: Spacing.sm },
  connector: { position: 'absolute', left: 5, top: -8, width: 1, height: 8, backgroundColor: Colors.border },
  dot: { width: 11, height: 11, borderRadius: 6, marginTop: 3 },
  dotActive: { backgroundColor: Colors.accent },
  dotInactive: { backgroundColor: '#E3E4E8' },
  textCol: { flex: 1, gap: 1, paddingBottom: Spacing.sm },
  tipo: { fontSize: 13, fontWeight: '600', color: Colors.textBody },
  meta: { fontSize: 11, color: Colors.textMuted },
  emptyText: { fontSize: 12, color: Colors.textMuted, marginTop: Spacing.xs },
});
