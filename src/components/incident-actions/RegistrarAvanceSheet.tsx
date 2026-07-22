import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { MOTIVOS_AVANCE, type MotivoAvance, type TransicionEstado } from '@/mocks/estadoWorkflowMock';
import { useRegistrarAvance } from '@/hooks/useRegistrarAvance';

type Props = {
  visible: boolean;
  incidenciaId: string;
  incidenciaLabel: string;
  transicion: TransicionEstado | null;
  onClose: () => void;
  onRegistrado: (motivo: MotivoAvance) => void;
};

/** Overlay - Registrar Avance (Spec 07, RF-07.3 a RF-07.7). */
export function RegistrarAvanceSheet({ visible, incidenciaId, incidenciaLabel, transicion, onClose, onRegistrado }: Props) {
  const [motivo, setMotivo] = useState<MotivoAvance | null>(null);
  const [nota, setNota] = useState('');
  const registrarAvance = useRegistrarAvance();

  const resetAndClose = () => {
    setMotivo(null);
    setNota('');
    onClose();
  };

  const handleConfirm = () => {
    if (!motivo || !transicion) return;
    registrarAvance.mutate(
      { id: incidenciaId, motivo, nota, siguienteEstado: transicion.hacia },
      {
        onSuccess: () => {
          setMotivo(null);
          setNota('');
          onRegistrado(motivo);
        },
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <Pressable style={styles.backdrop} onPress={resetAndClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Registrar avance</Text>
            <Pressable style={styles.closeBtn} onPress={resetAndClose}>
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>{incidenciaLabel}</Text>

          <Text style={styles.sectionLabel}>¿QUÉ PASÓ?</Text>
          <View style={styles.grid}>
            {MOTIVOS_AVANCE.map((m) => (
              <Pressable
                key={m.value}
                style={[styles.chip, motivo === m.value && styles.chipActive]}
                onPress={() => setMotivo(m.value)}
              >
                <Text style={[styles.chipLabel, motivo === m.value && styles.chipLabelActive]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>NOTA (OPCIONAL)</Text>
          <TextInput
            value={nota}
            onChangeText={setNota}
            placeholder="Solo si hace falta un detalle extra..."
            placeholderTextColor={Colors.textMuted}
            style={styles.notaBox}
            multiline
          />

          <View style={styles.buttonsRow}>
            <Pressable style={styles.cancelBtn} onPress={resetAndClose}>
              <Text style={styles.cancelLabel}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, !motivo && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!motivo || registrarAvance.isPending}
            >
              <Text style={styles.confirmLabel}>Registrar avance</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(13, 43, 82, 0.25)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: Colors.primaryDark },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E3E4E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  subtitle: { fontSize: 11, color: Colors.textMuted, marginBottom: Spacing.xs },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, marginTop: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipLabel: { fontSize: 11, fontWeight: '600', color: Colors.textBody },
  chipLabelActive: { color: Colors.white },
  notaBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    minHeight: 70,
    fontSize: 12.5,
    color: Colors.textBody,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  buttonsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: Radius.pill,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelLabel: { color: Colors.accent, fontWeight: '700', fontSize: 13 },
  confirmBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    alignItems: 'center',
    paddingVertical: 12,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmLabel: { color: Colors.white, fontWeight: '700', fontSize: 13 },
});
