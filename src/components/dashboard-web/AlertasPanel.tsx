import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAlertas } from '@/hooks/useDashboardGeo';

const NIVEL_COLOR = {
  rojo: '#D32F2F',
  amarillo: '#F59E0B',
  verde: '#34C759',
} as const;

const NIVEL_ICONO = {
  rojo: 'alert-circle',
  amarillo: 'warning',
  verde: 'checkmark-circle',
} as const;

export function AlertasPanel() {
  const { data, isLoading } = useAlertas();
  const alertas = data ?? [];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="notifications-outline" size={16} color={Colors.textBody} />
        <Text style={styles.titulo}>Alertas operativas</Text>
        {alertas.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{alertas.length}</Text>
          </View>
        )}
      </View>
      {isLoading && <Text style={styles.muted}>Cargando…</Text>}
      {!isLoading && alertas.length === 0 && (
        <Text style={styles.muted}>Sin alertas activas</Text>
      )}
      {alertas.map((a, i) => (
        <View key={i} style={styles.alerta}>
          <Ionicons
            name={NIVEL_ICONO[a.nivel] as any}
            size={16}
            color={NIVEL_COLOR[a.nivel]}
          />
          <Text style={styles.alertaText}>{a.mensaje}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  titulo: { fontSize: 13, fontWeight: '700', color: Colors.textBody, flex: 1 },
  badge: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: Colors.dangerText },
  alerta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  alertaText: { flex: 1, fontSize: 12, color: Colors.textBody, lineHeight: 16 },
  muted: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
});
