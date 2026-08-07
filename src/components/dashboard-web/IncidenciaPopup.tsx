import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useIncidenciaPopup } from '@/hooks/useIncidenciaPopup';

type Props = {
  codigo: string | null;
  onClose: () => void;
};

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatearFechaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

export function IncidenciaPopup({ codigo, onClose }: Props) {
  const { data, isLoading, isError } = useIncidenciaPopup(codigo);

  if (!codigo) return null;

  const grupoColor = data?.grupo === 'agua' ? '#0D2B52' : '#166534';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Incidencia {data?.codigo ?? codigo}</Text>
            {data?.tipo_atencion && (
              <View style={styles.tipoRow}>
                <View style={[styles.tipoDot, { backgroundColor: grupoColor }]} />
                <Text style={styles.tipoText}>{data.tipo_atencion}</Text>
              </View>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </Pressable>
        </View>

        {isLoading && <Text style={styles.muted}>Cargando…</Text>}
        {isError && <Text style={styles.error}>No se pudo cargar el detalle.</Text>}

        {data && (
          <>
            <View style={styles.metaRow}>
              <View style={styles.metaLabelBox}>
                <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.metaLabelText}>Dirección</Text>
              </View>
              <Text style={styles.metaValue}>{data.direccion ?? 'Sin dirección'}</Text>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaLabelBox}>
                <Ionicons name="pricetag-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.metaLabelText}>Suministro</Text>
              </View>
              <Text style={styles.metaValue}>{data.suministro ?? '—'}</Text>
            </View>
            {data.sector && (
              <View style={styles.metaRow}>
                <View style={styles.metaLabelBox}>
                  <Ionicons name="layers-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.metaLabelText}>Sector</Text>
                </View>
                <Text style={styles.metaValue}>{data.sector}</Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <View style={styles.metaLabelBox}>
                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.metaLabelText}>Estado</Text>
              </View>
              <Text style={styles.metaValue}>
                {data.sin_solucion
                  ? `Sin resolver desde ${formatearFecha(data.creado_en)}`
                  : `Resuelto en ${data.dias_hasta_solucion} días`}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.reclamosTitleRow}>
              <Ionicons name="call-outline" size={14} color={Colors.textBody} />
              <Text style={styles.reclamosTitle}>
                {data.reclamos.length} reclamo{data.reclamos.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {data.reclamos.map((r, i) => (
              <View key={i} style={styles.reclamoItem}>
                <Text style={styles.reclamoFecha}>{formatearFechaCorta(r.fecha)}</Text>
                <Text style={styles.reclamoDetalle}>
                  {r.detalle ?? '(sin descripción)'}
                </Text>
              </View>
            ))}
          </>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    width: 360,
    maxWidth: '100%',
    // El maplibregl.Popup ya provee su propio contenedor con sombra; solo
    // aportamos el card interno.
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textBody,
    marginBottom: 4,
  },
  tipoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  tipoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tipoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
    textTransform: 'none',
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 6,
    alignItems: 'flex-start',
  },
  metaLabelBox: {
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaLabelText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  metaValue: {
    flex: 1,
    fontSize: 13,
    color: Colors.textBody,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  reclamosTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  reclamosTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textBody,
  },
  reclamoItem: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  reclamoFecha: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  reclamoDetalle: {
    fontSize: 12,
    color: Colors.textBody,
    lineHeight: 16,
  },
  muted: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  error: {
    fontSize: 13,
    color: Colors.dangerText,
    marginTop: Spacing.sm,
  },
});
