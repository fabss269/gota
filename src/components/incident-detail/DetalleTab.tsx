import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { IncidenciaDetalle } from '@/mocks/incidentDetailMock';
import { formatFecha, formatFechaHora } from '@/utils/formatFecha';

type Props = { incidencia: IncidenciaDetalle };

/** Tab "Detalle" (Spec 06, RF-06.2 a RF-06.4). */
export function DetalleTab({ incidencia }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos del reclamo</Text>
        <InfoRow label="Fecha de registro" value={formatFechaHora(incidencia.reclamo.fechaRegistro)} />
        <InfoRow
          label="Medio de recepción"
          value={incidencia.reclamo.medioRecepcion}
          icon={incidencia.reclamo.medioRecepcion === 'Teléfono' ? '📞' : undefined}
        />
        <InfoRow label="Canal" value={incidencia.reclamo.canal} />
        <InfoRowStacked label="Descripción" value={incidencia.reclamo.descripcion} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeadRow}>
          <Text style={styles.cardTitle}>Datos del catastro</Text>
          {incidencia.catastro.conexionAproximada && (
            <View style={styles.tag}>
              <Text style={styles.tagLabel}>Conexión aproximada</Text>
            </View>
          )}
        </View>
        <InfoRow label="Red asociada" value={incidencia.catastro.redAsociada} />
        <InfoRow label="Diámetro" value={`${incidencia.catastro.diametroMm} mm`} />
        <InfoRow label="Material" value={incidencia.catastro.material} />
        <InfoRow label="Buzón cercano" value={incidencia.catastro.buzonCercano} />
        <InfoRow label="Sector" value={incidencia.sector} />

        <View style={styles.divider} />

        <InfoRow label="Número de quejas agrupadas" value={String(incidencia.quejasAgrupadas)} />
        <InfoRow
          label="Predio"
          value={`${incidencia.predio.noReincidente ? 'No reincidente' : 'Reincidente'} · ${incidencia.predio.quejasUltimos6Meses} quejas en 6 meses`}
        />
        <InfoRow
          label="Foco"
          value={incidencia.foco ? `Asociado a ${incidencia.foco.incidenciasRelacionadas.length} incidencias` : 'Sin foco asociado'}
        />
      </View>

      {incidencia.quejasAgrupadas > 1 && (
        <View style={[styles.card, styles.groupedCard]}>
          <Text style={styles.cardTitle}>Esta incidencia agrupa {incidencia.quejasAgrupadas} reclamos</Text>
          {incidencia.reclamosAgrupados.map((r) => (
            <Text key={r.id} style={styles.groupedItem}>
              •  Reclamo #{r.id}  ·  {formatFecha(r.fecha)}
            </Text>
          ))}
          <Pressable
            onPress={() =>
              // No hay pantalla ni endpoint dedicado a la lista completa de reclamos
              // agrupados (docs/API.md § 4 solo expone el conteo) — mismo criterio de
              // simplificación documentada que otros "ver más" sin backend real.
              Alert.alert('Reclamos agrupados', 'La vista completa de reclamos no está implementada todavía.')
            }
          >
            <Text style={styles.groupedLink}>Ver los {incidencia.quejasAgrupadas} reclamos →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
      {icon && <Text style={styles.infoIcon}>{icon}</Text>}
    </View>
  );
}

function InfoRowStacked({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRowStacked}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  card: { gap: 10 },
  groupedCard: {
    backgroundColor: '#E0E4FF',
    borderRadius: 12,
    padding: Spacing.sm,
  },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cardTitle: { fontSize: 13, fontWeight: '700', color: Colors.accent },
  tag: { backgroundColor: '#E0E4FF', borderRadius: 20, paddingHorizontal: Spacing.xs, paddingVertical: 3 },
  tagLabel: { fontSize: 10, fontWeight: '600', color: Colors.accent },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  infoRowStacked: { gap: 4 },
  infoLabel: { width: 130, fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  infoValue: { flex: 1, fontSize: 12.5, color: Colors.textBody },
  infoIcon: { fontSize: 14 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  groupedItem: { fontSize: 12.5, color: Colors.textBody },
  groupedLink: { fontSize: 12.5, fontWeight: '700', color: Colors.accent, marginTop: 4 },
});
