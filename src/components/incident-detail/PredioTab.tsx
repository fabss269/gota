import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing, type ColorPalette } from '@/constants/theme';
import type { IncidenciaDetalle } from '@/mocks/incidentDetailMock';
import { useThemeColors } from '@/state/themeStore';
import { formatFecha } from '@/utils/formatFecha';

type Props = { incidencia: IncidenciaDetalle };

/** Tab "Predio" (Spec 06, RF-06.7). */
export function PredioTab({ incidencia }: Props) {
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
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

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    card: { gap: Spacing.xs },
    cardTitle: { fontSize: 13, fontWeight: '700', color: t.accent },
    subtitle: { fontSize: 11.5, color: t.textMuted, marginBottom: Spacing.xs },
    row: { flexDirection: 'row', gap: Spacing.sm },
    connector: { position: 'absolute', left: 5, top: -8, width: 1, height: 8, backgroundColor: t.border },
    dot: { width: 11, height: 11, borderRadius: 6, marginTop: 3 },
    dotActive: { backgroundColor: t.accent },
    dotInactive: { backgroundColor: t.border },
    textCol: { flex: 1, gap: 1, paddingBottom: Spacing.sm },
    tipo: { fontSize: 13, fontWeight: '600', color: t.textBody },
    meta: { fontSize: 11, color: t.textMuted },
    emptyText: { fontSize: 12, color: t.textMuted, marginTop: Spacing.xs },
  });
}
