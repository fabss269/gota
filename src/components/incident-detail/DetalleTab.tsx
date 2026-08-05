import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, type ColorPalette } from '@/constants/theme';
import type { IncidenciaDetalle } from '@/mocks/incidentDetailMock';
import { useMapSearchStore } from '@/state/mapSearchStore';
import { useThemeColors } from '@/state/themeStore';
import { formatFecha, formatFechaHora } from '@/utils/formatFecha';

type Props = { incidencia: IncidenciaDetalle };

/** Tab "Detalle" (Spec 06, RF-06.2 a RF-06.4). */
export function DetalleTab({ incidencia }: Props) {
  const router = useRouter();
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.mapLink}
        onPress={() => {
          useMapSearchStore.getState().flyTo({ lat: incidencia.lat, lon: incidencia.lon });
          router.push('/(app)/mapa');
        }}
      >
        <Text style={styles.mapLinkText}>📍 Ver en el mapa</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos del reclamo</Text>
        <InfoRow styles={styles} label="Fecha de registro" value={formatFechaHora(incidencia.reclamo.fechaRegistro)} />
        <InfoRow
          styles={styles}
          label="Medio de recepción"
          value={incidencia.reclamo.medioRecepcion}
          icon={incidencia.reclamo.medioRecepcion === 'Teléfono' ? '📞' : undefined}
        />
        <InfoRow styles={styles} label="Canal" value={incidencia.reclamo.canal} />
        <InfoRowStacked styles={styles} label="Descripción" value={incidencia.reclamo.descripcion} />
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
        <InfoRow styles={styles} label="Red asociada" value={incidencia.catastro.redAsociada} />
        <InfoRow styles={styles} label="Diámetro" value={`${incidencia.catastro.diametroMm} mm`} />
        <InfoRow styles={styles} label="Material" value={incidencia.catastro.material} />
        <InfoRow styles={styles} label="Buzón cercano" value={incidencia.catastro.buzonCercano} />
        <InfoRow styles={styles} label="Sector" value={incidencia.sector} />

        <View style={styles.divider} />

        <InfoRow styles={styles} label="Número de quejas agrupadas" value={String(incidencia.quejasAgrupadas)} />
        <InfoRow
          styles={styles}
          label="Predio"
          value={`${incidencia.predio.noReincidente ? 'No reincidente' : 'Reincidente'} · ${incidencia.predio.quejasUltimos6Meses} quejas en 6 meses`}
        />
        <InfoRow
          styles={styles}
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

type Styles = ReturnType<typeof makeStyles>;

function InfoRow({ styles, label, value, icon }: { styles: Styles; label: string; value: string; icon?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
      {icon && <Text style={styles.infoIcon}>{icon}</Text>}
    </View>
  );
}

function InfoRowStacked({ styles, label, value }: { styles: Styles; label: string; value: string }) {
  return (
    <View style={styles.infoRowStacked}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    container: { gap: Spacing.md },
    mapLink: { alignSelf: 'flex-start' },
    mapLinkText: { fontSize: 12.5, fontWeight: '700', color: t.accent },
    card: { gap: 10 },
    groupedCard: {
      backgroundColor: t.accentBg,
      borderRadius: 12,
      padding: Spacing.sm,
    },
    cardHeadRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    cardTitle: { fontSize: 13, fontWeight: '700', color: t.accent },
    tag: { backgroundColor: t.accentBg, borderRadius: 20, paddingHorizontal: Spacing.xs, paddingVertical: 3 },
    tagLabel: { fontSize: 10, fontWeight: '600', color: t.accent },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    infoRowStacked: { gap: 4 },
    infoLabel: { width: 130, fontSize: 10, fontWeight: '600', color: t.textMuted },
    infoValue: { flex: 1, fontSize: 12.5, color: t.textBody },
    infoIcon: { fontSize: 14 },
    divider: { height: 1, backgroundColor: t.border, marginVertical: 4 },
    groupedItem: { fontSize: 12.5, color: t.textBody },
    groupedLink: { fontSize: 12.5, fontWeight: '700', color: t.accent, marginTop: 4 },
  });
}
