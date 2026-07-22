import { Alert, Modal, Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { getTransicionesDisponibles, type TransicionEstado } from '@/mocks/estadoWorkflowMock';
import type { EstadoIncidencia } from '@/mocks/incidentsMock';
import { useCambiarEstado } from '@/hooks/useCambiarEstado';

const ESTADO_COLOR: Record<EstadoIncidencia, string> = {
  CREADO: Colors.textMuted,
  PENDIENTE: Colors.accent,
  EN_PROGRESO: Colors.accent,
  ATENDIDO: '#1A7D3A',
};

type Props = {
  visible: boolean;
  incidenciaId: string;
  estado: EstadoIncidencia;
  onClose: () => void;
  onAbrirAvance: (transicion: TransicionEstado) => void;
};

/** Overlay - Cambiar Estado (Spec 07, RF-07.1, RF-07.2). */
export function CambiarEstadoSheet({ visible, incidenciaId, estado, onClose, onAbrirAvance }: Props) {
  const cambiarEstado = useCambiarEstado();
  const transiciones = getTransicionesDisponibles(estado);

  const handlePress = (transicion: TransicionEstado) => {
    if (transicion.requiereFormulario) {
      onClose();
      onAbrirAvance(transicion);
      return;
    }
    Alert.alert('Marcar como atendido', '¿Confirmas que esta incidencia fue atendida?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () => {
          cambiarEstado.mutate({ id: incidenciaId, estado: transicion.hacia });
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <Text style={styles.title}>Cambiar estado</Text>
          {transiciones.length === 0 && <Text style={styles.emptyText}>Esta incidencia ya fue atendida.</Text>}
          {transiciones.map((t, i) => (
            <Pressable key={`${t.desde}-${t.hacia}-${i}`} style={styles.item} onPress={() => handlePress(t)}>
              <Text style={styles.itemLabel}>{t.label}</Text>
              <Text style={[styles.itemTarget, { color: ESTADO_COLOR[t.hacia] }]}>
                → {t.hacia.replace('_', ' ')}
              </Text>
            </Pressable>
          ))}
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
  title: { fontSize: 16, fontWeight: '800', color: Colors.primaryDark, marginBottom: Spacing.xs },
  emptyText: { fontSize: 13, color: Colors.textMuted, paddingVertical: Spacing.sm },
  item: {
    backgroundColor: '#F4F6FB',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 2,
  },
  itemLabel: { fontSize: 13, fontWeight: '700', color: Colors.textBody },
  itemTarget: { fontSize: 11, fontWeight: '600' },
});
