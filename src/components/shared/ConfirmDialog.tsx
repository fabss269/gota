import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Modal de confirmación reutilizable (nativo RN). Mismo contrato que la variante
 * .web.tsx. `destructive: true` pinta el botón principal en rojo.
 */
export function ConfirmDialog({
  open,
  title = 'Confirmar cambio',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={loading ? undefined : onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonsRow}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={[styles.btn, styles.cancelBtn, loading && styles.disabled]}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={[
                styles.btn,
                styles.confirmBtn,
                { backgroundColor: destructive ? Colors.statusCritica : Colors.accent },
                loading && styles.disabled,
              ]}
            >
              <Text style={styles.confirmLabel}>{loading ? 'Guardando…' : confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    padding: Spacing.lg,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textBody, marginBottom: 10 },
  message: { fontSize: 14, color: Colors.textMuted, lineHeight: 20, marginBottom: Spacing.lg },
  buttonsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border },
  cancelLabel: { fontSize: 14, fontWeight: '600', color: Colors.textBody },
  confirmBtn: {},
  confirmLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  disabled: { opacity: 0.6 },
});
